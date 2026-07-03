"""
============================================================
ARCHIVO: backend/usuarios/cierre_turno_views.py
CASO DE USO: CU15 - Validar Cierre de Turno
CICLO: 4
============================================================

DESCRIPCIÓN:
No existe tabla TURNO ni tabla de ventas en la base de datos.
El Chef ingresa manualmente, en el propio formulario, cuántas
unidades de cada plato (catálogo de CU20) se vendieron en un
rango horario. El backend usa esas cantidades junto con las
recetas (CU21) para calcular el consumo TEÓRICO por insumo, y
lo compara contra el consumo REAL extraído de los movimientos
de salida (CU14) registrados en ese mismo rango horario.

No se crea ninguna tabla nueva. La validación del cierre solo
registra el resumen en DETALLE_BITACORA, no modifica ninguna
tabla de negocio.

Tablas consultadas (todas ya existentes):
- RECETA          (plato_id FK -> PLATO)
- DETALLE_RECETA  (receta_id FK -> RECETA, insumo_id FK -> INSUMO)
- MOVIMIENTO_INVENTARIO (insumo_id FK -> INSUMO)
- INSUMO          (para mostrar el nombre)

------------------------------------------------------------
NOTA DE REFACTOR (CU16, Ciclo 4 — Mateo, 21/06/26):
La lógica de cálculo de consumo teórico (RECETA + DETALLE_RECETA
multiplicado por unidades vendidas) se extrajo a la función
compartida _calcular_consumo_teorico(), para que CU16 (Descargo
Automático) la reutilice sin duplicar código, siguiendo el mismo
patrón ya usado por CU24 al importar _calcular_reporte_costos()
de CU27. El comportamiento de CierreTurnoView.get() NO cambia:
solo se reorganizó el cálculo en una función aparte.
------------------------------------------------------------
"""

import json
import logging
from datetime import datetime

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)


def _hora_en_rango(timestamp_str, hora_desde, hora_hasta):
    """
    Verifica si la hora de un timestamp (created_at) cae dentro del
    rango [hora_desde, hora_hasta]. Se parsea manualmente el string
    para evitar el mismo problema de conversión UTC que afectó las
    estadísticas de CU14 (ver INFORME_CICLO3_MATEO.md, sección de
    correcciones aplicadas).

    timestamp_str: string ISO devuelto por Supabase, ej "2026-06-19T14:35:00"
    hora_desde / hora_hasta: strings "HH:MM"
    """
    try:
        # Se toma solo la parte de la hora del timestamp, sin pasar por
        # new Date()/datetime con zona horaria.
        parte_hora = timestamp_str.split("T")[1][:5]  # "HH:MM"
        return hora_desde <= parte_hora <= hora_hasta
    except (IndexError, AttributeError):
        return False


def _calcular_consumo_teorico(supabase, plato_ids, unidades_por_plato):
    """
    Función compartida entre CU15 (CierreTurnoView) y CU16
    (DescargoAutomaticoView). Calcula, para una lista de platos
    vendidos con sus unidades, el consumo teórico acumulado por
    insumo: Σ (detalle_receta.cantidad × unidades_vendidas_del_plato).

    Args:
        supabase: cliente de Supabase ya creado.
        plato_ids (list[int]): IDs de los platos vendidos (con unidades > 0).
        unidades_por_plato (dict[int, float]): plato_id -> unidades vendidas.

    Returns:
        tuple(consumo_teorico, platos_sin_receta):
            consumo_teorico (dict[int, float]): insumo_id -> cantidad acumulada.
            platos_sin_receta (list[dict]): [{"plato_id": int, "plato_nombre": str}, ...]
    """
    recetas_response = supabase.table('receta') \
        .select('id, plato_id, plato:plato_id(nombre)') \
        .in_('plato_id', plato_ids) \
        .execute()
    recetas = recetas_response.data or []

    platos_con_receta = {r['plato_id'] for r in recetas}
    plato_ids_sin_receta = [
        pid for pid in plato_ids if pid not in platos_con_receta
    ]
    platos_sin_receta = []
    if plato_ids_sin_receta:
        platos_sr_response = supabase.table('plato') \
            .select('id, nombre') \
            .in_('id', plato_ids_sin_receta) \
            .execute()
        platos_sin_receta = [
            {'plato_id': p['id'], 'plato_nombre': p['nombre']}
            for p in (platos_sr_response.data or [])
        ]

    consumo_teorico = {}  # insumo_id -> cantidad acumulada

    if recetas:
        receta_ids = [r['id'] for r in recetas]
        receta_a_plato = {r['id']: r['plato_id'] for r in recetas}

        detalles_response = supabase.table('detalle_receta') \
            .select('receta_id, insumo_id, cantidad') \
            .in_('receta_id', receta_ids) \
            .execute()
        detalles = detalles_response.data or []

        for d in detalles:
            plato_id = receta_a_plato.get(d['receta_id'])
            unidades_vendidas = unidades_por_plato.get(plato_id, 0)
            cantidad_total = float(d['cantidad']) * unidades_vendidas
            insumo_id = d['insumo_id']
            consumo_teorico[insumo_id] = consumo_teorico.get(insumo_id, 0) + cantidad_total

    return consumo_teorico, platos_sin_receta


class CierreTurnoView(APIView):
    """
    Endpoint para calcular la comparativa de consumo teórico vs real
    de un turno.

    Método: GET
    URL: /api/cierre-turno/
    Query params:
        - hora_desde (obligatorio, formato "HH:MM")
        - hora_hasta (obligatorio, formato "HH:MM")
        - ventas (obligatorio, JSON string: [{"plato_id": 1, "unidades": 5}, ...])

    Flujo:
    1. Valida que hora_desde < hora_hasta.
    2. Valida que exista al menos un plato con unidades > 0.
    3. Consulta RECETA + DETALLE_RECETA de los platos vendidos -> consumo teórico
       (vía _calcular_consumo_teorico, compartida con CU16).
    4. Consulta MOVIMIENTO_INVENTARIO (tipo=salida, fecha_mov=hoy, hora en rango) -> consumo real.
    5. Cruza ambos resultados por insumo_id y calcula diferencia y % de diferencia.

    Respuesta exitosa (200):
    {
        "hora_desde": "08:00",
        "hora_hasta": "16:00",
        "comparativa": [
            {
                "insumo_id": 3,
                "insumo_nombre": "Pollo",
                "consumo_teorico": 12.5,
                "consumo_real": 14.0,
                "diferencia": 1.5,
                "porcentaje_diferencia": 12.0
            }
        ],
        "platos_sin_receta": [ {"plato_id": 9, "plato_nombre": "..."} ]
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hora_desde = request.query_params.get('hora_desde')
        hora_hasta = request.query_params.get('hora_hasta')
        ventas_raw = request.query_params.get('ventas')

        if not hora_desde or not hora_hasta:
            return Response(
                {'error': 'hora_desde y hora_hasta son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if hora_desde >= hora_hasta:
            return Response(
                {'error': 'El rango horario no es válido (hora_desde debe ser menor a hora_hasta)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            ventas = json.loads(ventas_raw) if ventas_raw else []
        except (json.JSONDecodeError, TypeError):
            return Response(
                {'error': 'El formato de ventas no es válido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Filtrar solo platos con unidades > 0
        ventas_validas = [v for v in ventas if v.get('unidades', 0) > 0]

        if not ventas_validas:
            return Response(
                {'error': 'Debe ingresar al menos un plato vendido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            plato_ids = [v['plato_id'] for v in ventas_validas]
            unidades_por_plato = {v['plato_id']: v['unidades'] for v in ventas_validas}

            # 1) Consumo teórico (función compartida con CU16)
            consumo_teorico, platos_sin_receta = _calcular_consumo_teorico(
                supabase, plato_ids, unidades_por_plato
            )

            # 2) Consumo real: MOVIMIENTO_INVENTARIO tipo=salida del día actual
            hoy = datetime.now().strftime('%Y-%m-%d')

            movimientos_response = supabase.table('movimiento_inventario') \
                .select('insumo_id, cantidad, created_at, insumo:insumo_id(nombre)') \
                .eq('tipo', 'salida') \
                .eq('fecha_mov', hoy) \
                .execute()
            movimientos = movimientos_response.data or []

            consumo_real = {}  # insumo_id -> cantidad acumulada
            nombres_insumo = {}

            for m in movimientos:
                created_at = m.get('created_at', '')
                if not _hora_en_rango(created_at, hora_desde, hora_hasta):
                    continue
                insumo_id = m['insumo_id']
                consumo_real[insumo_id] = consumo_real.get(insumo_id, 0) + float(m['cantidad'])
                if m.get('insumo'):
                    nombres_insumo[insumo_id] = m['insumo'].get('nombre')

            # Completar nombres de insumos que aparecen solo en consumo_teorico
            insumos_faltantes = [i for i in consumo_teorico.keys() if i not in nombres_insumo]
            if insumos_faltantes:
                insumos_response = supabase.table('insumo') \
                    .select('id, nombre') \
                    .in_('id', insumos_faltantes) \
                    .execute()
                for i in (insumos_response.data or []):
                    nombres_insumo[i['id']] = i['nombre']

            # 3) Cruzar ambos diccionarios por insumo_id
            todos_los_insumos = set(consumo_teorico.keys()) | set(consumo_real.keys())
            comparativa = []

            for insumo_id in todos_los_insumos:
                teorico = round(consumo_teorico.get(insumo_id, 0), 2)
                real = round(consumo_real.get(insumo_id, 0), 2)
                diferencia = round(real - teorico, 2)
                porcentaje_diferencia = round((abs(diferencia) / teorico) * 100, 2) if teorico > 0 else (
                    100.0 if real > 0 else 0.0
                )

                comparativa.append({
                    'insumo_id': insumo_id,
                    'insumo_nombre': nombres_insumo.get(insumo_id, 'Desconocido'),
                    'consumo_teorico': teorico,
                    'consumo_real': real,
                    'diferencia': diferencia,
                    'porcentaje_diferencia': porcentaje_diferencia,
                })

            comparativa.sort(key=lambda x: x['porcentaje_diferencia'], reverse=True)

            return Response({
                'hora_desde': hora_desde,
                'hora_hasta': hora_hasta,
                'comparativa': comparativa,
                'platos_sin_receta': platos_sin_receta,
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error calculando cierre de turno: {str(e)}")
            return Response(
                {'error': f'Error al calcular la comparativa: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ValidarCierreTurnoView(APIView):
    """
    Endpoint para que el Chef valide (confirme) el cierre de turno.
    No modifica ninguna tabla de negocio — únicamente deja constancia
    en la bitácora del resumen completo de la comparativa.

    Método: POST
    URL: /api/cierre-turno/validar/
    Body:
    {
        "hora_desde": "08:00",
        "hora_hasta": "16:00",
        "comparativa": [ ... ],  // mismo arreglo devuelto por el GET
        "observacion": "..."     // opcional
    }

    Respuesta exitosa (200):
    { "message": "Cierre de turno validado exitosamente" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        hora_desde = request.data.get('hora_desde')
        hora_hasta = request.data.get('hora_hasta')
        comparativa = request.data.get('comparativa')
        observacion = request.data.get('observacion', '')

        if not hora_desde or not hora_hasta or comparativa is None:
            return Response(
                {'error': 'hora_desde, hora_hasta y comparativa son requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            total_diferencias = sum(
                1 for item in comparativa if item.get('diferencia', 0) != 0
            )

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="VALIDAR_CIERRE_TURNO",
                detalles={
                    "ip": ip_cliente,
                    "hora_desde": hora_desde,
                    "hora_hasta": hora_hasta,
                    "comparativa": comparativa,
                    "total_insumos_con_diferencia": total_diferencias,
                    "observacion": observacion,
                }
            )

            return Response({
                'message': 'Cierre de turno validado exitosamente'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error validando cierre de turno: {str(e)}")
            return Response(
                {'error': f'Error al validar el cierre de turno: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )