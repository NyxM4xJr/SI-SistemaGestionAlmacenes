# ============================================================
# ARCHIVO: backend/usuarios/factura_anomalias_views.py
# CASO DE USO: CU41 - Detección de Facturas Anómalas
# CICLO: 6
#
# DESCRIPCIÓN:
#   Acción bajo demanda que audita las facturas ya cargadas (CU39) y
#   señala dos tipos de anomalía OBJETIVA, calculadas en Python:
#     (a) DUPLICADOS: misma (numero_factura + proveedor_id) cargada más
#         de una vez.
#     (b) PRECIO FUERA DE RANGO: precio_unitario facturado muy por encima
#         del precio pactado con el proveedor (proveedor_insumo.precio,
#         mismo dato que usa CU36 para elegir proveedor).
#   El backend calcula las señales; la IA sólo REDACTA el informe de
#   riesgo priorizado (no inventa cifras). Marca factura.es_anomala.
#
# ENDPOINT:
#   GET /api/facturas/anomalias/
#
# BITÁCORA:
#   DETECTAR_FACTURAS_ANOMALAS
# ============================================================

import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_texto_ia, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_ANOMALIAS = ['administrador', 'gerente']
# Se marca anomalía de precio si lo facturado supera al precio pactado en
# más de este porcentaje.
UMBRAL_SOBREPRECIO = 0.30  # 30%

SYSTEM_PROMPT_AUDITORIA = (
    "Sos un auditor de control interno de un almacén gastronómico. Te paso, "
    "en JSON, señales de anomalía YA detectadas sobre facturas cargadas: "
    "facturas duplicadas y precios facturados por encima de lo pactado con el "
    "proveedor. Redactá un informe breve (máx. 120 palabras), en español, en "
    "texto plano sin Markdown, priorizando lo más riesgoso primero. No "
    "inventes cifras ni facturas que no estén en los datos; si no hay señales, "
    "decilo con una sola frase."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _detectar_duplicados(facturas):
    """Facturas que comparten (numero_factura, proveedor_id)."""
    grupos = {}
    for f in facturas:
        numero = (f.get('numero_factura') or '').strip().lower()
        if not numero:
            continue
        clave = (numero, f.get('proveedor_id'))
        grupos.setdefault(clave, []).append(f)

    duplicados = []
    for (numero, _prov), grupo in grupos.items():
        if len(grupo) > 1:
            duplicados.append({
                'numero_factura': grupo[0].get('numero_factura'),
                'proveedor': (grupo[0].get('proveedor') or {}).get('nombre'),
                'veces_cargada': len(grupo),
                'factura_ids': [g['id'] for g in grupo],
            })
    return duplicados


def _detectar_sobreprecios(supabase, facturas):
    """
    Ítems facturados cuyo precio_unitario supera en > UMBRAL_SOBREPRECIO el
    precio pactado en proveedor_insumo para ese insumo.
    """
    # Precio pactado mínimo por insumo (el mismo criterio de referencia de CU36).
    pi_res = supabase.table('proveedor_insumo').select('insumo_id, precio').execute()
    precio_pactado = {}
    for pi in (pi_res.data or []):
        iid = pi.get('insumo_id')
        precio = float(pi.get('precio') or 0)
        if iid is None or precio <= 0:
            continue
        if iid not in precio_pactado or precio < precio_pactado[iid]:
            precio_pactado[iid] = precio

    sobreprecios = []
    for f in facturas:
        for d in (f.get('detalle_factura') or []):
            iid = d.get('insumo_id')
            precio_fact = float(d.get('precio_unitario') or 0)
            ref = precio_pactado.get(iid)
            if not ref or precio_fact <= 0:
                continue
            if precio_fact > ref * (1 + UMBRAL_SOBREPRECIO):
                sobreprecios.append({
                    'factura_id': f['id'],
                    'numero_factura': f.get('numero_factura'),
                    'insumo': d.get('insumo_nombre'),
                    'precio_facturado': round(precio_fact, 2),
                    'precio_pactado': round(ref, 2),
                    'sobreprecio_pct': round((precio_fact / ref - 1) * 100, 1),
                })
    return sobreprecios


class DetectarFacturasAnomalasView(APIView):
    """
    GET /api/facturas/anomalias/

    Respuesta (200):
    {
      "facturas_anomalas": [ids...],
      "duplicados": [...],
      "sobreprecios": [...],
      "informe": "texto redactado por la IA"
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_ANOMALIAS:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()
            fact_res = (
                supabase.table('factura')
                .select('id, numero_factura, proveedor_id, proveedor:proveedor_id(nombre), '
                        'detalle_factura(insumo_id, insumo_nombre, precio_unitario)')
                .execute()
            )
            facturas = fact_res.data or []
        except Exception as e:
            logger.error(f"Error cargando facturas para CU41: {str(e)}")
            return Response(
                {'error': 'Error al cargar las facturas.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        duplicados = _detectar_duplicados(facturas)
        try:
            sobreprecios = _detectar_sobreprecios(supabase, facturas)
        except Exception as e:
            logger.error(f"Error detectando sobreprecios: {str(e)}")
            sobreprecios = []

        # IDs de facturas con alguna anomalía.
        ids_anomalos = set()
        for d in duplicados:
            ids_anomalos.update(d['factura_ids'])
        for s in sobreprecios:
            ids_anomalos.add(s['factura_id'])

        # Si no hay señales, no se llama a la IA (ahorra costo, igual que CU38).
        if not duplicados and not sobreprecios:
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='DETECTAR_FACTURAS_ANOMALAS',
                detalles={'ip': ip_cliente, 'anomalias': 0},
            )
            return Response({
                'facturas_anomalas': [],
                'duplicados': [],
                'sobreprecios': [],
                'informe': 'No se detectaron anomalías en las facturas cargadas.',
            }, status=status.HTTP_200_OK)

        try:
            informe = generar_texto_ia(
                SYSTEM_PROMPT_AUDITORIA,
                f"Duplicados:\n{duplicados}\n\nSobreprecios:\n{sobreprecios}",
                max_tokens=400,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU41: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Marcar las facturas como anómalas.
        try:
            for fid in ids_anomalos:
                motivos = []
                if any(fid in d['factura_ids'] for d in duplicados):
                    motivos.append('duplicada')
                if any(s['factura_id'] == fid for s in sobreprecios):
                    motivos.append('sobreprecio')
                supabase.table('factura').update({
                    'es_anomala': True,
                    'motivo_anomalia': ', '.join(motivos),
                }).eq('id', fid).execute()
        except Exception as e:
            logger.error(f"Error marcando facturas anómalas: {str(e)}")

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='DETECTAR_FACTURAS_ANOMALAS',
            detalles={
                'ip': ip_cliente,
                'anomalias': len(ids_anomalos),
                'duplicados': len(duplicados),
                'sobreprecios': len(sobreprecios),
            },
        )

        return Response({
            'facturas_anomalas': list(ids_anomalos),
            'duplicados': duplicados,
            'sobreprecios': sobreprecios,
            'informe': informe,
        }, status=status.HTTP_200_OK)
