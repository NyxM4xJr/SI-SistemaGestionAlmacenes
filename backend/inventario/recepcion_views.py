import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_json_ia_vision, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_RECEPCION = ['administrador', 'chef']

SYSTEM_PROMPT_REMITO = (
    "Sos un asistente de recepción de mercadería de un almacén gastronómico. "
    "Te paso la imagen de un remito o factura de entrega de un proveedor. "
    "Extraé TODOS los ítems que aparecen en el documento. Extraé SOLO lo que "
    "realmente se lee; si un dato no está, dejalo en null. Los importes son "
    "números (sin símbolo de moneda). La fecha de vencimiento, si aparece, "
    "normalizala a formato YYYY-MM-DD.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"items": [{"insumo": str, "cantidad": number, "costo_unitario": number, '
    '"fecha_vencimiento": "YYYY-MM-DD"|null}]}'
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _mapa_insumos_por_nombre(supabase):
    try:
        res = supabase.table('insumo').select('id, nombre').execute()
        return {
            (i.get('nombre') or '').strip().lower(): i['id']
            for i in (res.data or []) if i.get('nombre')
        }
    except Exception as e:
        logger.warning(f"No se pudo cargar el mapa de insumos: {str(e)}")
        return {}


class RecepcionRemitoView(APIView):
    """POST /api/lotes/recepcion-remito/ — extrae los ítems de un remito con IA de visión, sin persistir."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.rol not in ROLES_RECEPCION:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        imagen = request.data.get('imagen')
        if not imagen or not isinstance(imagen, str) or 'base64,' not in imagen:
            return Response(
                {'error': 'Debe enviar la imagen del remito en base64 (campo "imagen").'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            datos = generar_json_ia_vision(
                SYSTEM_PROMPT_REMITO,
                "Extraé todos los ítems de este remito de entrega.",
                imagen,
                max_tokens=1500,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para recepción de remitos: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        items = datos.get('items', []) if isinstance(datos, dict) else []

        supabase = _sb()
        mapa = _mapa_insumos_por_nombre(supabase)
        items_enriquecidos = []
        for it in items:
            nombre = (it.get('insumo') or '').strip()
            items_enriquecidos.append({
                'insumo': nombre,
                'insumo_id': mapa.get(nombre.lower()),
                'cantidad': it.get('cantidad'),
                'costo_unitario': it.get('costo_unitario'),
                'fecha_vencimiento': it.get('fecha_vencimiento'),
            })

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='ESCANEAR_REMITO_RECEPCION',
            detalles={'ip': ip_cliente, 'items_detectados': len(items_enriquecidos)},
        )

        return Response({'items': items_enriquecidos}, status=status.HTTP_200_OK)
