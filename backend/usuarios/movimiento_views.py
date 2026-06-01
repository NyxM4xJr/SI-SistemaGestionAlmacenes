# ============================================================
# ARCHIVO: backend/usuarios/movimiento_views.py
# CASO DE USO: CU14 - Registrar Movimiento de Inventario
# CICLO: 3
# FECHA: 01/06/26
# AUTOR: Mateo Hurtado
#
# DESCRIPCIÓN:
#   Gestiona los movimientos de inventario: ingreso, salida,
#   merma y sobrerecuperada. Al insertar en MOVIMIENTO_INVENTARIO,
#   los triggers de la BD se ejecutan automáticamente:
#     - trg_actualizar_stock        → ajusta cantidad en STOCK
#     - trg_validar_stock_suficiente → rechaza si no hay stock
#     - trg_verificar_stock_minimo  → genera alerta si queda bajo mínimo
#
# ENDPOINTS:
#   GET  /api/movimientos/          → listar con filtros
#   POST /api/movimientos/          → crear movimiento (cualquier tipo)
#   GET  /api/movimientos/{id}/     → obtener detalle
#
# BITÁCORA:
#   CREAR_MOVIMIENTO → ingreso, salida, sobrerecuperada
#   CREAR_MERMA      → merma (incluye valor_perdido y causa)
# ============================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
from bitacora.utils import registrar_accion, obtener_ip_cliente
import logging
from datetime import date

logger = logging.getLogger(__name__)

# Tipos válidos de movimiento
TIPOS_VALIDOS = ['ingreso', 'salida', 'merma', 'sobrerecuperada']


class MovimientoListView(APIView):
    """
    GET  /api/movimientos/  → Lista movimientos con filtros opcionales.
    POST /api/movimientos/  → Crea un nuevo movimiento de inventario.

    Filtros GET (query params):
      ?tipo=ingreso|salida|merma|sobrerecuperada
      ?fecha_desde=YYYY-MM-DD
      ?fecha_hasta=YYYY-MM-DD
      ?insumo_id=1
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # ── Query base — solo insumo tiene FK formal ──────────
            # stock_id en MOVIMIENTO_INVENTARIO no tiene FK declarada,
            # por eso se hace lookup manual después.
            query = supabase.table('movimiento_inventario').select(
                '*, insumo:insumo_id(nombre)'
            ).order('created_at', desc=True)

            # Aplicar filtros opcionales
            tipo = request.query_params.get('tipo')
            fecha_desde = request.query_params.get('fecha_desde')
            fecha_hasta = request.query_params.get('fecha_hasta')
            insumo_id = request.query_params.get('insumo_id')

            if tipo and tipo in TIPOS_VALIDOS:
                query = query.eq('tipo', tipo)
            if fecha_desde:
                query = query.gte('fecha_mov', fecha_desde)
            if fecha_hasta:
                query = query.lte('fecha_mov', fecha_hasta)
            if insumo_id:
                query = query.eq('insumo_id', int(insumo_id))

            response = query.execute()
            movimientos = response.data

            # ── Lookup manual de stock (sin FK formal) ────────────
            stock_ids = list({
                m['stock_id'] for m in movimientos if m.get('stock_id')
            })
            stocks_map = {}
            if stock_ids:
                stocks_res = supabase.table('stock').select(
                    'id, cantidad, stock_min'
                ).in_('id', stock_ids).execute()
                stocks_map = {s['id']: s for s in stocks_res.data}

            for m in movimientos:
                sid = m.get('stock_id')
                m['stock'] = stocks_map.get(sid) if sid else None

            return Response(movimientos, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error listando movimientos: {str(e)}")
            return Response(
                {'error': 'Error al obtener los movimientos de inventario'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """
        Crea un movimiento. El payload varía según el tipo:

        ingreso:
          { tipo, insumo_id, stock_id, cantidad, costo_unitario,
            origen, fecha_vencimiento (opcional), observacion (opcional) }

        salida:
          { tipo, insumo_id, stock_id, cantidad, destino,
            observacion (opcional) }

        merma:
          { tipo, insumo_id, stock_id, cantidad, causa,
            valor_perdido, porcentaje_perdida, observacion (opcional) }

        sobrerecuperada:
          { tipo, insumo_id, stock_id, cantidad, procedencia,
            observacion (opcional) }
        """
        data = request.data
        tipo = data.get('tipo', '').strip().lower()

        # ── Validaciones comunes ──────────────────────────────────
        if tipo not in TIPOS_VALIDOS:
            return Response(
                {'error': f'Tipo inválido. Opciones: {", ".join(TIPOS_VALIDOS)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not data.get('insumo_id'):
            return Response(
                {'error': 'Debe seleccionar un insumo'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not data.get('stock_id'):
            return Response(
                {'error': 'Debe seleccionar una ubicación de stock'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            cantidad = int(data.get('cantidad', 0))
        except (ValueError, TypeError):
            return Response(
                {'error': 'La cantidad debe ser un número entero'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if cantidad <= 0:
            return Response(
                {'error': 'La cantidad debe ser mayor a cero'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── Validaciones por tipo ────────────────────────────────
        if tipo == 'ingreso' and not data.get('origen'):
            return Response(
                {'error': 'El campo "origen" es requerido para ingresos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if tipo == 'salida' and not data.get('destino'):
            return Response(
                {'error': 'El campo "destino" es requerido para salidas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if tipo == 'merma':
            if not data.get('causa'):
                return Response(
                    {'error': 'El campo "causa" es requerido para mermas'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not data.get('valor_perdido'):
                return Response(
                    {'error': 'El campo "valor_perdido" es requerido para mermas'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if tipo == 'sobrerecuperada' and not data.get('procedencia'):
            return Response(
                {'error': 'El campo "procedencia" es requerido para sobrerecuperaciones'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # ── Construir payload base ───────────────────────────
            payload = {
                'tipo':       tipo,
                'insumo_id':  int(data.get('insumo_id')),
                'stock_id':   int(data.get('stock_id')),
                'cantidad':   cantidad,
                'fecha_mov':  data.get('fecha_mov', date.today().isoformat()),
                'usuario_id': str(request.user.id),
                'observacion': data.get('observacion', ''),
            }

            # ── Campos específicos por tipo ──────────────────────
            if tipo == 'ingreso':
                payload['origen'] = data.get('origen')
                if data.get('costo_unitario'):
                    payload['costo_unitario'] = float(data.get('costo_unitario'))
                if data.get('fecha_vencimiento'):
                    payload['fecha_vencimiento'] = data.get('fecha_vencimiento')

            elif tipo == 'salida':
                payload['destino'] = data.get('destino')

            elif tipo == 'merma':
                payload['causa'] = data.get('causa')
                payload['valor_perdido'] = float(data.get('valor_perdido'))
                if data.get('porcentaje_perdida'):
                    payload['porcentaje_perdida'] = float(data.get('porcentaje_perdida'))

            elif tipo == 'sobrerecuperada':
                payload['procedencia'] = data.get('procedencia')

            # ── Insertar — los triggers se ejecutan automáticamente ──
            response = supabase.table('movimiento_inventario').insert(payload).execute()

            if not response.data:
                return Response(
                    {'error': 'No se pudo registrar el movimiento'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            nuevo_movimiento = response.data[0]
            ip_cliente = obtener_ip_cliente(request)

            # ── Bitácora ─────────────────────────────────────────
            accion_bitacora = 'CREAR_MERMA' if tipo == 'merma' else 'CREAR_MOVIMIENTO'

            detalles_bitacora = {
                'ip': ip_cliente,
                'movimiento_id': nuevo_movimiento['id'],
                'tipo': tipo,
                'insumo_id': payload['insumo_id'],
                'cantidad': cantidad,
            }

            if tipo == 'merma':
                detalles_bitacora['causa'] = payload.get('causa')
                detalles_bitacora['valor_perdido'] = payload.get('valor_perdido')

            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion=accion_bitacora,
                detalles=detalles_bitacora
            )

            return Response(nuevo_movimiento, status=status.HTTP_201_CREATED)

        except Exception as e:
            error_str = str(e)
            logger.error(f"Error creando movimiento tipo '{tipo}': {error_str}")

            # Detectar error de trigger por stock insuficiente
            if 'stock insuficiente' in error_str.lower() or 'insufficient' in error_str.lower():
                return Response(
                    {'error': error_str},
                    status=status.HTTP_409_CONFLICT
                )

            return Response(
                {'error': 'Error al registrar el movimiento'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MovimientoDetailView(APIView):
    """
    GET /api/movimientos/{id}/  → Obtiene el detalle de un movimiento.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, movimiento_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            response = supabase.table('movimiento_inventario').select(
                '*, insumo:insumo_id(nombre, categoria)'
            ).eq('id', movimiento_id).execute()

            if not response.data:
                return Response(
                    {'error': 'Movimiento no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )

            movimiento = response.data[0]

            # Lookup manual de stock (sin FK formal en la BD)
            sid = movimiento.get('stock_id')
            if sid:
                stock_res = supabase.table('stock').select(
                    'id, cantidad, stock_min'
                ).eq('id', sid).execute()
                movimiento['stock'] = stock_res.data[0] if stock_res.data else None
            else:
                movimiento['stock'] = None

            return Response(movimiento, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error obteniendo movimiento {movimiento_id}: {str(e)}")
            return Response(
                {'error': 'Error al obtener el movimiento'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )