# ============================================================
# ARCHIVO: backend/usuarios/insumo_views.py
# CASO DE USO: CU07 - Gestionar Insumos
# CICLO: 2
# FECHA: 09/05/26
# AUTOR: Karen Ortega Mancilla
# DESCRIPCIÓN: Vistas (endpoints) para el CRUD de insumos.
#   - InsumoListView: GET (listar) y POST (crear)
#   - InsumoDetailView: GET, PATCH, DELETE por ID
# ============================================================

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings
from bitacora.utils import registrar_accion, obtener_ip_cliente
import logging

from .insumo_serializers import InsumoSerializer

logger = logging.getLogger(__name__)

# ============================================================
# INSUMO LIST VIEW - Maneja GET (listar) y POST (crear)
# ============================================================

class InsumoListView(APIView):
    """
    GET  /api/insumos/   → Lista todos los insumos ordenados por nombre.
    POST /api/insumos/   → Crea un nuevo insumo en el catálogo.
    
    Permisos: Solo usuarios autenticados (Administrador o Chef).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Devuelve la lista completa de insumos."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = supabase.table('insumo').select('*').order('nombre').execute()
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="LISTAR_INSUMOS",
                detalles={"ip": ip_cliente}
            )
            
            return Response(response.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error listando insumos: {str(e)}")
            return Response(
                {'error': 'Error al obtener la lista de insumos'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        """Crea un nuevo insumo con los datos proporcionados."""
        serializer = InsumoSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            data = serializer.validated_data

            # Convertir tipos de datos para compatibilidad con Supabase/JSON
            for key, value in data.items():
                if hasattr(value, '__float__'):
                    # Si es un campo entero (vencimiento_dias), convertir a int
                    if key == 'vencimiento_dias':
                        data[key] = int(value)
                    else:
                        data[key] = float(value)

            response = supabase.table('insumo').insert(data).execute()
            
            nuevo_insumo = response.data[0]
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_INSUMO",
                detalles={
                    "ip": ip_cliente,
                    "insumo_id": nuevo_insumo['id'],
                    "insumo_nombre": nuevo_insumo['nombre']
                }
            )
            
            return Response(nuevo_insumo, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creando insumo: {str(e)}")
            return Response(
                {'error': 'Error al crear el insumo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================
# INSUMO DETAIL VIEW - Maneja GET, PATCH, DELETE por ID
# ============================================================

class InsumoDetailView(APIView):
    """
    GET    /api/insumos/{id}/  → Obtiene un insumo específico.
    PATCH  /api/insumos/{id}/  → Actualiza parcialmente un insumo.
    DELETE /api/insumos/{id}/  → Elimina un insumo del catálogo.
    
    Permisos: Solo usuarios autenticados (Administrador para modificar).
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, insumo_id):
        """Obtiene un insumo por su ID."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = supabase.table('insumo').select('*').eq('id', insumo_id).execute()
            
            if not response.data:
                return Response(
                    {'error': 'Insumo no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response(response.data[0], status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error obteniendo insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al obtener el insumo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def patch(self, request, insumo_id):
        """Actualiza parcialmente un insumo existente."""
        serializer = InsumoSerializer(data=request.data, partial=True)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            data = serializer.validated_data

            # Convertir tipos de datos para compatibilidad con Supabase/JSON
            for key, value in data.items():
                if hasattr(value, '__float__'):
                    if key == 'vencimiento_dias':
                        data[key] = int(value)
                    else:
                        data[key] = float(value)
                    
            response = supabase.table('insumo').update(data).eq('id', insumo_id).execute()
            
            if not response.data:
                return Response(
                    {'error': 'Insumo no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="EDITAR_INSUMO",
                detalles={
                    "ip": ip_cliente,
                    "insumo_id": insumo_id,
                    "campos_actualizados": list(serializer.validated_data.keys())
                }
            )
            
            return Response(response.data[0], status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error actualizando insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al actualizar el insumo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, insumo_id):
        """Elimina un insumo del catálogo."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Verificar que existe antes de eliminar
            check = supabase.table('insumo').select('nombre').eq('id', insumo_id).execute()
            if not check.data:
                return Response(
                    {'error': 'Insumo no encontrado'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            nombre_insumo = check.data[0]['nombre']
            
            # Eliminar
            supabase.table('insumo').delete().eq('id', insumo_id).execute()
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="ELIMINAR_INSUMO",
                detalles={
                    "ip": ip_cliente,
                    "insumo_id": insumo_id,
                    "insumo_nombre": nombre_insumo
                }
            )
            
            return Response(
                {'message': f'Insumo "{nombre_insumo}" eliminado exitosamente'},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            error_str = str(e)
            logger.error(f"Error eliminando insumo {insumo_id}: {error_str}")
            
            # Detectar si es un error de integridad referencial (foreign key)
            if 'foreign key constraint' in error_str.lower() or 'still referenced' in error_str.lower():
                return Response(
                    {'error': 'No se puede eliminar este insumo porque está siendo utilizado en recetas, stock o lotes. Elimine primero esas referencias.'},
                    status=status.HTTP_409_CONFLICT  # 409 Conflict es más apropiado
                )
            
            return Response(
                {'error': 'Error al eliminar el insumo.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )