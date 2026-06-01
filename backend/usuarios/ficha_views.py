# ============================================================
# ARCHIVO: backend/usuarios/ficha_views.py
# CASO DE USO: CU08 - Consultar Ficha Técnica Digital
#              CU22 - Configurar Porcentaje de Merma Técnica
# CICLO: 2 / 3
# FECHA: 01/06/26
# AUTOR: Karen Ortega Mancilla
# DESCRIPCIÓN: GET devuelve el insumo + ficha técnica incluyendo
#   el campo porcentaje_merma agregado en CU22.
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


class FichaTecnicaView(APIView):
    """
    GET /api/insumos/{id}/ficha-tecnica/

    Devuelve los datos completos del insumo junto con su ficha técnica,
    incluyendo el campo porcentaje_merma (CU22).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, insumo_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Obtener el insumo
            insumo_response = supabase.table('insumo').select('*').eq('id', insumo_id).execute()
            if not insumo_response.data:
                return Response(
                    {'error': 'Insumo no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            insumo = insumo_response.data[0]

            # Obtener ficha técnica — incluye porcentaje_merma (CU22)
            ficha_response = (
                supabase.table('ficha_tecnica')
                .select('*')   # porcentaje_merma ya está en el SELECT *
                .eq('insumo_id', insumo_id)
                .execute()
            )
            ficha_tecnica = ficha_response.data[0] if ficha_response.data else None

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CONSULTAR_FICHA_TECNICA",
                detalles={
                    "ip": ip_cliente,
                    "insumo_id": insumo_id,
                    "insumo_nombre": insumo.get('nombre', ''),
                    "ficha_disponible": ficha_tecnica is not None
                }
            )

            return Response(
                {'insumo': insumo, 'ficha_tecnica': ficha_tecnica},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error obteniendo ficha técnica para insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al obtener la ficha técnica'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )