"""
============================================================
ARCHIVO: backend/usuarios/receta_views.py
CASO DE USO: CU21 - Gestionar Recetas
CICLO: 3
AUTOR: Karen Ortega
FECHA: 01/06/26

DESCRIPCIÓN: Vistas para el CRUD completo de recetas.
Una receta tiene una cabecera (RECETA) y una lista de
ingredientes (DETALLE_RECETA). Las operaciones de escritura
son transacciones de dos pasos: primero la cabecera,
luego los detalles.

Rutas registradas en usuarios/urls.py:
  GET    /api/recetas/                     -> Listar recetas (con nombre de plato)
  POST   /api/recetas/                     -> Crear receta + detalles
  GET    /api/recetas/<id>/                -> Detalle de receta + sus ingredientes
  PATCH  /api/recetas/<id>/                -> Editar cabecera + reemplazar detalles
  DELETE /api/recetas/<id>/                -> Eliminar receta (CASCADE a detalles)
  GET    /api/recetas/catalogos/           -> Platos e insumos para los selects del form
============================================================
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from supabase import create_client
from bitacora.utils import registrar_accion, obtener_ip_cliente


class RecetaCatalogosView(APIView):
    """
    GET /api/recetas/catalogos/
    Retorna los platos e insumos disponibles para poblar
    los selects del formulario de receta.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            platos = (
                supabase.table("plato")
                .select("id, nombre")
                .order("nombre", desc=False)
                .execute()
            )

            insumos = (
                supabase.table("insumo")
                .select("id, nombre, categoria")
                .order("nombre", desc=False)
                .execute()
            )

            unidades = (
                supabase.table("unidad_medida")
                .select("id, unidad")
                .order("unidad", desc=False)
                .execute()
            )

            return Response({
                "platos":   platos.data  or [],
                "insumos":  insumos.data or [],
                "unidades": unidades.data or [],
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al obtener los catálogos.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RecetaListView(APIView):
    """
    GET  /api/recetas/  -> Lista todas las recetas con el nombre del plato asociado.
    POST /api/recetas/  -> Crea una receta con sus detalles de ingredientes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Retorna todas las recetas haciendo JOIN con la tabla plato
        para mostrar el nombre del plato en la lista.
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # JOIN receta → plato para traer nombre del plato
            response = (
                supabase.table("receta")
                .select("*, plato(id, nombre)")
                .order("id", desc=False)
                .execute()
            )

            # Enriquecer cada receta con la cantidad de ingredientes
            recetas = response.data or []
            for receta in recetas:
                detalles = (
                    supabase.table("detalle_receta")
                    .select("id", count="exact")
                    .eq("receta_id", receta["id"])
                    .execute()
                )
                receta["cantidad_ingredientes"] = detalles.count or 0

            return Response(recetas, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al obtener las recetas.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def post(self, request):
        """
        Crea una receta (cabecera) y sus detalles (ingredientes).

        Body esperado:
        {
            "plato_id":    1,
            "descripcion": "Descripción de la receta",
            "cantidad":    4,
            "detalles": [
                { "insumo_id": 1, "cantidad": 200, "unidad_id": 2 },
                { "insumo_id": 3, "cantidad": 50,  "unidad_id": 1 }
            ]
        }
        """
        plato_id    = request.data.get("plato_id")
        descripcion = request.data.get("descripcion", "").strip()
        cantidad    = request.data.get("cantidad")
        detalles    = request.data.get("detalles", [])

        # --- Validaciones de cabecera ---
        if not plato_id:
            return Response(
                {"error": "Debe seleccionar un plato para la receta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not detalles or len(detalles) == 0:
            return Response(
                {"error": "La receta debe tener al menos un ingrediente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar insumos duplicados en el detalle
        insumo_ids = [d.get("insumo_id") for d in detalles]
        if len(insumo_ids) != len(set(insumo_ids)):
            return Response(
                {"error": "No se puede agregar el mismo insumo dos veces en la misma receta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar cada detalle
        for i, detalle in enumerate(detalles):
            if not detalle.get("insumo_id"):
                return Response(
                    {"error": f"El ingrediente #{i+1} no tiene insumo seleccionado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not detalle.get("cantidad") or float(detalle.get("cantidad", 0)) <= 0:
                return Response(
                    {"error": f"El ingrediente #{i+1} debe tener una cantidad mayor a 0."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not detalle.get("unidad_id"):
                return Response(
                    {"error": f"El ingrediente #{i+1} no tiene unidad de medida seleccionada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que el plato existe
            plato = (
                supabase.table("plato")
                .select("id, nombre")
                .eq("id", plato_id)
                .single()
                .execute()
            )
            if not plato.data:
                return Response(
                    {"error": "El plato seleccionado no existe."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Verificar que no existe ya una receta para ese plato
            receta_existente = (
                supabase.table("receta")
                .select("id")
                .eq("plato_id", plato_id)
                .execute()
            )
            if receta_existente.data:
                return Response(
                    {"error": f"El plato '{plato.data['nombre']}' ya tiene una receta registrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # PASO 1: Insertar cabecera de receta
            nueva_receta = (
                supabase.table("receta")
                .insert({
                    "plato_id":    int(plato_id),
                    "descripcion": descripcion,
                    "cantidad":    int(cantidad) if cantidad else None,
                })
                .execute()
            )
            receta_id = nueva_receta.data[0]["id"]

            # PASO 2: Insertar detalles (un INSERT por cada ingrediente)
            detalles_payload = [
                {
                    "receta_id": receta_id,
                    "insumo_id": int(d["insumo_id"]),
                    "cantidad":  float(d["cantidad"]),
                    "unidad_id": int(d["unidad_id"]),
                }
                for d in detalles
            ]
            supabase.table("detalle_receta").insert(detalles_payload).execute()

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_RECETA",
                detalles={
                    "ip":               ip_cliente,
                    "receta_id":        receta_id,
                    "plato_id":         plato_id,
                    "plato_nombre":     plato.data["nombre"],
                    "total_ingredientes": len(detalles),
                },
            )

            return Response(nueva_receta.data[0], status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {"error": "Error al crear la receta.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class RecetaDetailView(APIView):
    """
    GET    /api/recetas/<receta_id>/  -> Detalle de receta con sus ingredientes.
    PATCH  /api/recetas/<receta_id>/  -> Editar cabecera + reemplazar detalles.
    DELETE /api/recetas/<receta_id>/  -> Eliminar receta (CASCADE a detalles).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, receta_id):
        """
        Retorna la cabecera de la receta junto con todos sus ingredientes,
        incluyendo el nombre del insumo y la unidad de medida.
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Cabecera con JOIN a plato
            receta = (
                supabase.table("receta")
                .select("*, plato(id, nombre)")
                .eq("id", receta_id)
                .single()
                .execute()
            )
            if not receta.data:
                return Response(
                    {"error": "Receta no encontrada."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Detalles con JOIN a insumo y unidad_medida
            detalles = (
                supabase.table("detalle_receta")
                .select("*, insumo(id, nombre, categoria), unidad_medida(id, unidad)")
                .eq("receta_id", receta_id)
                .execute()
            )

            resultado = receta.data
            resultado["detalles"] = detalles.data or []

            return Response(resultado, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al obtener la receta.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def patch(self, request, receta_id):
        """
        Actualiza la cabecera de la receta y reemplaza TODOS sus detalles.
        Estrategia: DELETE todos los detalles existentes + INSERT los nuevos.

        Body esperado (igual que POST):
        {
            "plato_id":    1,
            "descripcion": "Nueva descripción",
            "cantidad":    4,
            "detalles": [
                { "insumo_id": 1, "cantidad": 200, "unidad_id": 2 }
            ]
        }
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que la receta existe
            existente = (
                supabase.table("receta")
                .select("*, plato(nombre)")
                .eq("id", receta_id)
                .single()
                .execute()
            )
            if not existente.data:
                return Response(
                    {"error": "Receta no encontrada."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            detalles = request.data.get("detalles", [])

            # Validar detalles si se enviaron
            if detalles:
                insumo_ids = [d.get("insumo_id") for d in detalles]
                if len(insumo_ids) != len(set(insumo_ids)):
                    return Response(
                        {"error": "No se puede agregar el mismo insumo dos veces en la misma receta."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                for i, detalle in enumerate(detalles):
                    if not detalle.get("insumo_id"):
                        return Response(
                            {"error": f"El ingrediente #{i+1} no tiene insumo seleccionado."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if not detalle.get("cantidad") or float(detalle.get("cantidad", 0)) <= 0:
                        return Response(
                            {"error": f"El ingrediente #{i+1} debe tener una cantidad mayor a 0."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    if not detalle.get("unidad_id"):
                        return Response(
                            {"error": f"El ingrediente #{i+1} no tiene unidad de medida."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

            # Construir payload de cabecera con los campos enviados
            payload = {}
            if "plato_id" in request.data:
                payload["plato_id"] = int(request.data["plato_id"])
            if "descripcion" in request.data:
                payload["descripcion"] = request.data["descripcion"].strip()
            if "cantidad" in request.data:
                payload["cantidad"] = int(request.data["cantidad"]) if request.data["cantidad"] else None

            # Actualizar cabecera si hay campos
            if payload:
                supabase.table("receta").update(payload).eq("id", receta_id).execute()

            # Reemplazar detalles si se enviaron (DELETE + INSERT)
            if detalles:
                supabase.table("detalle_receta").delete().eq("receta_id", receta_id).execute()

                detalles_payload = [
                    {
                        "receta_id": receta_id,
                        "insumo_id": int(d["insumo_id"]),
                        "cantidad":  float(d["cantidad"]),
                        "unidad_id": int(d["unidad_id"]),
                    }
                    for d in detalles
                ]
                supabase.table("detalle_receta").insert(detalles_payload).execute()

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="EDITAR_RECETA",
                detalles={
                    "ip":              ip_cliente,
                    "receta_id":       receta_id,
                    "plato_nombre":    existente.data.get("plato", {}).get("nombre", ""),
                    "campos_editados": list(payload.keys()),
                    "detalles_reemplazados": len(detalles) > 0,
                },
            )

            # Retornar la receta actualizada con detalles
            receta_actualizada = (
                supabase.table("receta")
                .select("*, plato(id, nombre)")
                .eq("id", receta_id)
                .single()
                .execute()
            )
            nuevos_detalles = (
                supabase.table("detalle_receta")
                .select("*, insumo(id, nombre), unidad_medida(id, unidad)")
                .eq("receta_id", receta_id)
                .execute()
            )
            resultado = receta_actualizada.data
            resultado["detalles"] = nuevos_detalles.data or []

            return Response(resultado, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": "Error al actualizar la receta.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def delete(self, request, receta_id):
        """
        Elimina la receta. Los detalles se eliminan automáticamente
        por la restricción ON DELETE CASCADE de la base de datos.
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

            # Verificar que existe
            existente = (
                supabase.table("receta")
                .select("*, plato(nombre)")
                .eq("id", receta_id)
                .single()
                .execute()
            )
            if not existente.data:
                return Response(
                    {"error": "Receta no encontrada."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            plato_nombre = existente.data.get("plato", {}).get("nombre", "")

            # Eliminar receta (CASCADE elimina los detalles automáticamente)
            supabase.table("receta").delete().eq("id", receta_id).execute()

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="ELIMINAR_RECETA",
                detalles={
                    "ip":          ip_cliente,
                    "receta_id":   receta_id,
                    "plato_nombre": plato_nombre,
                },
            )

            return Response(
                {"mensaje": f"Receta del plato '{plato_nombre}' eliminada correctamente."},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {"error": "Error al eliminar la receta.", "detalle": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )