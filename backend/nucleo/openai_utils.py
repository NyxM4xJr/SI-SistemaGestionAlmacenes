# ============================================================
# ARCHIVO: backend/nucleo/openai_utils.py
# CASOS DE USO: CU40 (Briefing Ejecutivo Proactivo) y
#               CU41 (Generación de Recetas con IA)
# CICLO: 5
#
# DESCRIPCIÓN:
#   Llama a la API de Chat Completions de OpenAI vía HTTP directo
#   con 'requests', sin el SDK oficial, para no sumar una dependencia
#   nueva al proyecto (mismo criterio ya usado con Resend en vez de
#   un SDK de email). Se usa Chat Completions (no la API de
#   Responses) por ser la opción más estable y ampliamente
#   documentada, con soporte nativo de 'response_format' para forzar
#   JSON, que es justo lo que necesita CU41.
#
#   Dos entradas:
#     - generar_texto_ia(): devuelve texto plano (para el briefing
#       en lenguaje natural de CU40).
#     - generar_json_ia(): fuerza a la API a responder SOLO JSON
#       (response_format={"type": "json_object"}) y lo parsea (para
#       las recetas estructuradas de CU41).
# ============================================================

import json
import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"


class IANoDisponibleError(Exception):
    """Se lanza cuando falta la API key o la llamada a OpenAI falla."""


def _llamar_openai(system_prompt: str, user_prompt: str, max_tokens: int = 1024,
                    forzar_json: bool = False) -> str:
    api_key = getattr(settings, "OPENAI_API_KEY", None)
    if not api_key:
        raise IANoDisponibleError("OPENAI_API_KEY no configurada.")

    payload = {
        "model": settings.OPENAI_MODEL,
        "max_tokens": max_tokens,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    if forzar_json:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(
            OPENAI_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
    except requests.RequestException as e:
        logger.error(f"Error de red llamando a OpenAI: {str(e)}")
        raise IANoDisponibleError(f"Error de red llamando a la IA: {str(e)}") from e

    if resp.status_code != 200:
        logger.error(f"OpenAI rechazó la solicitud ({resp.status_code}): {resp.text}")
        raise IANoDisponibleError(f"La IA respondió con error {resp.status_code}.")

    data = resp.json()
    choices = data.get("choices", [])
    if not choices:
        raise IANoDisponibleError("La IA no devolvió ninguna respuesta.")

    texto = choices[0].get("message", {}).get("content", "")
    return texto.strip()


def generar_texto_ia(system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
    """Devuelve la respuesta de la IA como texto plano."""
    return _llamar_openai(system_prompt, user_prompt, max_tokens, forzar_json=False)


def generar_json_ia(system_prompt: str, user_prompt: str, max_tokens: int = 1500):
    """
    Pide a la IA una respuesta EXCLUSIVAMENTE en JSON (vía
    response_format de Chat Completions) y la parsea.
    """
    texto = _llamar_openai(system_prompt, user_prompt, max_tokens, forzar_json=True)

    try:
        return json.loads(texto)
    except json.JSONDecodeError as e:
        logger.error(f"La IA no devolvió JSON válido: {texto[:500]}")
        raise IANoDisponibleError(
            f"La IA no devolvió una respuesta con formato válido: {str(e)}"
        ) from e
