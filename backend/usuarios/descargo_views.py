"""
============================================================
ARCHIVO: backend/usuarios/descargo_views.py
CASO DE USO: CU16 - Generar Propuesta de Descargo Automático
CICLO: 4
AUTOR: Mateo Hurtado
FECHA: 21/06/26
============================================================

DESCRIPCIÓN:
A partir de los mismos datos de turno que el Chef ya ingresó en
CU15 (rango horario + unidades vendidas por plato, sin persistir),
el sistema calcula y propone automáticamente las salidas de
inventario correspondientes a los platos vendidos. El Chef revisa
la propuesta y confirma; solo entonces se ejecutan las salidas
reales en MOVIMIENTO_INVENTARIO.

Decisiones de diseño (cerradas en sesión — ver CICLO4_DIAGRAMS_SPEC_MATEO.md):

1. Relación con CU15: este CU NO vuelve a pedir los datos de turno al
   Chef. El frontend los recibe vía estado de navegación de React
   Router desde CierreTurno.tsx. El backend, para mantener el
   contrato más simple y seguro, RECALCULA el consumo teórico desde
   cero a partir de {hora_desde, hora_hasta, ventas} en vez de
   recibir la 'comparativa' ya calculada por CU15 (que traería campos
   irrelevantes para este CU y obligaría a revalidar datos de negocio
   veniddos del cliente sin garantía de que sigan vigentes).

2. Costeo SIN PEPS estricto por lote: DETALLE_LOTE no tiene un campo
   de cantidad restante por lote (solo la cantidad original que
   entró) y MOVIMIENTO_INVENTARIO no tiene lote_id. Replicar PEPS
   real exigiría rastrear consumo acumulado por lote, no viable sin
   cambiar el esquema. Se usa el MISMO criterio que CU27: costo
   unitario del DETALLE_LOTE cuyo LOTE.created_at es el más reciente
   por insumo_id (costo unitario vigente). La baja de stock se aplica
   contra STOCK en general, sin descontar de un lote específico.

3. Flujo de "propuesta" en 2 pasos (no ejecución automática directa):
   - GET  /api/descargo/            -> calcula la propuesta (no toca la BD)
   - POST /api/descargo/confirmar/  -> ejecuta las salidas (best-effort
     por insumo: el insumo sin stock suficiente se excluye y se reporta
     como error, pero NO bloquea el descargo del resto de insumos).

Reutilización: el cálculo de consumo teórico por insumo importa
_calcular_consumo_teorico() de cierre_turno_views.py (CU15) — no se
duplica la fórmula entre CU15 y CU16. El criterio de costo unitario
vigente se reimplementa aquí con la misma lógica que
_calcular_reporte_costos() de CU27 (no se importa directamente porque
esa función calcula costo POR PLATO con merma aplicada; CU16 necesita
solo el costo unitario vigente POR INSUMO, sin merma, para valorizar
el descargo — son usos distintos del mismo criterio, no la misma
función).

Tablas consultadas (todas ya existentes):
- RECETA / DETALLE_RECETA   (vía _calcular_consumo_teorico, CU15)
- DETALLE_LOTE / LOTE       (costo unitario vigente)
- STOCK                     (validar disponibilidad antes de confirmar)
- MOVIMIENTO_INVENTARIO     (INSERT de salidas al confirmar)

Bitácora: CONFIRMAR_DESCARGO_AUTOMATICO, solo en la confirmación
(POST), nunca en el cálculo de la propuesta (GET).
"""

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from .cierre_turno_views import _calcular_consumo_teorico  # CU15

logger = logging.getLogger(__name__)


def _resolver_costo_unitario_vigente(supabase, insumo_ids):
    """
    Mismo criterio que _calcular_reporte_costos() de CU27: para cada
    insumo, el costo_unitario del DETALLE_LOTE cuyo LOTE.created_at
    es el más reciente. No es PEPS real (no rastrea cuánto queda de
    cada lote) — es el "costo vigente", usado aquí para valorizar el
    descargo en bolivianos, no para decidir de qué lote físico sale
    la mercadería.

    Returns:
        dict[int, float]: insumo_id -> costo_unitario vigente.
    """
    if not insumo_ids:
        return {}

    detalle_lotes = supabase.table('detalle_lote') \
        .select('insumo_id, costo_unitario, lote:lote_id(created_at)') \
        .in_('insumo_id', insumo_ids) \
        .execute().data or []

    costo_unitario_por_insumo = {}
    mas_reciente_por_insumo = {}  # insumo_id -> created_at string

    for dl in detalle_lotes:
        insumo_id = dl['insumo_id']
        lote_info = dl.get('lote') or {}
        created_at = lote_info.get('created_at')
        if not created_at:
            continue
        if (
            insumo_id not in mas_reciente_por_insumo
            or created_at > mas_reciente_por_insumo[insumo_id]
        ):
            mas_reciente_por_insumo[insumo_id] = created_at
            costo_unitario_por_insumo[insumo_id] = float(dl['costo_unitario'])

    return costo_unitario_por_insumo


def _obtener_stock_actual(supabase, insumo_ids):
    """
    Devuelve, por insumo, el stock_id y la cantidad actual disponible.
    Si un insumo tiene más de una fila en STOCK (no debería, pero no
    se asume), se suman las cantidades y se usa el primer stock_id
    encontrado para el INSERT del movimiento de salida.

    Returns:
        dict[int, dict]: insumo_id -> {"stock_id": int, "cantidad": float}
    """
    if not insumo_ids:
        return {}

    filas_stock = supabase.table('stock') \
        .select('id, insumo_id, cantidad') \
        .in_('insumo_id', insumo_ids) \
        .execute().data or []

    stock_por_insumo = {}
    for s in filas_stock:
        insumo_id = s['insumo_id']
        if insumo_id not in stock_por_insumo:
            stock_por_insumo[insumo_id] = {
                'stock_id': s['id'],
                'cantidad': float(s['cantidad']),
            }
        else:
            stock_por_insumo[insumo_id]['cantidad'] += float(s['cantidad'])

    return stock_por_insumo


def _extraer_ventas_validas(data):
    """
    F1 (alt) — valida y normaliza el payload de ventas, común a GET
    (query params) y POST (body JSON).

    Args:
        data: lista de dicts [{"plato_id": int, "unidades": number}, ...]

    Returns:
        tuple(plato_ids, unidades_por_plato) si es válido.

    Raises:
        ValueError con mensaje de usuario si no hay ventas válidas.
    """
    if not isinstance(data, list):
        raise ValueError("El formato de ventas no es válido")

    ventas_validas = [v for v in data if isinstance(v, dict) and v.get('unidades', 0) > 0]

    if not ventas_validas:
        raise ValueError("No hay platos vendidos para calcular el descargo")

    plato_ids = [v['plato_id'] for v in ventas_validas]
    unidades_por_plato = {v['plato_id']: v['unidades'] for v in ventas_validas}
    return plato_ids, unidades_por_plato


def _construir_propuesta(supabase, plato_ids, unidades_por_plato):
    """
    Flujo 1 (GET) — calcula la propuesta de descargo SIN tocar la
    base de datos: consumo teórico por insumo (CU15), costo unitario
    vigente (criterio de CU27) y cruce contra stock actual para
    anticipar qué insumos tendrán problema de stock insuficiente.

    Returns:
        dict con la estructura de PropuestaDescargo (ver docstring
        de DescargoAutomaticoView).
    """
    # F2 (loop, implícito): _calcular_consumo_teorico ya itera internamente
    # sobre detalle_receta por cada insumo.
    consumo_teorico, platos_sin_receta = _calcular_consumo_teorico(
        supabase, plato_ids, unidades_por_plato
    )

    insumo_ids = list(consumo_teorico.keys())
    costo_unitario_por_insumo = _resolver_costo_unitario_vigente(supabase, insumo_ids)
    stock_por_insumo = _obtener_stock_actual(supabase, insumo_ids)

    # Nombres de insumo para mostrar en la propuesta
    nombres_insumo = {}
    if insumo_ids:
        insumos_response = supabase.table('insumo') \
            .select('id, nombre') \
            .in_('id', insumo_ids) \
            .execute().data or []
        nombres_insumo = {i['id']: i['nombre'] for i in insumos_response}

    items = []
    valor_total = 0.0
    insumos_con_problema = []

    for insumo_id, cantidad_requerida in consumo_teorico.items():
        cantidad_requerida = round(cantidad_requerida, 2)
        costo_unitario = costo_unitario_por_insumo.get(insumo_id)
        info_stock = stock_por_insumo.get(insumo_id)
        stock_actual = info_stock['cantidad'] if info_stock else 0.0

        costo_unitario_disponible = costo_unitario is not None
        valor_estimado = round(cantidad_requerida * (costo_unitario or 0.0), 2)

        stock_suficiente = info_stock is not None and stock_actual >= cantidad_requerida

        if not stock_suficiente:
            insumos_con_problema.append(insumo_id)
        else:
            valor_total += valor_estimado

        items.append({
            'insumo_id': insumo_id,
            'insumo_nombre': nombres_insumo.get(insumo_id, 'Desconocido'),
            'cantidad_a_descargar': cantidad_requerida,
            'costo_unitario_vigente': costo_unitario,
            'costo_unitario_disponible': costo_unitario_disponible,
            'valor_estimado': valor_estimado,
            'stock_actual': round(stock_actual, 2),
            'stock_suficiente': stock_suficiente,
        })

    items.sort(key=lambda x: x['insumo_nombre'])

    return {
        'items': items,
        'valor_total_estimado': round(valor_total, 2),
        'total_insumos': len(items),
        'total_insumos_con_problema': len(insumos_con_problema),
        'platos_sin_receta': platos_sin_receta,
    }


class DescargoAutomaticoView(APIView):
    """
    Endpoint para calcular la propuesta de descargo automático.
    NO modifica la base de datos — solo calcula y muestra.

    Método: GET
    URL: /api/descargo/
    Query params (mismo formato que CU15):
        - ventas (obligatorio, JSON string: [{"plato_id": 1, "unidades": 5}, ...])

    Nota: a diferencia de CU15, este endpoint NO requiere hora_desde
    ni hora_hasta — esos datos solo sirven para calcular el consumo
    REAL (que es exclusivo de la comparativa de CU15); CU16 solo
    necesita las unidades vendidas por plato para calcular el
    consumo TEÓRICO a descargar.

    Respuesta exitosa (200):
    {
        "items": [
            {
                "insumo_id": int,
                "insumo_nombre": str,
                "cantidad_a_descargar": float,
                "costo_unitario_vigente": float | null,
                "costo_unitario_disponible": bool,
                "valor_estimado": float,
                "stock_actual": float,
                "stock_suficiente": bool
            }, ...
        ],
        "valor_total_estimado": float,
        "total_insumos": int,
        "total_insumos_con_problema": int,
        "platos_sin_receta": [ {"plato_id": int, "plato_nombre": str}, ... ]
    }

    No registra bitácora (es el Flujo 1 — cálculo, no acción de negocio).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import json

        ventas_raw = request.query_params.get('ventas')
        try:
            ventas = json.loads(ventas_raw) if ventas_raw else []
        except (ValueError, TypeError):
            return Response(
                {'error': 'El formato de ventas no es válido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # F1 (alt) — validar que llegaron datos de turno
        try:
            plato_ids, unidades_por_plato = _extraer_ventas_validas(ventas)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            propuesta = _construir_propuesta(supabase, plato_ids, unidades_por_plato)
            return Response(propuesta, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error calculando propuesta de descargo: {str(e)}")
            return Response(
                {'error': f'Error al calcular la propuesta de descargo: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ConfirmarDescargoView(APIView):
    """
    Endpoint para confirmar y ejecutar el descargo automático.
    Inserta movimientos de salida en MOVIMIENTO_INVENTARIO.

    Método: POST
    URL: /api/descargo/confirmar/
    Body:
    {
        "ventas": [{"plato_id": 1, "unidades": 5}, ...]
    }

    Flujo:
    1. Recalcula la propuesta internamente (no confía en valores que
       el cliente pudiera enviar para 'cantidad_a_descargar' o
       'costo_unitario_vigente' — se vuelve a calcular del lado del
       servidor, igual principio que cualquier operación de escritura
       que involucre dinero o stock).
    2. Para cada insumo CON stock suficiente (F3 loop, F4 alt anidado):
       INSERT en MOVIMIENTO_INVENTARIO tipo='salida'. Los triggers ya
       existentes (trg_actualizar_stock, trg_validar_stock_suficiente,
       alertas) actúan como salvaguarda final.
    3. Los insumos SIN stock suficiente se excluyen de la inserción y
       se reportan en 'insumos_excluidos' — el descargo es parcial
       (best-effort), no todo-o-nada.
    4. Se registra bitácora UNA SOLA VEZ al final (F5 critical), con
       el resumen de insumos descargados y su valor total.

    Respuesta exitosa (200):
    {
        "insumos_descargados": [ {"insumo_id": int, "insumo_nombre": str,
                                    "cantidad": float, "valor": float}, ... ],
        "insumos_excluidos": [ {"insumo_id": int, "insumo_nombre": str,
                                  "motivo": str}, ... ],
        "valor_total_descargado": float
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ventas = request.data.get('ventas')

        # F1 (alt) — validar que llegaron datos de turno
        try:
            plato_ids, unidades_por_plato = _extraer_ventas_validas(ventas or [])
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Recalcular la propuesta server-side (no confiar en el cliente)
            propuesta = _construir_propuesta(supabase, plato_ids, unidades_por_plato)

            stock_por_insumo = _obtener_stock_actual(
                supabase, [item['insumo_id'] for item in propuesta['items']]
            )

            insumos_descargados = []
            insumos_excluidos = []
            valor_total_descargado = 0.0

            # F3 (loop) — por cada insumo sin problema de stock detectado
            for item in propuesta['items']:
                insumo_id = item['insumo_id']

                # F4 (alt anidado) — stock suficiente / insuficiente
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
                        'cantidad': item['cantidad_a_descargar'],
                        'destino': 'Descargo automático por venta',
                    }).execute()

                    insumos_descargados.append({
                        'insumo_id': insumo_id,
                        'insumo_nombre': item['insumo_nombre'],
                        'cantidad': item['cantidad_a_descargar'],
                        'valor': item['valor_estimado'],
                    })
                    valor_total_descargado += item['valor_estimado']

                except Exception as e:
                    # El trigger trg_validar_stock_suficiente (u otro) rechazó
                    # el INSERT pese a la validación previa — no se bloquea
                    # el resto del descargo, se reporta como excluido.
                    logger.error(
                        f"Error insertando salida para insumo {insumo_id}: {str(e)}"
                    )
                    insumos_excluidos.append({
                        'insumo_id': insumo_id,
                        'insumo_nombre': item['insumo_nombre'],
                        'motivo': f'Error al registrar la salida: {str(e)}',
                    })

            valor_total_descargado = round(valor_total_descargado, 2)

            # F5 (critical) — registro de bitácora atómico, una sola vez
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CONFIRMAR_DESCARGO_AUTOMATICO",
                detalles={
                    "ip": ip_cliente,
                    "insumos_descargados": insumos_descargados,
                    "insumos_excluidos": insumos_excluidos,
                    "valor_total_descargado": valor_total_descargado,
                }
            )

            return Response({
                'insumos_descargados': insumos_descargados,
                'insumos_excluidos': insumos_excluidos,
                'valor_total_descargado': valor_total_descargado,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error confirmando descargo automático: {str(e)}")
            return Response(
                {'error': f'Error al confirmar el descargo: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )