import logging
from datetime import date

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from .reporte_valor_perdido_views import _calcular_reporte_valor_perdido
from .reporte_costos_views import _calcular_reporte_costos
from .reporte_rotacion_views import _calcular_reporte_rotacion

logger = logging.getLogger(__name__)


def _calcular_valor_perdido_acumulado(supabase) -> dict:
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
    reporte = _calcular_reporte_costos(supabase, plato_id=None)
    con_margen = [r['margen'] for r in reporte if r['margen'] is not None]

    if not con_margen:
        return {'valor': None, 'total_platos': len(reporte)}

    promedio = round(sum(con_margen) / len(con_margen), 2)
    return {'valor': promedio, 'total_platos': len(reporte)}


def _promediar_rotacion_inventario(supabase) -> dict:
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
    hoy = date.today()
    limite = date.fromordinal(hoy.toordinal() + 7).isoformat()

    response = supabase.table('detalle_lote') \
        .select('id', count='exact') \
        .lte('fecha_vencimiento', limite) \
        .gte('fecha_vencimiento', hoy.isoformat()) \
        .execute()

    return {'valor': response.count or 0}


def _calcular_stock_bajo(supabase) -> dict:
    response = supabase.table('alertas_stock') \
        .select('id', count='exact') \
        .eq('leida', False) \
        .ilike('mensaje', 'Stock bajo de%') \
        .execute()

    return {'valor': response.count or 0}


def _calcular_tendencia_valor_perdido(supabase) -> list:
    hoy = date.today()
    fecha_desde = hoy.replace(day=1).isoformat()
    fecha_hasta = hoy.isoformat()

    reporte = _calcular_reporte_valor_perdido(
        supabase,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        insumo_id=None,
        agrupar_por='dia',
    )
    return reporte['por_periodo']


class DashboardKPIsView(APIView):
    """GET /api/dashboard/kpis/ — consolida los KPIs del panel principal."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        kpis = {}

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

        try:
            kpis['tendencia_valor_perdido'] = _calcular_tendencia_valor_perdido(supabase)
        except Exception as e:
            logger.error(f"Error calculando tendencia de valor perdido: {str(e)}")
            kpis['tendencia_valor_perdido'] = []

        return Response(kpis, status=status.HTTP_200_OK)

    def _calcular_seguro(self, func, supabase, nombre_kpi):
        try:
            return func(supabase)
        except Exception as e:
            logger.error(f"Error calculando KPI '{nombre_kpi}': {str(e)}")
            return {'valor': None, 'error': f"No se pudo calcular: {str(e)}"}
