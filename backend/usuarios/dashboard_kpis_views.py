"""
============================================================
ARCHIVO: backend/usuarios/dashboard_kpis_views.py
CASO DE USO: CU29 - Visualizar Dashboard de KPIs
CICLO: 4
AUTOR: Mateo Hurtado
FECHA: 21/06/26
============================================================

DESCRIPCIÓN:
Calcula y consolida 5 indicadores clave del negocio en un solo
panel, reutilizando funciones de cálculo ya existentes de otros
CUs en lugar de reimplementar la lógica:

- Valor perdido acumulado  -> _calcular_reporte_valor_perdido() (CU25, Mateo)
- Margen promedio por plato -> _calcular_reporte_costos()       (CU27, Karen)
- Rotación de inventario    -> _calcular_reporte_rotacion()     (CU26, Adalid)
- Próximos a vencer         -> consulta propia (mismo criterio que CU24)
- Stock bajo                -> consulta propia sobre ALERTAS_STOCK

No se crea ninguna tabla nueva. Es un CU de solo lectura: no
registra bitácora, ya que se espera consulta de alta frecuencia
(carga de página, refresco manual) — mismo criterio aplicado a
ReporteCostosView (GET) en CU27, que tampoco audita la consulta.

Tablas consultadas (todas ya existentes, la mayoría vía funciones
importadas de otros archivos):
- MOVIMIENTO_INVENTARIO  (vía CU25 y CU26)
- STOCK                  (vía CU26)
- INSUMO                 (vía CU26)
- PLATO / RECETA / DETALLE_RECETA / FICHA_TECNICA / DETALLE_LOTE / LOTE (vía CU27)
- DETALLE_LOTE           (consulta propia, próximos a vencer)
- ALERTAS_STOCK          (consulta propia, stock bajo)

Correspondencia con el diagrama de secuencia (CICLO4_DIAGRAMS_SPEC_MATEO.md):
- F1 alt  [cálculo exitoso / sin datos suficientes] -> cada sub-KPI se calcula
          en su propio try/except para no tumbar el dashboard completo
- F2 loop [por cada uno de los últimos 6 meses]     -> construcción de la
          serie de tendencia de valor perdido

Sin fragmento `critical`: este CU no registra bitácora.
"""

import logging
from datetime import date

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from .reporte_valor_perdido_views import _calcular_reporte_valor_perdido  # CU25
from .reporte_costos_views import _calcular_reporte_costos                # CU27
from .reporte_rotacion_views import _calcular_reporte_rotacion            # CU26

logger = logging.getLogger(__name__)


def _mes_anterior(anio: int, mes: int) -> tuple:
    """Retorna (anio, mes) del mes calendario anterior, sin usar datetime.date
    para la resta (solo aritmética simple de enteros)."""
    if mes == 1:
        return anio - 1, 12
    return anio, mes - 1


def _calcular_valor_perdido_acumulado(supabase) -> dict:
    """
    F1 (alt) — sub-KPI 1: valor perdido del mes actual.
    Reutiliza _calcular_reporte_valor_perdido() de CU25, filtrando
    por el primer y último día del mes en curso.
    """
    hoy = date.today()
    primer_dia_mes = hoy.replace(day=1).isoformat()
    fecha_hasta = hoy.isoformat()

    reporte = _calcular_reporte_valor_perdido(
        supabase,
        fecha_desde=primer_dia_mes,
        fecha_hasta=fecha_hasta,
        insumo_id=None,
        agrupar_por='mes',
    )
    return {
        'valor': reporte['valor_perdido_total'],
        'total_eventos': reporte['total_eventos'],
    }


def _calcular_margen_promedio(supabase) -> dict:
    """
    F1 (alt) — sub-KPI 2: margen promedio por plato.
    Reutiliza _calcular_reporte_costos() de CU27 (sin filtro de plato),
    promediando el campo 'margen' de los platos que sí tienen margen
    calculable (precio_venta no nulo).
    """
    reporte = _calcular_reporte_costos(supabase, plato_id=None)
    con_margen = [r['margen'] for r in reporte if r['margen'] is not None]

    if not con_margen:
        return {'valor': None, 'total_platos': len(reporte)}

    promedio = round(sum(con_margen) / len(con_margen), 2)
    return {'valor': promedio, 'total_platos': len(reporte)}


def _promediar_rotacion_inventario(supabase) -> dict:
    """
    F1 (alt) — sub-KPI 3: rotación de inventario.

    Reutiliza _calcular_reporte_rotacion() de CU26, llamada SIN
    filtros de fecha (trae el histórico completo por insumo). No se
    reimplementa el cálculo de rotación: se promedia el campo
    'rotacion' que ya devuelve CU26, descartando los insumos con
    total_ingresado == 0 (CU26 los marca con rotacion=0.0 por diseño,
    y mezclarlos contaminaría el promedio con insumos que nunca
    circularon).

    Diferencia conceptual con CU26: CU26 mide rotación por insumo en
    un rango de fechas elegido por el usuario (reporte de detalle).
    CU29 usa la misma función sin filtro de fechas, agregando todos
    los insumos en un solo número (KPI de salud general).
    """
    reporte = _calcular_reporte_rotacion(
        supabase, fecha_desde=None, fecha_hasta=None, insumo_id=None
    )
    con_ingreso = [r for r in reporte if r['total_ingresado'] > 0]

    if not con_ingreso:
        return {'valor': None, 'total_insumos_considerados': 0}

    promedio = round(
        sum(r['rotacion'] for r in con_ingreso) / len(con_ingreso), 2
    )
    return {'valor': promedio, 'total_insumos_considerados': len(con_ingreso)}


def _calcular_proximos_a_vencer(supabase) -> dict:
    """
    F1 (alt) — sub-KPI 4: productos próximos a vencer.
    Mismo criterio que CU24: DETALLE_LOTE.fecha_vencimiento <= hoy + 7
    días. Se cuentan filas de detalle_lote (no insumos distintos),
    igual granularidad que CU24.
    """
    hoy = date.today()
    limite = date.fromordinal(hoy.toordinal() + 7).isoformat()

    response = supabase.table('detalle_lote') \
        .select('id', count='exact') \
        .lte('fecha_vencimiento', limite) \
        .gte('fecha_vencimiento', hoy.isoformat()) \
        .execute()

    return {'valor': response.count or 0}


def _calcular_stock_bajo(supabase) -> dict:
    """
    F1 (alt) — sub-KPI 5: alertas de stock bajo.

    AlertaConteoView (CU13) cuenta TODAS las alertas no leídas sin
    distinguir tipo (stock bajo + próximo a vencer mezclados), por lo
    que no se reutiliza tal cual para este KPI específico. Se hace una
    consulta propia, filtrando por el prefijo literal que genera el
    trigger verificar_stock_minimo() en la columna 'mensaje' de
    ALERTAS_STOCK: el mensaje siempre comienza con 'Stock bajo de '
    (ver función SQL verificar_stock_minimo()), mientras que las
    alertas de vencimiento siempre comienzan con 'Producto ' —
    prefijos disjuntos, por lo que el filtro ILIKE es seguro.
    """
    response = supabase.table('alertas_stock') \
        .select('id', count='exact') \
        .eq('leida', False) \
        .ilike('mensaje', 'Stock bajo de%') \
        .execute()

    return {'valor': response.count or 0}


def _calcular_tendencia_valor_perdido(supabase) -> list:
    """
    F2 (loop) — serie de tendencia: valor perdido de los últimos 6
    meses (incluyendo el actual), reutilizando _calcular_reporte_valor_perdido()
    de CU25 con agrupar_por='mes' y un rango de fechas que cubre los
    6 meses, en vez de hacer 6 llamadas separadas.
    """
    hoy = date.today()
    anio, mes = hoy.year, hoy.month
    for _ in range(5):
        anio, mes = _mes_anterior(anio, mes)
    fecha_desde = date(anio, mes, 1).isoformat()
    fecha_hasta = hoy.isoformat()

    reporte = _calcular_reporte_valor_perdido(
        supabase,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumo_id=None,
        agrupar_por='mes',
    )
    # por_periodo ya viene ordenado ascendente por _calcular_reporte_valor_perdido
    return reporte['por_periodo']


class DashboardKPIsView(APIView):
    """
    Endpoint para obtener los KPIs del dashboard en formato JSON.

    Método: GET
    URL: /api/dashboard/kpis/

    Respuesta exitosa (200):
    {
        "valor_perdido_acumulado": {"valor": float, "total_eventos": int} | {"valor": null, "error": str},
        "margen_promedio": {"valor": float|null, "total_platos": int} | {"valor": null, "error": str},
        "rotacion_inventario": {"valor": float|null, "total_insumos_considerados": int} | {"valor": null, "error": str},
        "proximos_a_vencer": {"valor": int} | {"valor": null, "error": str},
        "stock_bajo": {"valor": int} | {"valor": null, "error": str},
        "tendencia_valor_perdido": [ {"periodo": str, "valor_perdido": float}, ... ]
    }

    F1 (alt): cada sub-KPI se calcula en su propio try/except — si uno
    falla (ej. no hay datos de lotes), se marca con valor: null y un
    mensaje de error, sin bloquear el resto del dashboard.

    No registra bitácora (CU de solo lectura, alta frecuencia de consulta).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        kpis = {}

        # F1 — cada sub-KPI es independiente: un fallo no tumba el resto
        kpis['valor_perdido_acumulado'] = self._calcular_seguro(
            _calcular_valor_perdido_acumulado, supabase, "valor perdido acumulado"
        )
        kpis['margen_promedio'] = self._calcular_seguro(
            _calcular_margen_promedio, supabase, "margen promedio"
        )
        kpis['rotacion_inventario'] = self._calcular_seguro(
            _promediar_rotacion_inventario, supabase, "rotación de inventario"
        )
        kpis['proximos_a_vencer'] = self._calcular_seguro(
            _calcular_proximos_a_vencer, supabase, "próximos a vencer"
        )
        kpis['stock_bajo'] = self._calcular_seguro(
            _calcular_stock_bajo, supabase, "stock bajo"
        )

        # F2 — tendencia (loop de 6 meses resuelto en una sola llamada agregada)
        try:
            kpis['tendencia_valor_perdido'] = _calcular_tendencia_valor_perdido(supabase)
        except Exception as e:
            logger.error(f"Error calculando tendencia de valor perdido: {str(e)}")
            kpis['tendencia_valor_perdido'] = []

        return Response(kpis, status=status.HTTP_200_OK)

    def _calcular_seguro(self, func, supabase, nombre_kpi):
        """
        Envoltura común para el fragmento F1 (alt): ejecuta el cálculo
        de un sub-KPI y, si falla, devuelve un dict con valor: None y
        un mensaje de error, en vez de propagar la excepción y tumbar
        el endpoint completo.
        """
        try:
            return func(supabase)
        except Exception as e:
            logger.error(f"Error calculando KPI '{nombre_kpi}': {str(e)}")
            return {'valor': None, 'error': f"No se pudo calcular: {str(e)}"}