"""
============================================================
ARCHIVO: backend/usuarios/plato_views.py
CASO DE USO: CU20 - Gestionar Platos del Menú
CICLO: 3
AUTOR: Karen Ortega
FECHA: 01/06/26

DESCRIPCIÓN: Vistas para el CRUD completo de platos del menú.
Sigue el patrón exacto de insumo_views.py.

Rutas registradas en usuarios/urls.py:
  GET    /api/platos/          -> Listar todos los platos
  POST   /api/platos/          -> Crear un nuevo plato
  GET    /api/platos/<id>/     -> Obtener detalle de un plato
  PATCH  /api/platos/<id>/     -> Editar un plato
  DELETE /api/platos/<id>/     -> Eliminar un plato
============================================================
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from supabase import create_client
from bitacora.utils import registrar_accion, obtener_ip_cliente


class PlatoListView(APIView):
    """
    GET  /api/platos/  -> Lista todos los platos registrados.
    POST /api/platos/  -> Crea un nuevo plato.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Retorna la lista completa de platos ordenados por nombre."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            response = (
                supabase.table("plato")
                .select("*")
                .order("nombre", desc=False)
                .execute()
            )

            return Response(response.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al obtener los platos.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request):
        """Crea un nuevo plato y registra la acción en bitácora."""
        nombre      = request.data.get("nombre", "").strip()
        descripcion = request.data.get("descripcion", "").strip()
        costo       = request.data.get("costo")

        # --- Validaciones ---
        if not nombre:
            return Response(
                {"error": "El nombre del plato es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if costo is None:
            return Response(
                {"error": "El costo del plato es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            costo = float(costo)
            if costo < 0:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "El costo debe ser un número positivo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar si ya existe un plato con ese nombre
            existe = (
                supabase.table("plato")
                .select("id")
                .eq("nombre", nombre)
                .execute()
            )
            if existe.data:
                return Response(
                    {"error": "Ya existe un plato con ese nombre."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Insertar el nuevo plato
            nuevo = (
                supabase.table("plato")
                .insert({
                    "nombre":      nombre,
                    "descripcion": descripcion,
                    "costo":       costo,
                })
                .execute()
            )

            nuevo_plato = nuevo.data[0] if nuevo.data else {}

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_PLATO",
                detalles={
                    "ip":          ip_cliente,
                    "plato_id":    nuevo_plato.get("id"),
                    "plato_nombre": nombre,
                },
            )

            return Response(nuevo_plato, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"🔴 ERROR EN POST PLATO: {type(e).__name__}: {str(e)}")  # línea temporal
            import traceback
            traceback.print_exc()  # línea temporal
            return Response(
                {"error": "Error al crear el plato.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class PlatoDetailView(APIView):
    """
    GET    /api/platos/<plato_id>/  -> Detalle de un plato.
    PATCH  /api/platos/<plato_id>/  -> Editar un plato.
    DELETE /api/platos/<plato_id>/  -> Eliminar un plato.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, plato_id):
        """Retorna el detalle de un plato específico."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            response = (
                supabase.table("plato")
                .select("*")
                .eq("id", plato_id)
                .single()
                .execute()
            )

            if not response.data:
                return Response(
                    {"error": "Plato no encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            return Response(response.data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al obtener el plato.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def patch(self, request, plato_id):
        """Actualiza parcialmente un plato y registra la acción en bitácora."""
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que el plato existe
            existente = (
                supabase.table("plato")
                .select("*")
                .eq("id", plato_id)
                .single()
                .execute()
            )
            if not existente.data:
                return Response(
                    {"error": "Plato no encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Construir payload solo con los campos enviados
            payload = {}

            if "nombre" in request.data:
                nombre = request.data["nombre"].strip()
                if not nombre:
                    return Response(
                        {"error": "El nombre no puede estar vacío."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Verificar nombre duplicado (excluyendo el plato actual)
                duplicado = (
                    supabase.table("plato")
                    .select("id")
                    .ilike("nombre", nombre)
                    .neq("id", plato_id)
                    .execute()
                )
                if duplicado.data:
                    return Response(
                        {"error": "Ya existe otro plato con ese nombre."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                payload["nombre"] = nombre

            if "descripcion" in request.data:
                payload["descripcion"] = request.data["descripcion"].strip()

            if "costo" in request.data:
                try:
                    costo = float(request.data["costo"])
                    if costo < 0:
                        raise ValueError
                    payload["costo"] = costo
                except (ValueError, TypeError):
                    return Response(
                        {"error": "El costo debe ser un número positivo."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if not payload:
                return Response(
                    {"error": "No se enviaron campos para actualizar."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Actualizar el plato
            actualizado = (
                supabase.table("plato")
                .update(payload)
                .eq("id", plato_id)
                .execute()
            )

            plato_actualizado = actualizado.data[0] if actualizado.data else {}

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="EDITAR_PLATO",
                detalles={
                    "ip":           ip_cliente,
                    "plato_id":     plato_id,
                    "campos_editados": list(payload.keys()),
                },
            )

            return Response(plato_actualizado, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al actualizar el plato.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def delete(self, request, plato_id):
        """
        Elimina un plato. Verifica primero que no tenga recetas asociadas
        (DETALLE_RECETA) para evitar inconsistencias.
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que el plato existe
            existente = (
                supabase.table("plato")
                .select("nombre")
                .eq("id", plato_id)
                .single()
                .execute()
            )
            if not existente.data:
                return Response(
                    {"error": "Plato no encontrado."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            nombre_plato = existente.data.get("nombre", "")

            # Verificar si tiene recetas asociadas
            recetas = (
                supabase.table("receta")
                .select("id")
                .eq("plato_id", plato_id)
                .execute()
            )
            if recetas.data:
                return Response(
                    {"error": "No se puede eliminar el plato porque tiene recetas asociadas."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Eliminar el plato
            supabase.table("plato").delete().eq("id", plato_id).execute()

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="ELIMINAR_PLATO",
                detalles={
                    "ip":           ip_cliente,
                    "plato_id":     plato_id,
                    "plato_nombre": nombre_plato,
                },
            )

            return Response(
                {"mensaje": f"Plato '{nombre_plato}' eliminado correctamente."},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": "Error al eliminar el plato.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )