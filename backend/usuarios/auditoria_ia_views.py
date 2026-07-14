# ============================================================
# ARCHIVO: backend/usuarios/auditoria_ia_views.py
# CASO DE USO: CU43 - Auditoría Inteligente de Bitácora
# CICLO: 6
#
# DESCRIPCIÓN:
#   El administrador/gerente obtiene un resumen ejecutivo de la actividad
#   reciente del sistema y alertas de patrones sospechosos, sin tener que
#   leer cientos de registros de la bitácora a mano. El backend junta las
#   dos tablas de auditoría (bitacora + detalle_bitacora), calcula señales
#   OBJETIVAS en Python (logins fallidos por usuario, cambios de rol,
#   activaciones/desactivaciones, usuarios más activos) y la IA solo
#   REDACTA el informe priorizado (no inventa datos).
#
# ENDPOINT:
#   GET /api/auditoria-ia/
#
# BITÁCORA:
#   AUDITAR_BITACORA_IA
# ============================================================

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
from nucleo.openai_utils import generar_texto_ia, IANoDisponibleError

logger = logging.getLogger(__name__)

ROLES_AUDITORIA = ['administrador', 'gerente']

# Acciones sensibles que interesan a la auditoría de seguridad.
ACCIONES_FALLIDAS = {'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO'}
ACCIONES_SENSIBLES = {'CHANGE_ROLE', 'TOGGLE_ACTIVE', 'REGISTER'}

SYSTEM_PROMPT_AUDITORIA = (
    "Sos un auditor de seguridad de un sistema de gestión de almacén. Te paso, "
    "en JSON, señales YA calculadas sobre la actividad reciente del sistema: "
    "intentos de login fallidos/bloqueos por usuario, cambios de rol, "
    "activaciones/desactivaciones de cuentas y los usuarios más activos. "
    "Redactá un informe ejecutivo breve (máx. 120 palabras), en español, en "
    "texto plano sin Markdown, priorizando lo más riesgoso primero (por "
    "ejemplo muchos intentos fallidos de un mismo usuario, o cambios de rol "
    "inesperados). No inventes cifras ni usuarios que no estén en los datos; "
    "si todo luce normal, decilo con una sola frase."
)


def _sb():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


def _parse_descripcion(desc):
    """detalle_bitacora.descripcion es str(dict); intenta parsearlo a dict."""
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
    """Combina bitacora (LOGIN/LOGOUT) + detalle_bitacora (resto) a un formato común."""
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
    """Señales objetivas para alimentar a la IA."""
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
    """
    GET /api/auditoria-ia/

    Respuesta (200): { "informe": str, "senales": {...} }
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol not in ROLES_AUDITORIA:
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        try:
            supabase = _sb()
            registros = _recolectar_registros(supabase)
        except Exception as e:
            logger.error(f"Error recolectando bitácora para CU43: {str(e)}")
            return Response(
                {'error': 'Error al leer la bitácora.', 'detalle': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        senales = _calcular_senales(registros)

        hay_riesgo = bool(senales['logins_fallidos_por_usuario'] or senales['acciones_sensibles'])

        # Si no hay actividad sensible, no se llama a la IA (ahorra costo).
        if not registros:
            informe = 'No hay actividad registrada para auditar.'
        elif not hay_riesgo:
            informe = ('Actividad normal: no se detectaron intentos de acceso '
                       'fallidos ni cambios sensibles en el período reciente.')
        else:
            try:
                informe = generar_texto_ia(
                    SYSTEM_PROMPT_AUDITORIA,
                    f"Señales de auditoría:\n{senales}",
                    max_tokens=400,
                )
            except IANoDisponibleError as e:
                logger.error(f"IA no disponible para CU43: {str(e)}")
                return Response(
                    {'error': f'El agente de IA no está disponible: {str(e)}'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

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

        return Response({'informe': informe, 'senales': senales}, status=status.HTTP_200_OK)
