# ============================================================
# ARCHIVO: backend/usuarios/alerta_views.py
# CASO DE USO: CU13 - Gestionar Alertas
# CICLO: 3
# FECHA: 01/06/26
# AUTOR: Mateo Hurtado
#
# DESCRIPCIÓN:
#   Gestiona las alertas generadas automáticamente por los
#   triggers de la BD al insertar en MOVIMIENTO_INVENTARIO:
#     - trg_verificar_stock_minimo     → alerta de stock bajo
#     - trg_verificar_proximos_vencer  → alerta de próximo a vencer
#
#   CU13 NO crea alertas manualmente. Solo lista y marca como leída.
#
# ENDPOINTS:
#   GET   /api/alertas/        → listar alertas con filtros opcionales
#   GET   /api/alertas/conteo/ → conteo de alertas no leídas (para badge)
#   PATCH /api/alertas/{id}/   → marcar una alerta como leída
#
# BITÁCORA:
#   MARCAR_ALERTA_LEIDA → cuando el usuario marca una alerta
# ============================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
from bitacora.utils import registrar_accion, obtener_ip_cliente
import logging

logger = logging.getLogger(__name__)


class AlertaListView(APIView):
    """
    GET /api/alertas/  → Lista alertas con filtros opcionales.

    Filtros GET (query params):
      ?leida=true|false
      ?stock_id=1
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # JOIN a stock (tiene FK formal) y de stock a insumo
            query = supabase.table('alertas_stock').select(
                '*, stock:stock_id(id, cantidad, stock_min, insumo:insumo_id(nombre))'
            ).order('fecha', desc=True)

            # Filtro por estado de lectura
            leida = request.query_params.get('leida')
            if leida is not None:
                query = query.eq('leida', leida.lower() == 'true')

            # Filtro por stock_id
            stock_id = request.query_params.get('stock_id')
            if stock_id:
                query = query.eq('stock_id', int(stock_id))

            response = query.execute()

            return Response(response.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error listando alertas: {str(e)}")
            return Response(
                {'error': 'Error al obtener las alertas'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AlertaConteoView(APIView):
    """
    GET /api/alertas/conteo/  → Devuelve el conteo de alertas no leídas.
    Usado por AppHeader para mostrar el badge de campana.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            response = supabase.table('alertas_stock').select(
                'id', count='exact'
            ).eq('leida', False).execute()

            return Response(
                {'conteo': response.count or 0},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error contando alertas: {str(e)}")
            return Response(
                {'conteo': 0},
                status=status.HTTP_200_OK
            )


class AlertaDetailView(APIView):
    """
    PATCH /api/alertas/{id}/  → Marca una alerta como leída.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, alerta_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que la alerta existe
            check = supabase.table('alertas_stock').select(
                'id, leida, mensaje'
            ).eq('id', alerta_id).execute()

            if not check.data:
                return Response(
                    {'error': 'Alerta no encontrada'},
                    status=status.HTTP_404_NOT_FOUND
                )

            alerta = check.data[0]

            if alerta['leida']:
                return Response(
                    {'error': 'La alerta ya está marcada como leída'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Marcar como leída
            supabase.table('alertas_stock').update(
                {'leida': True}
            ).eq('id', alerta_id).execute()

            # Obtener nuevo conteo de no leídas
            conteo_res = supabase.table('alertas_stock').select(
                'id', count='exact'
            ).eq('leida', False).execute()

            nuevo_conteo = conteo_res.count or 0

            # Bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion='MARCAR_ALERTA_LEIDA',
                detalles={
                    'ip': ip_cliente,
                    'alerta_id': alerta_id,
                    'mensaje': alerta.get('mensaje', ''),
                }
            )

            return Response(
                {
                    'id': alerta_id,
                    'leida': True,
                    'nuevo_conteo': nuevo_conteo,
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error marcando alerta {alerta_id}: {str(e)}")
            return Response(
                {'error': 'Error al marcar la alerta como leída'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )