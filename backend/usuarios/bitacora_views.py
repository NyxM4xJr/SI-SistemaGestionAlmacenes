from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class DetalleBitacoraListView(APIView):
    """
    GET /api/bitacora/completa/
    Devuelve registros de bitacora (LOGIN/LOGOUT) + detalle_bitacora (resto).
    Solo accesible para Administrador y Gerente.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if request.user.rol not in ['administrador', 'gerente']:
            return Response(
                {'error': 'No autorizado'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # 1. Obtener registros de bitacora (LOGIN/LOGOUT)
            bitacora_query = supabase.table('bitacora') \
                .select('id, usuario_email, accion, detalles, fecha') \
                .order('fecha', desc=True) \
                .limit(100) \
                .execute()
            
            # 2. Obtener registros de detalle_bitacora (resto)
            detalle_query = supabase.table('detalle_bitacora') \
                .select('id, usuario_id, accion, descripcion, ip_address, created_at') \
                .order('created_at', desc=True) \
                .limit(200) \
                .execute()
            
            # 3. Combinar resultados
            resultado = []
            
            for row in bitacora_query.data or []:
                resultado.append({
                    'id': row['id'],
                    'origen': 'bitacora',
                    'usuario': row.get('usuario_email', ''),
                    'accion': row.get('accion', ''),
                    'descripcion': str(row.get('detalles', '')),
                    'ip': '',
                    'fecha': row.get('fecha', ''),
                })
            
            for row in detalle_query.data or []:
                resultado.append({
                    'id': row['id'],
                    'origen': 'detalle_bitacora',
                    'usuario': row.get('usuario_id', ''),
                    'accion': row.get('accion', ''),
                    'descripcion': row.get('descripcion', ''),
                    'ip': row.get('ip_address', ''),
                    'fecha': row.get('created_at', ''),
                })
            
            # 4. Ordenar por fecha descendente
            resultado.sort(key=lambda x: x['fecha'] or '', reverse=True)
            
            # 5. Limitar a 300 registros máximo
            resultado = resultado[:300]
            
            return Response(resultado, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error consultando bitácora: {str(e)}")
            return Response(
                {'error': 'Error al consultar bitácora'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )