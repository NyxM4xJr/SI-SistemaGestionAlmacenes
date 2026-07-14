# ============================================================
# ARCHIVO: backend/usuarios/pronostico_views.py
# CASO DE USO: CU44 - Pronóstico de Demanda
# CICLO: 6
#
# DESCRIPCIÓN:
#   A diferencia de CU36 (órdenes automáticas, que es REACTIVO: pide
#   cuando el stock ya cayó bajo el mínimo), este CU es PREDICTIVO:
#   analiza el consumo histórico real (movimientos de tipo 'salida') de
#   los últimos N días, calcula el consumo diario promedio por insumo, lo
#   cruza con el stock actual para estimar los DÍAS DE COBERTURA restantes
#   y cuánto conviene pedir para no quedarse sin stock. El backend calcula
#   los números; la IA solo redacta la priorización (no recalcula nada).
#
# ENDPOINT:
#   GET /api/reportes/pronostico/?dias=N   (default N=30)
#
# BITÁCORA:
#   GENERAR_PRONOSTICO_DEMANDA
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

logger = logging.getLogger(__name__)

ROLES_PRONOSTICO = ['administrador', 'gerente']
DIAS_DEFAULT = 30
# Se marca "urgente" un insumo cuya cobertura sea menor a estos días.
UMBRAL_DIAS_COBERTURA = 7

SYSTEM_PROMPT_PRONOSTICO = (
    "Sos un analista de abastecimiento de un almacén gastronómico. Te paso, "
    "en JSON, un pronóstico YA calculado por insumo: consumo diario promedio, "
    "stock actual, días de cobertura restantes y cantidad sugerida a pedir. "
    "Redactá un resumen breve (máx. 120 palabras), en español, texto plano sin "
    "Markdown, priorizando primero los insumos que se agotan antes. No "
    "inventes ni recalcules cifras: usá solo las que están en los datos. Si "
    "nada es urgente, decilo en una frase."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _calcular_pronostico(supabase, dias):
    """
    Calcula, por insumo, el consumo diario promedio (salidas de los últimos
    'dias' días), los días de cobertura según el stock actual y la cantidad
    sugerida a pedir para cubrir el próximo período de 'dias' días.
    """
    hoy = date.today()
    desde = (hoy - timedelta(days=dias)).isoformat()

    # 1) Salidas (consumo real) del período, agrupadas por insumo.
    movs = supabase.table('movimiento_inventario').select(
        'insumo_id, cantidad, fecha_mov, insumo:insumo_id(nombre)'
    ).eq('tipo', 'salida').gte('fecha_mov', desde).execute()

    consumo_por_insumo = {}   # insumo_id -> {nombre, total}
    for m in (movs.data or []):
        iid = m.get('insumo_id')
        if iid is None:
            continue
        entry = consumo_por_insumo.setdefault(iid, {
            'nombre': (m.get('insumo') or {}).get('nombre', f'Insumo #{iid}'),
            'total': 0.0,
        })
        entry['total'] += float(m.get('cantidad') or 0)

    if not consumo_por_insumo:
        return []

    # 2) Stock actual por insumo (sumando ubicaciones).
    insumo_ids = list(consumo_por_insumo.keys())
    stock_res = supabase.table('stock').select(
        'insumo_id, cantidad'
    ).in_('insumo_id', insumo_ids).execute()
    stock_por_insumo = {}
    for s in (stock_res.data or []):
        iid = s.get('insumo_id')
        stock_por_insumo[iid] = stock_por_insumo.get(iid, 0.0) + float(s.get('cantidad') or 0)

    # 3) Armar el pronóstico.
    pronostico = []
    for iid, info in consumo_por_insumo.items():
        consumo_diario = round(info['total'] / dias, 3) if dias else 0
        stock_actual = round(stock_por_insumo.get(iid, 0.0), 2)
        if consumo_diario > 0:
            dias_cobertura = round(stock_actual / consumo_diario, 1)
        else:
            dias_cobertura = None  # sin consumo → no se agota
        # Cantidad sugerida: cubrir el próximo período menos lo que ya hay.
        demanda_proyectada = consumo_diario * dias
        cantidad_sugerida = max(int(round(demanda_proyectada - stock_actual)), 0)

        pronostico.append({
            'insumo_id': iid,
            'insumo': info['nombre'],
            'consumo_total_periodo': round(info['total'], 2),
            'consumo_diario_promedio': consumo_diario,
            'stock_actual': stock_actual,
            'dias_cobertura': dias_cobertura,
            'cantidad_sugerida': cantidad_sugerida,
            'urgente': dias_cobertura is not None and dias_cobertura < UMBRAL_DIAS_COBERTURA,
        })

    # Ordenar: primero los que se agotan antes (cobertura más baja).
    pronostico.sort(
        key=lambda x: (x['dias_cobertura'] is None, x['dias_cobertura'] if x['dias_cobertura'] is not None else 1e9)
    )
    return pronostico


class PronosticoDemandaView(APIView):
    """
    GET /api/reportes/pronostico/?dias=N

    Respuesta (200): { "pronostico": [...], "resumen_ia": str,
                       "dias_analizados": N, "generado_en": iso }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_PRONOSTICO:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            dias = int(request.query_params.get('dias', DIAS_DEFAULT))
            if dias <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': 'El parámetro "dias" debe ser un entero positivo.'},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            supabase = _sb()
            pronostico = _calcular_pronostico(supabase, dias)
        except Exception as e:
            logger.error(f"Error calculando pronóstico CU44: {str(e)}")
            return Response(
                {'error': 'Error al calcular el pronóstico.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not pronostico:
            resumen = f'No hay consumo (salidas) registrado en los últimos {dias} días para proyectar demanda.'
        else:
            try:
                # Solo se le pasan a la IA los más relevantes (los primeros 15).
                resumen = generar_texto_ia(
                    SYSTEM_PROMPT_PRONOSTICO,
                    f"Ventana: {dias} días.\nPronóstico:\n{pronostico[:15]}",
                    max_tokens=400,
                )
            except IANoDisponibleError as e:
                logger.error(f"IA no disponible para CU44: {str(e)}")
                return Response(
                    {'error': f'El agente de IA no está disponible: {str(e)}'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        ip_cliente = obtener_ip_cliente(request)
        registrar_accion(
            usuario_id=str(request.user.id),
            usuario_email=request.user.email,
            accion='GENERAR_PRONOSTICO_DEMANDA',
            detalles={
                'ip': ip_cliente,
                'dias': dias,
                'insumos_analizados': len(pronostico),
            },
        )

        return Response({
            'pronostico': pronostico,
            'resumen_ia': resumen,
            'dias_analizados': dias,
            'generado_en': date.today().isoformat(),
        }, status=status.HTTP_200_OK)
