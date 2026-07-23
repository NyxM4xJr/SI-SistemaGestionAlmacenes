"""
============================================================
ARCHIVO: backend/usuarios/comando_voz_views.py
CASO DE USO: CU32 - Reportes por Voz con IA
CICLO: 4
AUTOR: Mateo Hurtado
FECHA: 21/06/26
============================================================

DESCRIPCIÓN:
CU32 es casi en su totalidad un CU de frontend: la captura de
audio (Web Speech API del navegador) y la interpretación del
comando por palabras clave ocurren enteramente en el cliente
(ver useComandoVoz.ts). "IA" se refiere al reconocimiento de voz
nativo del navegador, no a un modelo de lenguaje propio — esto
se documenta explícitamente para no sobre-prometer en la defensa.

El ÚNICO endpoint backend de este CU es un registro de bitácora
genérico: cuando el frontend interpreta con éxito un comando de
voz, llama a este endpoint para dejar constancia. No hay cálculo
de negocio aquí, ni se consulta ninguna tabla de inventario/menús.

No se crea ninguna tabla nueva.

Tablas consultadas: ninguna (solo INSERT vía registrar_accion()
en DETALLE_BITACORA).

Correspondencia con el diagrama de secuencia:
- F3 critical: registro de bitácora, única llamada atómica,
  solo cuando el comando fue interpretado con éxito.
"""

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)


class LogComandoVozView(APIView):
    """
    Endpoint genérico para registrar en bitácora que un comando de
    voz fue interpretado con éxito en el frontend.

    Método: POST
    URL: /api/bitacora/log-accion-voz/
    Body:
    {
        "transcripcion": "mostrar valor perdido de este mes",
        "cu_destino": "CU25",
        "formato_detectado": "pdf" | "excel" | null
    }

    Respuesta exitosa (200):
    { "message": "Comando de voz registrado" }

    No valida ni ejecuta nada de negocio — es un log de auditoría
    puro, análogo a LogPasswordResetView (mismo patrón de endpoint
    "pequeño y genérico" que solo registra una acción ya ocurrida
    en el cliente).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        transcripcion = request.data.get('transcripcion', '')
        cu_destino = request.data.get('cu_destino', '')
        formato_detectado = request.data.get('formato_detectado')

        try:
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="COMANDO_VOZ_RECONOCIDO",
                detalles={
                    "ip": ip_cliente,
                    "transcripcion": transcripcion,
                    "cu_destino": cu_destino,
                    "formato_detectado": formato_detectado,
                }
            )
            return Response(
                {'message': 'Comando de voz registrado'},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error registrando comando de voz: {str(e)}")
            # No bloquea la experiencia del usuario por un fallo de
            # auditoría: se responde 200 igual, mismo criterio que
            # registrar_accion() ya aplica internamente (no relanza
            # excepciones para no interrumpir el flujo principal).
            return Response(
                {'message': 'Comando procesado (bitácora no registrada)'},
                status=status.HTTP_200_OK
            )