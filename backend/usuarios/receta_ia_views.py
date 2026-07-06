# ============================================================
# ARCHIVO: backend/usuarios/receta_ia_views.py
# CASO DE USO: CU41 - Generación de Recetas con IA
# CICLO: 5
#
# DESCRIPCIÓN:
#   A diferencia de CU24 (que solo FILTRA el catálogo de platos ya
#   existente por temporada/vencimiento), este CU genera recetas
#   NUEVAS con la IA, priorizando insumos que:
#     (a) vencen pronto (DETALLE_LOTE.fecha_vencimiento, ventana de
#         7 días, con stock > 0), y
#     (b) tienen alto porcentaje de merma técnica (FICHA_TECNICA,
#         ya cargado desde CU22) — usarlos ahora evita perder ese
#         excedente antes de que se dañe.
#
#   Se le pide a la IA que proponga 1-2 platos DIVERSIFICADOS
#   (categorías distintas cuando sea posible) y que justifique en
#   texto por qué prioriza cada insumo (vencimiento + merma), no que
#   solo tire una receta genérica.
#
#   Es de solo sugerencia: no crea PLATO ni RECETA en la base. Igual
#   criterio que CU24 (que tampoco persiste nada del lado de la
#   sugerencia).
#
# ENDPOINTS:
#   GET /api/recetas-ia/generar/  -> genera sugerencias de recetas
#
# BITÁCORA:
#   GENERAR_RECETA_IA
# ============================================================

import logging
from datetime import date, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_json_ia, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_RECETA_IA = ['administrador', 'gerente', 'chef']
DIAS_VENTANA = 7

SYSTEM_PROMPT = (
    "Sos un chef asistente de un restaurante. Te paso una lista de insumos "
    "candidatos en JSON, cada uno con días restantes antes de vencer, "
    "categoría y porcentaje de merma técnica. Tu tarea es proponer 1 o 2 "
    "platos NUEVOS que usen esos insumos, priorizando los que vencen antes "
    "y los que tienen mayor merma (usarlos ahora evita perder ese "
    "excedente). Si hay insumos de categorías distintas, diversificá: no "
    "propongas 2 platos que usen los mismos insumos. Para cada plato, "
    "explicá brevemente en 'justificacion' POR QUÉ priorizaste esos "
    "insumos (mencioná días restantes y/o merma explícitamente).\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, "
    "con esta forma exacta:\n"
    '{"platos": [{"nombre": str, "categoria": str, "descripcion": str, '
    '"ingredientes": [{"insumo": str, "cantidad_aproximada": str}], '
    '"justificacion": str}]}'
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _insumos_candidatos(supabase):
    """
    Insumos próximos a vencer (ventana de DIAS_VENTANA días, stock > 0),
    enriquecidos con su porcentaje de merma técnica (CU22), ordenados por
    los que vencen antes.
    """
    hoy = date.today()
    limite = (hoy + timedelta(days=DIAS_VENTANA)).isoformat()

    detalles = supabase.table('detalle_lote').select(
        'insumo_id, stock_id, fecha_vencimiento, insumo:insumo_id(nombre, categoria)'
    ).gte('fecha_vencimiento', hoy.isoformat()).lte('fecha_vencimiento', limite).execute()

    detalles_data = detalles.data or []
    if not detalles_data:
        return []

    stock_ids = list({d['stock_id'] for d in detalles_data if d.get('stock_id')})
    stocks_con_cantidad = {}
    if stock_ids:
        stocks = supabase.table('stock').select('id, cantidad').in_('id', stock_ids).execute()
        stocks_con_cantidad = {s['id']: float(s['cantidad']) for s in (stocks.data or [])}

    insumo_ids = list({d['insumo_id'] for d in detalles_data})
    merma_por_insumo = {}
    if insumo_ids:
        fichas = supabase.table('ficha_tecnica').select(
            'insumo_id, porcentaje_merma'
        ).in_('insumo_id', insumo_ids).execute()
        for f in (fichas.data or []):
            if f.get('porcentaje_merma') is not None:
                merma_por_insumo[f['insumo_id']] = float(f['porcentaje_merma'])

    candidatos = {}
    for d in detalles_data:
        cantidad_stock = stocks_con_cantidad.get(d.get('stock_id'), 0)
        if cantidad_stock <= 0:
            continue

        insumo_id = d['insumo_id']
        fv = date.fromisoformat(d['fecha_vencimiento'])
        dias_restantes = (fv - hoy).days

        # Si un insumo aparece en varios lotes, se queda con el que vence antes.
        existente = candidatos.get(insumo_id)
        if existente and existente['dias_restantes'] <= dias_restantes:
            continue

        insumo_info = d.get('insumo') or {}
        candidatos[insumo_id] = {
            'insumo': insumo_info.get('nombre', 'Desconocido'),
            'categoria': insumo_info.get('categoria', 'Sin categoría'),
            'dias_restantes': dias_restantes,
            'porcentaje_merma': merma_por_insumo.get(insumo_id, 0.0),
        }

    return sorted(candidatos.values(), key=lambda x: (x['dias_restantes'], -x['porcentaje_merma']))


class SugerirRecetaIAView(APIView):
    """
    GET /api/recetas-ia/generar/

    Respuesta exitosa (200):
    {
        "insumos_considerados": [
            {"insumo": "Tomate Perita", "categoria": "Verdura",
             "dias_restantes": 2, "porcentaje_merma": 15.0}, ...
        ],
        "platos_sugeridos": [
            {"nombre": str, "categoria": str, "descripcion": str,
             "ingredientes": [{"insumo": str, "cantidad_aproximada": str}],
             "justificacion": str}
        ]
    }

    Si no hay insumos próximos a vencer en la ventana de 7 días,
    devuelve platos_sugeridos: [] sin llamar a la IA (ahorra una
    llamada innecesaria a la API de pago).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_RECETA_IA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()
            candidatos = _insumos_candidatos(supabase)
        except Exception as e:
            logger.error(f"Error obteniendo insumos candidatos para CU41: {str(e)}")
            return Response(
                {'error': 'No se pudieron obtener los insumos próximos a vencer.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not candidatos:
            return Response({
                'insumos_considerados': [],
                'platos_sugeridos': [],
                'mensaje': f'No hay insumos próximos a vencer en los próximos {DIAS_VENTANA} días.',
            }, status=status.HTTP_200_OK)

        try:
            resultado = generar_json_ia(
                SYSTEM_PROMPT,
                f"Insumos candidatos:\n{candidatos}",
                max_tokens=1200,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para CU41: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        platos_sugeridos = resultado.get('platos', []) if isinstance(resultado, dict) else []

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='GENERAR_RECETA_IA',
            detalles={
                'ip': ip_cliente,
                'total_insumos_considerados': len(candidatos),
                'total_platos_sugeridos': len(platos_sugeridos),
            }
        )

        return Response({
            'insumos_considerados': candidatos,
            'platos_sugeridos': platos_sugeridos,
        }, status=status.HTTP_200_OK)
