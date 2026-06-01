# ============================================================
# ARCHIVO: backend/usuarios/estacionalidad_views.py
# CASO DE USO: CU9 - Gestionar Calendario de Estacionalidad
# CICLO: 3
# FECHA: 01/06/26
# DESCRIPCION: Maneja la actualización del calendario de
# estacionalidad de un insumo (12 meses).
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

class EstacionalidadView(APIView):
    """
    PUT /api/insumos/{id}/estacionalidad/
    Actualiza el calendario de estacionalidad completo (los 12 meses) de un insumo.
    """
    permission_classes = [IsAuthenticated]

    def put(self, request, insumo_id):
        try:
            # Extraer el array de 'meses' desde el cuerpo de la petición (JSON)
            meses_data = request.data.get('meses', [])
            
            # Validar que los datos recibidos sean efectivamente una lista
            if not isinstance(meses_data, list):
                return Response(
                    {'error': 'Se esperaba una lista de meses.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Inicializar cliente de Supabase usando variables de entorno
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Verificar en la base de datos que el insumo especificado realmente exista
            check_insumo = supabase.table('insumo').select('id, nombre').eq('id', insumo_id).execute()
            if not check_insumo.data:
                return Response({'error': 'Insumo no encontrado'}, status=status.HTTP_404_NOT_FOUND)
                
            # Guardar el nombre del insumo para registrarlo luego en la bitácora
            insumo_nombre = check_insumo.data[0]['nombre']

            # Preparar la lista de diccionarios con los datos formateados a insertar
            insert_data = []
            for item in meses_data:
                mes = int(item.get('mes'))
                tipo_temporada = item.get('tipo_temporada', 'Media')
                precio_prom = float(item.get('precio_prom', 0))
                comentarios = item.get('comentarios', '')
                
                # Regla de Negocio: Solo procesar y permitir meses válidos (1 al 12)
                if 1 <= mes <= 12:
                    insert_data.append({
                        'insumo_id': insumo_id,
                        'mes': mes,
                        'tipo_temporada': tipo_temporada,
                        'precio_prom': precio_prom,
                        'comentarios': comentarios
                    })

            # Acción atómica simulada: Primero eliminamos la estacionalidad anterior completa
            supabase.table('por_estaciones').delete().eq('insumo_id', insumo_id).execute()

            # Luego insertamos todos los meses nuevos provenientes del formulario frontend
            if insert_data:
                supabase.table('por_estaciones').insert(insert_data).execute()

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="EDITAR_ESTACIONALIDAD",
                detalles={
                    "ip": ip_cliente,
                    "insumo_id": insumo_id,
                    "insumo_nombre": insumo_nombre,
                    "meses_actualizados": len(insert_data)
                }
            )

            return Response({'message': 'Calendario de estacionalidad actualizado correctamente.'}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error actualizando estacionalidad del insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al actualizar el calendario de estacionalidad'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
