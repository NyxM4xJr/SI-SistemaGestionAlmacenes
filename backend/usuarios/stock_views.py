from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from supabase import create_client
from django.conf import settings


# =========================================================
# STOCK LIST VIEW
# =========================================================

class StockListView(APIView):

    permission_classes = [IsAuthenticated]

    # ==========================================
    # LISTAR STOCK
    # ==========================================
    def get(self, request):

        try:

            supabase = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )

            response = (
                supabase
                .table("stock")
                .select("*, insumo(nombre)")
                .execute()
            )

            return Response(
                response.data,
                status=status.HTTP_200_OK
            )

        except Exception as e:

            print("ERROR GET STOCK:", str(e))

            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    # ==========================================
    # CREAR STOCK
    # ==========================================
    def post(self, request):

        try:

            data = request.data

            payload = {

                "insumo_id":
                    int(data.get("insumo_id")),

                "cantidad":
                    int(data.get("cantidad")),

                "stock_min":
                    int(data.get("stock_min")),

                "stock_max":
                    int(data.get("stock_max")),
            }

            # VALIDACIONES

            if payload["stock_min"] > payload["stock_max"]:

                return Response(
                    {
                        "error":
                        "El stock mínimo no puede ser mayor al máximo"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            if payload["cantidad"] < 0:

                return Response(
                    {
                        "error":
                        "La cantidad no puede ser negativa"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            supabase = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )

            response = (
                supabase
                .table("stock")
                .insert(payload)
                .execute()
            )

            return Response(
                response.data[0],
                status=status.HTTP_201_CREATED
            )

        except Exception as e:

            print("ERROR POST STOCK:", str(e))

            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


# =========================================================
# STOCK DETAIL VIEW
# =========================================================

class StockDetailView(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request, stock_id):

        try:

            supabase = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )

            response = (
                supabase
                .table("stock")
                .select("*, insumo(nombre)")
                .eq("id", stock_id)
                .single()
                .execute()
            )

            return Response(
                response.data,
                status=status.HTTP_200_OK
            )

        except Exception as e:

            return Response(
                {"error": str(e)},
                status=status.HTTP_404_NOT_FOUND
            )

    def patch(self, request, stock_id):

        try:

            supabase = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )

            response = (
                supabase
                .table("stock")
                .update(request.data)
                .eq("id", stock_id)
                .execute()
            )

            return Response(
                response.data,
                status=status.HTTP_200_OK
            )

        except Exception as e:

            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, stock_id):

        try:

            supabase = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )

            (
                supabase
                .table("stock")
                .delete()
                .eq("id", stock_id)
                .execute()
            )

            return Response(
                {"message": "Stock eliminado"},
                status=status.HTTP_204_NO_CONTENT
            )

        except Exception as e:

            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )