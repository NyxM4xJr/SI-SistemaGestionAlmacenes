# ============================================================
# ARCHIVO: backend/usuarios/briefing_ia_views.py
# CASO DE USO: CU40 - Briefing Ejecutivo Proactivo con IA
# CICLO: 5
#
# DESCRIPCIÓN:
#   A diferencia de CU37 (que actúa solo cuando el usuario hace
#   clic) o CU32 (que solo responde a un comando puntual), este CU
#   es PROACTIVO: sin que nadie pregunte nada, resume el estado del
#   negocio HOY (stock bajo, próximos a vencer, valor perdido del
#   mes, órdenes automáticas recientes) y le pide a la IA que
#   redacte un briefing corto priorizando lo urgente, en vez de
#   mostrar solo números sueltos.
#
#   Reutiliza los cálculos ya existentes de CU29 (dashboard) en vez
#   de reimplementarlos: la IA no inventa datos, solo los interpreta
#   y los redacta.
#
# ENDPOINTS:
#   GET /api/briefing-ia/  -> genera el briefing del día
#
# BITÁCORA:
#   CONSULTAR_BRIEFING_IA
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
from nucleo.openai_utils import generar_texto_ia, IANoDisponibleError
from .dashboard_kpis_views import _calcular_valor_perdido_acumulado

logger = logging.getLogger(__name__)

ROLES_BRIEFING = ['administrador', 'gerente']

SYSTEM_PROMPT = (
    "Sos el asistente ejecutivo de un restaurante. Te paso datos reales de su "
    "sistema de inventario en JSON y tenés que redactar un briefing breve "
    "(máximo 120 palabras), en español, con tono profesional pero directo. "
    "Priorizá lo más urgente primero (vencimientos próximos y stock crítico "
    "antes que cifras generales). Usá viñetas cortas. NO inventes datos que "
    "no estén en el JSON. Si todo está en orden, decilo brevemente en vez de "
    "forzar una alerta."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _insumos_stock_bajo(supabase):
    """Detalle (no solo el conteo) de insumos en/bajo el mínimo, para dárselo a la IA."""
    stock_res = supabase.table('stock').select(
        'cantidad, stock_min, insumo:insumo_id(nombre)'
    ).execute()
    bajos = []
    for s in (stock_res.data or []):
        if s.get('stock_min') is not None and float(s.get('cantidad', 0)) <= float(s['stock_min']):
            bajos.append({
                'insumo': (s.get('insumo') or {}).get('nombre', 'Desconocido'),
                'cantidad': s.get('cantidad'),
                'stock_min': s.get('stock_min'),
            })
    return bajos


def _lotes_por_vencer(supabase):
    """Detalle de insumos próximos a vencer (7 días), con días restantes."""
    hoy = date.today()
    limite = (hoy + timedelta(days=7)).isoformat()

    detalles = supabase.table('detalle_lote').select(
        'fecha_vencimiento, insumo:insumo_id(nombre)'
    ).gte('fecha_vencimiento', hoy.isoformat()).lte('fecha_vencimiento', limite).execute()

    resultado = []
    for d in (detalles.data or []):
        fv = date.fromisoformat(d['fecha_vencimiento'])
        resultado.append({
            'insumo': (d.get('insumo') or {}).get('nombre', 'Desconocido'),
            'dias_restantes': (fv - hoy).days,
        })
    return sorted(resultado, key=lambda x: x['dias_restantes'])


def _ordenes_automaticas_recientes(supabase):
    """Órdenes de compra generadas automáticamente en los últimos 7 días (CU37)."""
    hace_7_dias = (date.today() - timedelta(days=7)).isoformat()
    ordenes = supabase.table('orden_compra').select(
        'id, estado, total', count='exact'
    ).eq('generada_auto', True).gte('fecha', hace_7_dias).execute()
    return {
        'cantidad': ordenes.count or 0,
        'pendientes_de_recibir': len([o for o in (ordenes.data or []) if o['estado'] != 'recibida']),
    }


class BriefingIAView(APIView):
    """
    GET /api/briefing-ia/

    Arma el estado del negocio del día (reutilizando cálculos de CU29
    y consultas propias de detalle) y le pide a la IA que redacte un
    resumen ejecutivo priorizado.

    Respuesta exitosa (200):
    {
        "resumen": "texto redactado por la IA...",
        "datos": { ...contexto usado para generarlo... },
        "generado_en": "2026-07-05T10:30:00"
    }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_BRIEFING:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()

            datos = {
                'stock_bajo': _insumos_stock_bajo(supabase),
                'proximos_a_vencer': _lotes_por_vencer(supabase),
                'valor_perdido_mes_actual': _calcular_valor_perdido_acumulado(supabase),
                'ordenes_compra_automaticas_ultimos_7_dias': _ordenes_automaticas_recientes(supabase),
            }
        except Exception as e:
            logger.error(f"Error recolectando datos para el briefing IA: {str(e)}")
            return Response(
                {'error': 'No se pudieron obtener los datos del negocio.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        try:
            resumen = generar_texto_ia(
                SYSTEM_PROMPT,
                f"Datos de hoy ({date.today().isoformat()}):\n{datos}",
                max_tokens=400,
            )
        except IANoDisponibleError as e:
            logger.error(f"IA no disponible para el briefing: {str(e)}")
            return Response(
                {'error': f'El agente de IA no está disponible: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='CONSULTAR_BRIEFING_IA',
            detalles={'ip': ip_cliente}
        )

        return Response({
            'resumen': resumen,
            'datos': datos,
            'generado_en': date.today().isoformat(),
        }, status=status.HTTP_200_OK)
