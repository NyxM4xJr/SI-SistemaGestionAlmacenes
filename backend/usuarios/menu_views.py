"""
============================================================
ARCHIVO: backend/usuarios/menu_views.py
CASO DE USO: CU23 - Gestionar Menú
CICLO: 3
FECHA: 01/06/26

DESCRIPCIÓN: Vistas para el CRUD de menús y la gestión de 
platos asociados (detalle_menu).
============================================================
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from supabase import create_client
from bitacora.utils import registrar_accion, obtener_ip_cliente
import logging

logger = logging.getLogger(__name__)

class MenuListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Inicializar cliente de Supabase
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            # Obtener todos los menús ordenados por ID de forma descendente (los más recientes primero)
            response = supabase.table("menu").select("*").order("id", desc=True).execute()
            
            # Registrar en la bitácora que un usuario ha listado los menús
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="LISTAR_MENUS",
                detalles={"ip": ip_cliente}
            )
            return Response(response.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listando menús: {str(e)}")
            return Response({"error": "Error al obtener los menús"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        data = request.data
        # Regla de negocio: El nombre del menú es un campo obligatorio
        if not data.get("nombre"):
            return Response({"error": "El nombre del menú es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Inicializar cliente de Supabase
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Construir el diccionario (payload) con los datos a insertar
            payload = {
                "nombre": data.get("nombre"),
                "temporada": data.get("temporada", ""),
                "descripcion": data.get("descripcion", "")
            }
            
            # Realizar la inserción en la tabla 'menu'
            response = supabase.table("menu").insert(payload).execute()
            nuevo_menu = response.data[0] if response.data else {}
            
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_MENU",
                detalles={
                    "ip": ip_cliente,
                    "menu_id": nuevo_menu.get("id"),
                    "menu_nombre": nuevo_menu.get("nombre")
                }
            )
            return Response(nuevo_menu, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creando menú: {str(e)}")
            return Response({"error": "Error al crear el menú"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MenuDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, menu_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Consulta relacional de Supabase: Obtener el menú, sus detalles_menu y la info del plato
            response = supabase.table("menu").select("*, detalle_menu(*, plato(nombre, costo))").eq("id", menu_id).execute()
            
            if not response.data:
                return Response({"error": "Menú no encontrado"}, status=status.HTTP_404_NOT_FOUND)
                
            return Response(response.data[0], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error obteniendo menú {menu_id}: {str(e)}")
            return Response({"error": "Error al obtener el menú"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request, menu_id):
        data = request.data
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            payload = {}
            if "nombre" in data: payload["nombre"] = data["nombre"]
            if "temporada" in data: payload["temporada"] = data["temporada"]
            if "descripcion" in data: payload["descripcion"] = data["descripcion"]
            
            if not payload:
                return Response({"error": "No hay datos para actualizar"}, status=status.HTTP_400_BAD_REQUEST)
                
            response = supabase.table("menu").update(payload).eq("id", menu_id).execute()
            if not response.data:
                return Response({"error": "Menú no encontrado"}, status=status.HTTP_404_NOT_FOUND)
                
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="EDITAR_MENU",
                detalles={"ip": ip_cliente, "menu_id": menu_id, "campos": list(payload.keys())}
            )
            return Response(response.data[0], status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error actualizando menú {menu_id}: {str(e)}")
            return Response({"error": "Error al actualizar el menú"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, menu_id):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Verificamos si existe el menú antes de intentar borrarlo para poder registrar su nombre
            check = supabase.table("menu").select("nombre").eq("id", menu_id).execute()
            if not check.data:
                return Response({"error": "Menú no encontrado"}, status=status.HTTP_404_NOT_FOUND)
                
            nombre_menu = check.data[0]["nombre"]
            
            # Acción en cascada manual: Eliminar primero los detalles (platos asociados) para evitar violación de llaves foráneas
            supabase.table("detalle_menu").delete().eq("menu_id", menu_id).execute()
            # Finalmente, eliminar el menú
            supabase.table("menu").delete().eq("id", menu_id).execute()
            
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="ELIMINAR_MENU",
                detalles={"ip": ip_cliente, "menu_id": menu_id, "menu_nombre": nombre_menu}
            )
            return Response({"message": "Menú eliminado exitosamente"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error eliminando menú {menu_id}: {str(e)}")
            return Response({"error": "Error al eliminar el menú"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DetalleMenuView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, menu_id):
        """Asocia un plato al menú."""
        data = request.data
        plato_id = data.get("plato_id")
        
        if not plato_id:
            return Response({"error": "El plato_id es obligatorio"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Regla de Negocio: Validar que el mismo plato no se añada dos veces al mismo menú
            check = supabase.table("detalle_menu").select("id").eq("menu_id", menu_id).eq("plato_id", plato_id).execute()
            if check.data:
                return Response({"error": "Este plato ya está en el menú"}, status=status.HTTP_400_BAD_REQUEST)
            
            # Preparar los datos de inserción del plato a la carta
            payload = {
                "menu_id": menu_id,
                "plato_id": plato_id,
                "categoria": data.get("categoria", "Plato Principal"),
                "precio_venta": float(data.get("precio_venta", 0))
            }
            
            response = supabase.table("detalle_menu").insert(payload).execute()
            nuevo_detalle = response.data[0] if response.data else {}
            
            # Buscar información adicional del plato (nombre, costo base) para que el Frontend la renderice de inmediato
            plato_resp = supabase.table("plato").select("nombre, costo").eq("id", plato_id).execute()
            if plato_resp.data:
                nuevo_detalle["plato"] = plato_resp.data[0]
                
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="AÑADIR_PLATO_A_MENU",
                detalles={"ip": ip_cliente, "menu_id": menu_id, "plato_id": plato_id}
            )
            return Response(nuevo_detalle, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error añadiendo plato al menú {menu_id}: {str(e)}")
            return Response({"error": "Error al añadir el plato"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, menu_id, detalle_id):
        """Elimina un plato del menú."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            supabase.table("detalle_menu").delete().eq("id", detalle_id).eq("menu_id", menu_id).execute()
            
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="ELIMINAR_PLATO_DE_MENU",
                detalles={"ip": ip_cliente, "menu_id": menu_id, "detalle_id": detalle_id}
            )
            return Response({"message": "Plato removido del menú exitosamente"}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error eliminando plato del menú: {str(e)}")
            return Response({"error": "Error al remover el plato"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
