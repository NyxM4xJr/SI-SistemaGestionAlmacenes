# ============================================================
# ARCHIVO: backend/usuarios/insumo_views.py
# CASO DE USO: CU07 - Gestionar Insumos
#              CU22 - Configurar Porcentaje de Merma Técnica
# CICLO: 2 / 3
# FECHA: 01/06/26
# AUTOR: Karen Ortega Mancilla
# CAMBIO CU22: El PATCH de InsumoDetailView ahora acepta el campo
#   porcentaje_merma y lo guarda/actualiza en FICHA_TECNICA.
#   Registra CONFIGURAR_MERMA en bitácora cuando se envía ese campo.
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


class InsumoListView(APIView):
    """
    GET  /api/insumos/  → Lista todos los insumos.
    POST /api/insumos/  → Crea un nuevo insumo.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = supabase.table('insumo').select('*').order('nombre').execute()

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
        serializer = InsumoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            data = serializer.validated_data

            for key, value in data.items():
                if hasattr(value, '__float__'):
                    data[key] = int(value) if key == 'vencimiento_dias' else float(value)

            response = supabase.table('insumo').insert(data).execute()
            nuevo_insumo = response.data[0]

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


class InsumoDetailView(APIView):
    """
    GET    /api/insumos/{id}/  → Obtiene un insumo.
    PATCH  /api/insumos/{id}/  → Actualiza insumo. Si se envía
                                  porcentaje_merma, lo guarda en
                                  FICHA_TECNICA (CU22).
    DELETE /api/insumos/{id}/  → Elimina un insumo.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, insumo_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = supabase.table('insumo').select('*').eq('id', insumo_id).execute()

            if not response.data:
                return Response({'error': 'Insumo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

            return Response(response.data[0], status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error obteniendo insumo {insumo_id}: {str(e)}")
            return Response({'error': 'Error al obtener el insumo'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, insumo_id):
        """
        Actualiza parcialmente un insumo.
        CU22: Si se envía `porcentaje_merma`, lo guarda en FICHA_TECNICA
              mediante upsert (crea la ficha si no existe).
        """
        # ── Separar porcentaje_merma del resto de campos ──────────
        porcentaje_merma = request.data.get('porcentaje_merma', None)

        # Datos del insumo sin porcentaje_merma para el serializer
        insumo_data = {k: v for k, v in request.data.items() if k != 'porcentaje_merma'}

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            ip_cliente = obtener_ip_cliente(request)

            # ── Actualizar tabla INSUMO si hay campos de insumo ──────
            if insumo_data:
                serializer = InsumoSerializer(data=insumo_data, partial=True)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

                data = serializer.validated_data
                for key, value in data.items():
                    if hasattr(value, '__float__'):
                        data[key] = int(value) if key == 'vencimiento_dias' else float(value)

                response = supabase.table('insumo').update(data).eq('id', insumo_id).execute()

                if not response.data:
                    return Response({'error': 'Insumo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

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

            # ── CU22: Guardar porcentaje_merma en FICHA_TECNICA ──────
            if porcentaje_merma is not None:
                try:
                    valor = float(porcentaje_merma)
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'El porcentaje de merma debe ser un número.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                if not (0 <= valor <= 100):
                    return Response(
                        {'error': 'El porcentaje de merma debe estar entre 0 y 100.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Verificar si ya existe ficha técnica para este insumo
                ficha_existente = (
                    supabase.table('ficha_tecnica')
                    .select('id')
                    .eq('insumo_id', insumo_id)
                    .execute()
                )

                if ficha_existente.data:
                    # Actualizar ficha existente
                    supabase.table('ficha_tecnica').update(
                        {'porcentaje_merma': valor}
                    ).eq('insumo_id', insumo_id).execute()
                else:
                    # Crear nueva ficha con solo el porcentaje_merma
                    supabase.table('ficha_tecnica').insert(
                        {'insumo_id': insumo_id, 'porcentaje_merma': valor}
                    ).execute()

                # Registrar en bitácora
                registrar_accion(
                    usuario_id=str(request.user.id),
                    usuario_email=request.user.email,
                    accion="CONFIGURAR_MERMA",
                    detalles={
                        "ip": ip_cliente,
                        "insumo_id": insumo_id,
                        "porcentaje_merma": valor,
                    }
                )

            # ── Retornar insumo actualizado ───────────────────────────
            insumo_actualizado = (
                supabase.table('insumo')
                .select('*')
                .eq('id', insumo_id)
                .execute()
            )
            return Response(insumo_actualizado.data[0], status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error actualizando insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al actualizar el insumo'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, insumo_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            check = supabase.table('insumo').select('nombre').eq('id', insumo_id).execute()
            if not check.data:
                return Response({'error': 'Insumo no encontrado'}, status=status.HTTP_404_NOT_FOUND)

            nombre_insumo = check.data[0]['nombre']
            supabase.table('insumo').delete().eq('id', insumo_id).execute()

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

            if 'foreign key constraint' in error_str.lower() or 'still referenced' in error_str.lower():
                return Response(
                    {'error': 'No se puede eliminar este insumo porque está siendo utilizado en recetas, stock o lotes.'},
                    status=status.HTTP_409_CONFLICT
                )

            return Response(
                {'error': 'Error al eliminar el insumo.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ============================================================
# INSUMO HISTORIAL PRECIOS VIEW - Maneja GET de precios por estaciòn
# ============================================================

class InsumoHistorialPreciosView(APIView):
    """
    GET /api/insumos/{id}/historial-precios/
    Obtiene el historial de precios de un insumo desde la tabla 'por_estaciones'.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, insumo_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            # Fetch por_estaciones where insumo_id matches, ordered by mes
            response = supabase.table('por_estaciones').select('*').eq('insumo_id', insumo_id).order('mes').execute()
            
            return Response(response.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error obteniendo historial de precios para insumo {insumo_id}: {str(e)}")
            return Response(
                {'error': 'Error al obtener el historial de precios'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )