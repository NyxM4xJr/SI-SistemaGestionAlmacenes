# ============================================================
# ARCHIVO: backend/inventario/etiqueta_views.py
# CASO DE USO: CU42 - Escaneo de Etiqueta → Lote (visión)
# CICLO: 6
#
# DESCRIPCIÓN:
#   Recibe la FOTO de la etiqueta de un producto y la IA de visión
#   (gpt-4o-mini) extrae la fecha de vencimiento y el número de lote,
#   para PRECARGAR el formulario de alta de lote. NO persiste: la
#   inserción real del lote reutiliza el endpoint existente de lotes
#   (inventario/views.py LoteViewSet → tabla detalle_lote), que alimenta
#   la vista de caducidad de CU34.
#
# ENDPOINT:
#   POST /api/etiquetas/escanear/
#
# BITÁCORA:
#   ESCANEAR_ETIQUETA
# ============================================================

import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_json_ia_vision, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_ETIQUETA = ['administrador', 'chef']

SYSTEM_PROMPT_ETIQUETA = (
    "Sos un lector de etiquetas de productos de un almacén gastronómico. Te "
    "paso la imagen de la etiqueta de un producto. Extraé SOLO lo que "
    "realmente aparece; si un dato no está o no se lee, dejalo en null. La "
    "fecha de vencimiento normalízala a formato YYYY-MM-DD (interpretá "
    "'VENC', 'CAD', 'EXP', 'consumir antes de', etc.).\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"fecha_vencimiento": "YYYY-MM-DD"|null, "numero_lote": str|null, '
    '"producto": str|null}'
)


class EscanearEtiquetaView(APIView):
    """
    POST /api/etiquetas/escanear/
    Body: { "imagen": "data:image/jpeg;base64,..." }

    Devuelve los datos extraídos por la IA SIN persistir (para precargar el
    formulario de alta de lote).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.rol not in ROLES_ETIQUETA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        imagen = request.data.get('imagen')
        if not imagen or not isinstance(imagen, str) or 'base64,' not in imagen:
            return Response(
                {'error': 'Debe enviar la imagen de la etiqueta en base64 (campo "imagen").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            datos = generar_json_ia_vision(
                SYSTEM_PROMPT_ETIQUETA,
                "Leé esta etiqueta de producto y extraé sus datos.",
                imagen,
                max_tokens=300,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU42 escaneo: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='ESCANEAR_ETIQUETA',
            detalles={
                'ip': ip_cliente,
                'vencimiento_detectado': bool(datos.get('fecha_vencimiento')) if isinstance(datos, dict) else False,
            },
        )

        return Response(datos, status=status.HTTP_200_OK)
