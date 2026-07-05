# ============================================================
# ARCHIVO: backend/nucleo/resend_utils.py
# CICLO: 5
# FECHA: 05/07/26
#
# DESCRIPCIÓN:
#   Envío de email vía la API HTTP de Resend (https://api.resend.com),
#   en lugar de SMTP crudo. Railway (y varios PaaS) bloquean las
#   conexiones SMTP salientes, lo que colgaba el worker de gunicorn
#   hasta que Railway lo mataba (WORKER TIMEOUT) — el puerto 443
#   (HTTPS) sí está siempre disponible.
#
#   LIMITACIÓN DE RESEND sin dominio verificado: solo se puede enviar
#   al email del dueño de la cuenta. Por eso se envía UN request por
#   destinatario: si alguno falla (por esa restricción u otra razón),
#   los demás igual se intentan, y se informa cuáles fallaron.
# ============================================================

import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


def enviar_email(destinatarios, asunto, cuerpo_texto, cuerpo_html=None):
    """
    Envía 'cuerpo_texto' (y opcionalmente 'cuerpo_html') a cada
    destinatario por separado vía Resend. Si se pasa cuerpo_html, los
    clientes de correo que soportan HTML muestran ese diseño; el texto
    plano queda como respaldo para los que no.

    Returns:
        dict: {
            'enviados': [email, ...],
            'fallidos': [{'email': str, 'error': str}, ...],
        }
    """
    api_key = getattr(settings, "RESEND_API_KEY", None)
    remitente = settings.DEFAULT_FROM_EMAIL

    if not api_key:
        return {
            'enviados': [],
            'fallidos': [
                {'email': d, 'error': 'RESEND_API_KEY no configurada'}
                for d in destinatarios
            ],
        }

    enviados = []
    fallidos = []

    for destinatario in destinatarios:
        try:
            payload = {
                "from": remitente,
                "to": [destinatario],
                "subject": asunto,
                "text": cuerpo_texto,
            }
            if cuerpo_html:
                payload["html"] = cuerpo_html

            resp = requests.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15,
            )
            if resp.status_code in (200, 201):
                enviados.append(destinatario)
            else:
                logger.error(
                    f"Resend rechazó el envío a {destinatario} "
                    f"({resp.status_code}): {resp.text}"
                )
                fallidos.append({'email': destinatario, 'error': resp.text})
        except Exception as e:
            logger.error(f"Error de red enviando a {destinatario} vía Resend: {str(e)}")
            fallidos.append({'email': destinatario, 'error': str(e)})

    return {'enviados': enviados, 'fallidos': fallidos}
