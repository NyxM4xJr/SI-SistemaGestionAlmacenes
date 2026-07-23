import ast
import logging
from collections import Counter

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from supabase import create_client
from django.conf import settings

from bitacora.utils import registrar_accion, obtener_ip_cliente
from nucleo.openai_utils import generar_json_ia, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_AUDITORIA = ['administrador', 'gerente']

ACCIONES_FALLIDAS = {'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO'}
ACCIONES_SENSIBLES = {'CHANGE_ROLE', 'TOGGLE_ACTIVE', 'REGISTER'}

SYSTEM_PROMPT_AUDITORIA = (
    "Sos un auditor de seguridad de un sistema de gestión de almacén. Te paso, "
    "en JSON, señales YA calculadas sobre la actividad reciente del sistema: "
    "intentos de login fallidos/bloqueos por usuario, cambios de rol, "
    "activaciones/desactivaciones de cuentas y los usuarios más activos. "
    "Priorizá lo más riesgoso primero (muchos intentos fallidos de un mismo "
    "usuario, cambios de rol inesperados). No inventes cifras ni usuarios que "
    "no estén en los datos.\n\n"
    "Respondé EXCLUSIVAMENTE con JSON válido, sin texto antes ni después, con "
    "esta forma exacta:\n"
    '{"resumen": str, "detalle": str}\n'
    "- 'resumen': 1 o 2 frases directas (máx. 40 palabras) con lo más "
    "importante a accionar.\n"
    "- 'detalle': informe ejecutivo completo (máx. 120 palabras).\n"
    "Ambos en español, texto plano sin Markdown. Si todo luce normal, decilo "
    "en una sola frase en ambos campos."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _parse_descripcion(desc):
    if isinstance(desc, dict):
        return desc
    if not desc or not isinstance(desc, str):
        return {}
    try:
        val = ast.literal_eval(desc)
        return val if isinstance(val, dict) else {}
    except (ValueError, SyntaxError):
        return {}


def _recolectar_registros(supabase):
    registros = []

    bit = (
        supabase.table('bitacora')
        .select('usuario_email, accion, detalles, fecha')
        .order('fecha', desc=True).limit(200).execute()
    )
    for r in (bit.data or []):
        registros.append({
            'usuario': r.get('usuario_email') or 'desconocido',
            'accion': r.get('accion') or '',
            'fecha': r.get('fecha') or '',
        })

    det = (
        supabase.table('detalle_bitacora')
        .select('usuario_id, accion, descripcion, created_at')
        .order('created_at', desc=True).limit(300).execute()
    )
    for r in (det.data or []):
        info = _parse_descripcion(r.get('descripcion'))
        registros.append({
            'usuario': info.get('email') or r.get('usuario_id') or 'desconocido',
            'accion': r.get('accion') or '',
            'fecha': r.get('created_at') or '',
        })

    return registros


def _calcular_senales(registros):
    fallidos_por_usuario = Counter()
    acciones_sensibles = []
    actividad_por_usuario = Counter()

    for r in registros:
        accion = r['accion']
        usuario = r['usuario']
        actividad_por_usuario[usuario] += 1
        if accion in ACCIONES_FALLIDAS:
            fallidos_por_usuario[usuario] += 1
        if accion in ACCIONES_SENSIBLES:
            acciones_sensibles.append({
                'usuario': usuario, 'accion': accion, 'fecha': r['fecha'],
            })

    return {
        'total_registros': len(registros),
        'logins_fallidos_por_usuario': [
            {'usuario': u, 'intentos': n}
            for u, n in fallidos_por_usuario.most_common(10)
        ],
        'acciones_sensibles': acciones_sensibles[:20],
        'usuarios_mas_activos': [
            {'usuario': u, 'acciones': n}
            for u, n in actividad_por_usuario.most_common(5)
        ],
    }


class AuditoriaBitacoraIAView(APIView):
    """GET /api/auditoria-ia/ — informe de auditoría generado por IA a partir de señales calculadas en la bitácora."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_AUDITORIA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()
            registros = _recolectar_registros(supabase)
        except Exception as e:
            logger.error(f"Error recolectando bitácora para auditoría IA: {str(e)}")
            return Response(
                {'error': 'Error al leer la bitácora.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        senales = _calcular_senales(registros)

        hay_riesgo = bool(senales['logins_fallidos_por_usuario'] or senales['acciones_sensibles'])

        if not registros:
            resumen = detalle = 'No hay actividad registrada para auditar.'
        elif not hay_riesgo:
            resumen = detalle = ('Actividad normal: no se detectaron intentos de '
                                 'acceso fallidos ni cambios sensibles recientes.')
        else:
            try:
                resultado = generar_json_ia(
                    SYSTEM_PROMPT_AUDITORIA,
                    f"Señales de auditoría:\n{senales}",
                    max_tokens=500,
                )
            except IANoDisponibleError as e:
                logger.error(f"IA no disponible para auditoría de bitácora: {str(e)}")
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
            accion='AUDITAR_BITACORA_IA',
            detalles={
                'ip': ip_cliente,
                'registros_analizados': senales['total_registros'],
                'con_riesgo': hay_riesgo,
            },
        )

        return Response(
            {'resumen': resumen, 'detalle': detalle, 'senales': senales},
            status=status.HTTP_200_OK,
        )
