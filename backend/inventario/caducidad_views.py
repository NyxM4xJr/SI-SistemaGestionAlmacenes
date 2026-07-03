# ============================================================
# ARCHIVO: backend/inventario/caducidad_views.py
# CASO DE USO: CU34 - Gestión de Caducidad FEFO (informativo)
# CICLO: 5
# FECHA: 03/07/26
#
# DESCRIPCIÓN:
#   Lista los detalles de lote ordenados por fecha de vencimiento
#   ascendente (FEFO: First Expired, First Out) y clasifica cada
#   uno como vencido / por vencer / ok. Es INFORMATIVO: no rastrea
#   consumo real por lote (el sistema no tiene cantidad restante por
#   lote ni lote_id en movimiento_inventario). El registro de merma
#   por vencimiento se hace reutilizando el CU14 (POST /movimientos/
#   con tipo='merma'), no se crea endpoint nuevo aquí.
#
# ENDPOINTS:
#   GET /api/caducidad/        → lista FEFO con estado calculado
#     ?dias=N  → ventana (días) para marcar "por_vencer" (default 7)
# ============================================================

import logging
from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

logger = logging.getLogger(__name__)

DIAS_VENTANA_DEFAULT = 7


class CaducidadListView(APIView):
    """
    GET /api/caducidad/  → Detalles de lote ordenados FEFO.

    Cada ítem incluye estado calculado en backend:
      - 'vencido'    → fecha_vencimiento < hoy
      - 'por_vencer' → hoy <= fecha_vencimiento <= hoy + dias
      - 'ok'         → fecha_vencimiento > hoy + dias
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Ventana de "por vencer"
        try:
            dias = int(request.query_params.get('dias', DIAS_VENTANA_DEFAULT))
            if dias < 0:
                dias = DIAS_VENTANA_DEFAULT
        except (TypeError, ValueError):
            dias = DIAS_VENTANA_DEFAULT

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Detalle de lote con datos necesarios para mostrar y registrar merma
            response = (
                supabase.table('detalle_lote')
                .select(
                    'id, lote_id, insumo_id, stock_id, cantidad, costo_unitario, '
                    'fecha_vencimiento, insumo:insumo_id(nombre), lote:lote_id(fecha_ing)'
                )
                .order('fecha_vencimiento', desc=False)
                .execute()
            )
            detalles = response.data or []

            hoy = date.today()
            limite = hoy + timedelta(days=dias)

            resultado = []
            for d in detalles:
                fv_str = d.get('fecha_vencimiento')
                estado = 'ok'
                dias_restantes = None
                if fv_str:
                    try:
                        fv = date.fromisoformat(fv_str)
                        dias_restantes = (fv - hoy).days
                        if fv < hoy:
                            estado = 'vencido'
                        elif fv <= limite:
                            estado = 'por_vencer'
                    except ValueError:
                        estado = 'ok'

                resultado.append({
                    'id': d.get('id'),
                    'lote_id': d.get('lote_id'),
                    'insumo_id': d.get('insumo_id'),
                    'stock_id': d.get('stock_id'),
                    'cantidad': d.get('cantidad'),
                    'costo_unitario': d.get('costo_unitario'),
                    'fecha_vencimiento': fv_str,
                    'fecha_ing': (d.get('lote') or {}).get('fecha_ing'),
                    'insumo_nombre': (d.get('insumo') or {}).get('nombre'),
                    'estado': estado,
                    'dias_restantes': dias_restantes,
                })

            # Ya vienen ordenados por fecha_vencimiento asc (FEFO)
            return Response(
                {
                    'dias_ventana': dias,
                    'total': len(resultado),
                    'vencidos': sum(1 for r in resultado if r['estado'] == 'vencido'),
                    'por_vencer': sum(1 for r in resultado if r['estado'] == 'por_vencer'),
                    'items': resultado,
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error en CaducidadListView: {str(e)}")
            return Response(
                {'error': 'Error al obtener la información de caducidad.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
