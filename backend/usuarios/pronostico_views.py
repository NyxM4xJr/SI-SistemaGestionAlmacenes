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

ROLES_PRONOSTICO = ['administrador', 'gerente']
DIAS_DEFAULT = 30
UMBRAL_DIAS_COBERTURA = 7

SYSTEM_PROMPT_PRONOSTICO = (
    "Sos un analista de abastecimiento de un almacén gastronómico. Te paso, "
    "en JSON, un pronóstico YA calculado por insumo: consumo diario promedio, "
    "stock actual, días de cobertura restantes y cantidad sugerida a pedir. "
    "Priorizá primero los insumos que se agotan antes. No inventes ni "
    "recalcules cifras: usá solo las que están en los datos.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"resumen": str, "detalle": str}\n'
    "- 'resumen': 1 o 2 frases directas (máx. 40 palabras) diciendo qué pedir "
    "con urgencia.\n"
    "- 'detalle': análisis completo (máx. 120 palabras).\n"
    "Ambos en español, texto plano sin Markdown. Si nada es urgente, decilo en "
    "una frase en ambos campos."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _calcular_pronostico(supabase, dias):
    hoy = date.today()
    desde = (hoy - timedelta(days=dias)).isoformat()

    movs = supabase.table('movimiento_inventario').select(
        'insumo_id, cantidad, fecha_mov, insumo:insumo_id(nombre)'
    ).eq('tipo', 'salida').gte('fecha_mov', desde).execute()

    consumo_por_insumo = {}
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

    insumo_ids = list(consumo_por_insumo.keys())
    stock_res = supabase.table('stock').select(
        'insumo_id, cantidad'
    ).in_('insumo_id', insumo_ids).execute()
    stock_por_insumo = {}
    for s in (stock_res.data or []):
        iid = s.get('insumo_id')
        stock_por_insumo[iid] = stock_por_insumo.get(iid, 0.0) + float(s.get('cantidad') or 0)

    pronostico = []
    for iid, info in consumo_por_insumo.items():
        consumo_diario = round(info['total'] / dias, 3) if dias else 0
        stock_actual = round(stock_por_insumo.get(iid, 0.0), 2)
        if consumo_diario > 0:
            dias_cobertura = round(stock_actual / consumo_diario, 1)
        else:
            dias_cobertura = None
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

    pronostico.sort(
        key=lambda x: (x['dias_cobertura'] is None, x['dias_cobertura'] if x['dias_cobertura'] is not None else 1e9)
    )
    return pronostico


class PronosticoDemandaView(APIView):
    """GET /api/reportes/pronostico/?dias=N — proyecta consumo, cobertura y cantidad sugerida a pedir por insumo."""
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
            logger.error(f"Error calculando pronóstico de demanda: {str(e)}")
            return Response(
                {'error': 'Error al calcular el pronóstico.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if not pronostico:
            msg = f'No hay consumo (salidas) registrado en los últimos {dias} días para proyectar demanda.'
            resumen = detalle = msg
        else:
            try:
                resultado = generar_json_ia(
                    SYSTEM_PROMPT_PRONOSTICO,
                    f"Ventana: {dias} días.\nPronóstico:\n{pronostico[:15]}",
                    max_tokens=500,
                )
            except IANoDisponibleError as e:
                logger.error(f"IA no disponible para pronóstico de demanda: {str(e)}")
                return Response(
                    {'error': f'El agente de IA no está disponible: {str(e)}'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            resumen = (resultado.get('resumen') or '').strip() if isinstance(resultado, dict) else ''
            detalle = (resultado.get('detalle') or '').strip() if isinstance(resultado, dict) else ''
            resumen = resumen or detalle
            detalle = detalle or resumen

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
            'resumen': resumen,
            'detalle': detalle,
            'dias_analizados': dias,
            'generado_en': date.today().isoformat(),
        }, status=status.HTTP_200_OK)
