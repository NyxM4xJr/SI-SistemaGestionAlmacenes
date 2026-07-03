# ============================================================
# ARCHIVO: backend/usuarios/venta_views.py
# CASO DE USO: CU35 - Registrar Venta de Platos
# CICLO: 5
# FECHA: 03/07/26
#
# DESCRIPCIÓN:
#   Registra ventas de platos y descuenta el inventario asociado.
#   El descuento de stock reutiliza la MISMA lógica del descargo
#   automático (CU16): consumo teórico por receta + costo vigente,
#   insertando movimientos tipo 'salida' en MOVIMIENTO_INVENTARIO
#   (los triggers de la BD ajustan STOCK y generan alertas).
#
#   El COBRO (Stripe/PayPal) es una acción APARTE y opcional
#   (ver pago_views.py, CU31/CU36). Al registrar, la venta queda con
#   estado 'registrada'; al cobrarse pasa a 'pagada'.
#
# ENDPOINTS:
#   GET    /api/ventas/        → listar ventas
#   POST   /api/ventas/        → registrar venta (descuenta stock)
#   GET    /api/ventas/{id}/   → detalle de una venta
#   PATCH  /api/ventas/{id}/   → actualizar estado/metodo/pago_id (o anular)
#   DELETE /api/ventas/{id}/   → eliminar una venta
#
# BITÁCORA:
#   CREAR_VENTA, ACTUALIZAR_VENTA, ELIMINAR_VENTA
# ============================================================

import logging
from datetime import datetime

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
from bitacora.utils import registrar_accion, obtener_ip_cliente

# Reutilización directa de la lógica de descargo (CU16)
from .descargo_views import _construir_propuesta, _obtener_stock_actual

logger = logging.getLogger(__name__)

ROLES_VENTA = ['administrador', 'gerente', 'chef']
ESTADOS_VALIDOS = ['registrada', 'pagada', 'anulada']
METODOS_VALIDOS = ['pendiente', 'efectivo', 'stripe', 'paypal']


def _descontar_stock_por_venta(supabase, venta_id, unidades_por_plato):
    """
    Descuenta el inventario de una venta reutilizando la propuesta de
    descargo (CU16). Best-effort: los insumos sin stock suficiente se
    excluyen y se reportan, NO bloquean el registro de la venta.

    Returns:
        dict con insumos_descargados / insumos_excluidos / valor_total.
    """
    plato_ids = list(unidades_por_plato.keys())
    propuesta = _construir_propuesta(supabase, plato_ids, unidades_por_plato)

    stock_por_insumo = _obtener_stock_actual(
        supabase, [item['insumo_id'] for item in propuesta['items']]
    )

    insumos_descargados = []
    insumos_excluidos = []
    valor_total = 0.0

    for item in propuesta['items']:
        insumo_id = item['insumo_id']

        if item.get('cantidad_es_cero'):
            insumos_excluidos.append({
                'insumo_id': insumo_id,
                'insumo_nombre': item['insumo_nombre'],
                'motivo': 'La cantidad calculada redondea a 0 (no genera salida real)',
            })
            continue

        if not item['stock_suficiente']:
            insumos_excluidos.append({
                'insumo_id': insumo_id,
                'insumo_nombre': item['insumo_nombre'],
                'motivo': (
                    f"Stock insuficiente (disponible: {item['stock_actual']}, "
                    f"requerido: {item['cantidad_a_descargar']})"
                ),
            })
            continue

        info_stock = stock_por_insumo.get(insumo_id)
        if not info_stock:
            insumos_excluidos.append({
                'insumo_id': insumo_id,
                'insumo_nombre': item['insumo_nombre'],
                'motivo': 'No se encontró registro de stock para este insumo',
            })
            continue

        try:
            supabase.table('movimiento_inventario').insert({
                'tipo': 'salida',
                'insumo_id': insumo_id,
                'stock_id': info_stock['stock_id'],
                # cantidad es INTEGER en la BD; ya viene redondeada
                'cantidad': int(item['cantidad_a_descargar']),
                'destino': f'Venta #{venta_id}',
                'fecha_mov': datetime.now().strftime('%Y-%m-%d'),
            }).execute()

            insumos_descargados.append({
                'insumo_id': insumo_id,
                'insumo_nombre': item['insumo_nombre'],
                'cantidad': item['cantidad_a_descargar'],
                'valor': item['valor_estimado'],
            })
            valor_total += item['valor_estimado']
        except Exception as e:
            logger.error(f"Error salida venta #{venta_id}, insumo {insumo_id}: {str(e)}")
            insumos_excluidos.append({
                'insumo_id': insumo_id,
                'insumo_nombre': item['insumo_nombre'],
                'motivo': f'Error al registrar la salida: {str(e)}',
            })

    return {
        'insumos_descargados': insumos_descargados,
        'insumos_excluidos': insumos_excluidos,
        'valor_total_descargado': round(valor_total, 2),
    }


class VentaListView(APIView):
    """
    GET  /api/ventas/  → Lista las ventas registradas (más recientes primero).
    POST /api/ventas/  → Registra una venta y descuenta el stock.

    Body POST:
    {
      "metodo_pago": "efectivo" | "pendiente" | ...,   (opcional, default 'pendiente')
      "items": [ {"plato_id": int, "cantidad": int, "precio_unitario": float?}, ... ]
    }
    Si no se envía precio_unitario, se usa plato.costo como base.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_VENTA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = (
                supabase.table('venta')
                .select('*, detalle_venta(*, plato:plato_id(nombre))')
                .order('created_at', desc=True)
                .execute()
            )
            return Response(response.data or [], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listando ventas: {str(e)}")
            return Response(
                {'error': 'Error al obtener las ventas.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        if request.user.rol not in ROLES_VENTA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        metodo_pago = (request.data.get('metodo_pago') or 'pendiente').strip()
        items = request.data.get('items')

        # ── Validaciones ──
        if metodo_pago not in METODOS_VALIDOS:
            return Response(
                {'error': f'Método de pago inválido. Válidos: {METODOS_VALIDOS}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(items, list) or not items:
            return Response(
                {'error': 'Debe incluir al menos un plato en la venta.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Normalizar y validar items
        items_norm = []
        for it in items:
            if not isinstance(it, dict):
                return Response({'error': 'Formato de items inválido.'}, status=status.HTTP_400_BAD_REQUEST)
            plato_id = it.get('plato_id')
            cantidad = it.get('cantidad')
            if not plato_id or not cantidad or int(cantidad) <= 0:
                return Response(
                    {'error': 'Cada item requiere plato_id y cantidad > 0.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            items_norm.append({
                'plato_id': int(plato_id),
                'cantidad': int(cantidad),
                'precio_unitario': it.get('precio_unitario'),
            })

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Traer costos de los platos (base de precio y validación de existencia)
            plato_ids = [it['plato_id'] for it in items_norm]
            platos_res = supabase.table('plato').select('id, nombre, costo').in_('id', plato_ids).execute()
            platos = {p['id']: p for p in (platos_res.data or [])}

            faltantes = [pid for pid in plato_ids if pid not in platos]
            if faltantes:
                return Response(
                    {'error': f'Platos inexistentes: {faltantes}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Calcular total y armar detalle
            total = 0.0
            detalle_rows = []
            for it in items_norm:
                base = platos[it['plato_id']].get('costo') or 0
                precio_unitario = it['precio_unitario']
                precio_unitario = float(precio_unitario) if precio_unitario is not None else float(base)
                subtotal = round(precio_unitario * it['cantidad'], 2)
                total += subtotal
                detalle_rows.append({
                    'plato_id': it['plato_id'],
                    'cantidad': it['cantidad'],
                    'precio_unitario': precio_unitario,
                    'subtotal': subtotal,
                })
            total = round(total, 2)

            # 1) Insertar cabecera de venta
            venta_payload = {
                'fecha': datetime.now().strftime('%Y-%m-%d'),
                'usuario_id': str(request.user.id),
                'total': total,
                'metodo_pago': metodo_pago,
                'estado': 'registrada',
            }
            venta_res = supabase.table('venta').insert(venta_payload).execute()
            venta = venta_res.data[0]
            venta_id = venta['id']

            # 2) Insertar detalle (con venta_id)
            for row in detalle_rows:
                row['venta_id'] = venta_id
            supabase.table('detalle_venta').insert(detalle_rows).execute()

            # 3) Descontar stock (best-effort, reutiliza CU16)
            unidades_por_plato = {it['plato_id']: it['cantidad'] for it in items_norm}
            descargo = _descontar_stock_por_venta(supabase, venta_id, unidades_por_plato)

            # 4) Bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='CREAR_VENTA',
                detalles={
                    'ip': ip_cliente,
                    'venta_id': venta_id,
                    'total': total,
                    'metodo_pago': metodo_pago,
                    'insumos_descargados': len(descargo['insumos_descargados']),
                    'insumos_excluidos': len(descargo['insumos_excluidos']),
                }
            )

            return Response(
                {
                    'venta': {**venta, 'detalle_venta': detalle_rows},
                    'descargo': descargo,
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error(f"Error registrando venta: {str(e)}")
            return Response(
                {'error': 'Error al registrar la venta.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VentaDetailView(APIView):
    """
    GET    /api/ventas/{id}/  → Detalle de una venta.
    PATCH  /api/ventas/{id}/  → Actualiza estado / metodo_pago / pago_id.
    DELETE /api/ventas/{id}/  → Elimina una venta.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, venta_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            res = (
                supabase.table('venta')
                .select('*, detalle_venta(*, plato:plato_id(nombre))')
                .eq('id', venta_id)
                .execute()
            )
            if not res.data:
                return Response({'error': 'Venta no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            return Response(res.data[0], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error obteniendo venta {venta_id}: {str(e)}")
            return Response({'error': 'Error al obtener la venta.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, venta_id):
        if request.user.rol not in ROLES_VENTA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            check = supabase.table('venta').select('id').eq('id', venta_id).execute()
            if not check.data:
                return Response({'error': 'Venta no encontrada'}, status=status.HTTP_404_NOT_FOUND)

            update = {}
            if 'estado' in request.data:
                estado = request.data.get('estado')
                if estado not in ESTADOS_VALIDOS:
                    return Response(
                        {'error': f'Estado inválido. Válidos: {ESTADOS_VALIDOS}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                update['estado'] = estado
            if 'metodo_pago' in request.data:
                metodo = request.data.get('metodo_pago')
                if metodo not in METODOS_VALIDOS:
                    return Response(
                        {'error': f'Método de pago inválido. Válidos: {METODOS_VALIDOS}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                update['metodo_pago'] = metodo
            if 'pago_id' in request.data:
                update['pago_id'] = request.data.get('pago_id')

            if not update:
                return Response({'error': 'No hay campos para actualizar.'}, status=status.HTTP_400_BAD_REQUEST)

            supabase.table('venta').update(update).eq('id', venta_id).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ACTUALIZAR_VENTA',
                detalles={'ip': ip_cliente, 'venta_id': venta_id, 'cambios': update}
            )
            return Response({'id': venta_id, **update}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error actualizando venta {venta_id}: {str(e)}")
            return Response({'error': 'Error al actualizar la venta.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, venta_id):
        if request.user.rol not in ['administrador', 'gerente']:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            check = supabase.table('venta').select('id').eq('id', venta_id).execute()
            if not check.data:
                return Response({'error': 'Venta no encontrada'}, status=status.HTTP_404_NOT_FOUND)

            # detalle_venta se elimina en cascada (FK on delete cascade)
            supabase.table('venta').delete().eq('id', venta_id).execute()

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='ELIMINAR_VENTA',
                detalles={'ip': ip_cliente, 'venta_id': venta_id}
            )
            return Response({'mensaje': 'Venta eliminada'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error eliminando venta {venta_id}: {str(e)}")
            return Response({'error': 'Error al eliminar la venta.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
