# ============================================================
# ARCHIVO: backend/inventario/factura_views.py
# CASOS DE USO:
#   CU39 - OCR de Facturas con IA (visión)
#   CU40 - Conciliación Factura vs Orden de Compra
# CICLO: 6
#
# DESCRIPCIÓN:
#   CU39: recibe la FOTO de una factura de proveedor, la lee con la IA
#   de visión (gpt-4o-mini) y extrae número, fecha, proveedor, ítems y
#   total. El OCR NO persiste (paso de revisión); recién al confirmar se
#   guarda en las tablas 'factura' y 'detalle_factura'. La imagen se sube
#   (opcionalmente) al bucket de Supabase Storage 'facturas'.
#
#   CU40: sobre una factura ya guardada, compara ítem por ítem lo
#   facturado contra la orden de compra que la originó (CU36) y la IA
#   lista SOLO las diferencias reales (cantidad, precio, faltantes).
#
# ENDPOINTS:
#   POST   /api/facturas/ocr/                 → extrae datos de la imagen (CU39)
#   GET    /api/facturas/                     → lista facturas guardadas (CU39)
#   POST   /api/facturas/                     → guarda una factura revisada (CU39)
#   GET    /api/facturas/{id}/                → detalle (CU39)
#   DELETE /api/facturas/{id}/                → elimina (CU39)
#   POST   /api/facturas/{id}/conciliar/      → concilia contra una orden (CU40)
#
# BITÁCORA:
#   EXTRAER_FACTURA_OCR, REGISTRAR_FACTURA, ELIMINAR_FACTURA, CONCILIAR_FACTURA
# ============================================================

import base64
import binascii
import logging
import uuid
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import (
    generar_json_ia,
    generar_json_ia_vision,
    IANoDisponibleError,
)

logger = logging.getLogger(__name__)

ROLES_FACTURA = ['administrador', 'gerente']
BUCKET_FACTURAS = 'facturas'

SYSTEM_PROMPT_OCR = (
    "Sos un extractor de datos de facturas de compra de un almacén "
    "gastronómico. Te paso la imagen de una factura o remito de proveedor. "
    "Extraé SOLO lo que realmente aparece en la imagen, no inventes ni "
    "completes datos que no puedas leer (si un dato no está, dejalo en null). "
    "Los importes son números (sin símbolo de moneda).\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, "
    "con esta forma exacta:\n"
    '{"numero": str|null, "fecha": "YYYY-MM-DD"|null, "proveedor": str|null, '
    '"total": number|null, "items": [{"insumo": str, "cantidad": number, '
    '"precio_unitario": number, "subtotal": number}]}'
)

SYSTEM_PROMPT_CONCILIACION = (
    "Sos un auditor de compras. Te paso dos listados de ítems: lo que se "
    "PIDIÓ en una orden de compra y lo que llegó FACTURADO. Compará ítem por "
    "ítem (relacionándolos por nombre de insumo, tolerá diferencias menores de "
    "redacción) y listá SOLO las diferencias reales: cantidades que no "
    "coinciden, precios distintos a lo pactado, ítems facturados que no se "
    "pidieron, o ítems pedidos que no se facturaron. No inventes diferencias "
    "que no surjan de los datos.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"coincide": bool, "diferencias": [{"insumo": str, "tipo": '
    '"cantidad"|"precio"|"faltante_en_factura"|"sobrante_en_factura", '
    '"esperado": str, "facturado": str}], "resumen": str}'
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _subir_imagen_factura(supabase, imagen_data_url):
    """
    Sube la imagen (data URL base64) al bucket de Supabase Storage y devuelve
    la ruta guardada. Si el bucket no existe o el upload falla, devuelve None
    sin romper el flujo (la imagen es opcional, según el plan).
    """
    if not imagen_data_url or ',' not in imagen_data_url:
        return None
    try:
        cabecera, b64 = imagen_data_url.split(',', 1)
        # cabecera tipo "data:image/jpeg;base64"
        ext = 'jpg'
        if 'image/' in cabecera:
            ext = cabecera.split('image/')[1].split(';')[0] or 'jpg'
        binario = base64.b64decode(b64)
        ruta = f"{datetime.now().strftime('%Y%m%d')}/{uuid.uuid4().hex}.{ext}"
        supabase.storage.from_(BUCKET_FACTURAS).upload(
            ruta, binario, {"content-type": f"image/{ext}"}
        )
        return ruta
    except (binascii.Error, ValueError) as e:
        logger.error(f"Imagen de factura inválida, no se sube: {str(e)}")
        return None
    except Exception as e:
        # Bucket inexistente u otro problema de Storage: no bloquea el guardado.
        logger.warning(f"No se pudo subir la imagen al bucket '{BUCKET_FACTURAS}': {str(e)}")
        return None


def _mapa_insumos_por_nombre(supabase):
    """nombre_lower -> insumo_id, para intentar enlazar los ítems del OCR."""
    try:
        res = supabase.table('insumo').select('id, nombre').execute()
        return {
            (i.get('nombre') or '').strip().lower(): i['id']
            for i in (res.data or []) if i.get('nombre')
        }
    except Exception as e:
        logger.warning(f"No se pudo cargar el mapa de insumos: {str(e)}")
        return {}


class FacturaOCRView(APIView):
    """
    POST /api/facturas/ocr/
    Body: { "imagen": "data:image/jpeg;base64,..." }

    Devuelve los datos extraídos por la IA SIN persistir (paso de revisión).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        imagen = request.data.get('imagen')
        if not imagen or not isinstance(imagen, str) or 'base64,' not in imagen:
            return Response(
                {'error': 'Debe enviar la imagen de la factura en base64 (campo "imagen").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            datos = generar_json_ia_vision(
                SYSTEM_PROMPT_OCR,
                "Extraé los datos de esta factura de proveedor.",
                imagen,
                max_tokens=1200,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU39 OCR: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        items = datos.get('items', []) if isinstance(datos, dict) else []

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='EXTRAER_FACTURA_OCR',
            detalles={'ip': ip_cliente, 'items_detectados': len(items)},
        )

        return Response(datos, status=status.HTTP_200_OK)


class FacturaListView(APIView):
    """
    GET  /api/facturas/  → lista las facturas guardadas.
    POST /api/facturas/  → guarda una factura revisada.

    Body POST:
    {
      "numero": str, "fecha": "YYYY-MM-DD", "proveedor_id": int|null,
      "total": number,
      "items": [{"insumo": str, "cantidad": number,
                 "precio_unitario": number, "subtotal": number}],
      "imagen": "data:image/...;base64,..."   (opcional)
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = _sb()
            res = (
                supabase.table('factura')
                .select('*, proveedor:proveedor_id(nombre, email), detalle_factura(*)')
                .order('created_at', desc=True)
                .execute()
            )
            return Response(res.data or [], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listando facturas: {str(e)}")
            return Response(
                {'error': 'Error al obtener las facturas.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        items = request.data.get('items')
        if not isinstance(items, list) or not items:
            return Response(
                {'error': 'La factura debe incluir al menos un ítem.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        proveedor_id = request.data.get('proveedor_id')
        try:
            supabase = _sb()

            imagen_url = _subir_imagen_factura(supabase, request.data.get('imagen'))
            mapa_insumos = _mapa_insumos_por_nombre(supabase)

            total = float(request.data.get('total') or 0)

            factura_res = supabase.table('factura').insert({
                'proveedor_id': int(proveedor_id) if proveedor_id else None,
                'numero_factura': request.data.get('numero'),
                'fecha': request.data.get('fecha') or datetime.now().strftime('%Y-%m-%d'),
                'total': round(total, 2),
                'estado_conciliacion': 'pendiente',
                'es_anomala': False,
                'imagen_url': imagen_url,
                'datos_extraidos': request.data.get('datos_extraidos') or {'items': items},
                'creada_por': str(request.user.id),
            }).execute()
            factura = factura_res.data[0]

            detalle_rows = []
            for it in items:
                nombre = (it.get('insumo') or '').strip()
                cantidad = float(it.get('cantidad') or 0)
                precio = float(it.get('precio_unitario') or 0)
                subtotal = it.get('subtotal')
                subtotal = float(subtotal) if subtotal is not None else round(precio * cantidad, 2)
                detalle_rows.append({
                    'factura_id': factura['id'],
                    'insumo_nombre': nombre,
                    'insumo_id': mapa_insumos.get(nombre.lower()),
                    'cantidad': cantidad,
                    'precio_unitario': precio,
                    'subtotal': subtotal,
                })
            if detalle_rows:
                supabase.table('detalle_factura').insert(detalle_rows).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='REGISTRAR_FACTURA',
                detalles={
                    'ip': ip_cliente,
                    'factura_id': factura['id'],
                    'items': len(detalle_rows),
                    'total': round(total, 2),
                },
            )

            return Response(
                {**factura, 'detalle_factura': detalle_rows},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            logger.error(f"Error guardando factura: {str(e)}")
            return Response(
                {'error': 'Error al guardar la factura.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class FacturaDetailView(APIView):
    """
    GET    /api/facturas/{id}/  → detalle de una factura.
    DELETE /api/facturas/{id}/  → elimina una factura.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, factura_id):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = _sb()
            res = (
                supabase.table('factura')
                .select('*, proveedor:proveedor_id(nombre, email), detalle_factura(*)')
                .eq('id', factura_id)
                .execute()
            )
            if not res.data:
                return Response({'error': 'Factura no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            return Response(res.data[0], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error obteniendo factura {factura_id}: {str(e)}")
            return Response({'error': 'Error al obtener la factura.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, factura_id):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = _sb()
            check = supabase.table('factura').select('id').eq('id', factura_id).execute()
            if not check.data:
                return Response({'error': 'Factura no encontrada'}, status=status.HTTP_404_NOT_FOUND)

            # detalle_factura se elimina en cascada (FK on delete cascade)
            supabase.table('factura').delete().eq('id', factura_id).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ELIMINAR_FACTURA',
                detalles={'ip': ip_cliente, 'factura_id': factura_id},
            )
            return Response({'mensaje': 'Factura eliminada'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error eliminando factura {factura_id}: {str(e)}")
            return Response({'error': 'Error al eliminar la factura.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ConciliarFacturaView(APIView):
    """
    POST /api/facturas/{id}/conciliar/
    Body: { "orden_id": int }

    Compara la factura contra la orden de compra que la originó (CU36) y la
    IA lista las diferencias. Actualiza factura.estado_conciliacion y orden_id.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, factura_id):
        if request.user.rol not in ROLES_FACTURA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        orden_id = request.data.get('orden_id')
        if not orden_id:
            return Response({'error': 'orden_id es obligatorio.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = _sb()

            factura_res = (
                supabase.table('factura')
                .select('*, detalle_factura(*)')
                .eq('id', factura_id)
                .execute()
            )
            if not factura_res.data:
                return Response({'error': 'Factura no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            factura = factura_res.data[0]

            orden_res = (
                supabase.table('orden_compra')
                .select('*, detalle_orden_compra(*, insumo:insumo_id(nombre))')
                .eq('id', orden_id)
                .execute()
            )
            if not orden_res.data:
                return Response({'error': 'Orden de compra no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            orden = orden_res.data[0]
        except Exception as e:
            logger.error(f"Error cargando datos de conciliación: {str(e)}")
            return Response(
                {'error': 'Error al cargar la factura o la orden.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        pedidos = [
            {
                'insumo': (d.get('insumo') or {}).get('nombre', f"Insumo #{d.get('insumo_id')}"),
                'cantidad': d.get('cantidad'),
                'precio_unitario': d.get('precio_unitario'),
            }
            for d in (orden.get('detalle_orden_compra') or [])
        ]
        facturados = [
            {
                'insumo': d.get('insumo_nombre'),
                'cantidad': d.get('cantidad'),
                'precio_unitario': d.get('precio_unitario'),
            }
            for d in (factura.get('detalle_factura') or [])
        ]

        try:
            resultado = generar_json_ia(
                SYSTEM_PROMPT_CONCILIACION,
                f"PEDIDO (orden de compra):\n{pedidos}\n\nFACTURADO:\n{facturados}",
                max_tokens=1000,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU40 conciliación: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        coincide = bool(resultado.get('coincide')) if isinstance(resultado, dict) else False
        diferencias = resultado.get('diferencias', []) if isinstance(resultado, dict) else []
        nuevo_estado = 'conciliada' if coincide and not diferencias else 'con_diferencias'

        try:
            supabase.table('factura').update({
                'estado_conciliacion': nuevo_estado,
                'orden_id': int(orden_id),
            }).eq('id', factura_id).execute()
        except Exception as e:
            logger.error(f"Error actualizando estado de conciliación: {str(e)}")

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='CONCILIAR_FACTURA',
            detalles={
                'ip': ip_cliente,
                'factura_id': factura_id,
                'orden_id': orden_id,
                'estado': nuevo_estado,
                'diferencias': len(diferencias),
            },
        )

        return Response({
            'estado_conciliacion': nuevo_estado,
            'coincide': coincide,
            'diferencias': diferencias,
            'resumen': resultado.get('resumen', '') if isinstance(resultado, dict) else '',
        }, status=status.HTTP_200_OK)
