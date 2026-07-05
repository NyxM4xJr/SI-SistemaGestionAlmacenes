import json
import logging
import stripe
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from .pago_services import (
    crear_sesion_stripe,
    confirmar_pago,
    get_supabase_client,
    crear_orden_paypal,
    capturar_orden_paypal,
    verificar_webhook_paypal,
)
from bitacora.utils import registrar_accion, obtener_ip_cliente

logger = logging.getLogger(__name__)

class CrearSesionPagoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        monto = request.data.get('monto')
        descripcion = request.data.get('descripcion', 'Depósito al sistema')

        if not monto or float(monto) < 10:
            return Response({'error': 'El monto mínimo es de 10 Bs.'}, status=status.HTTP_400_BAD_REQUEST)

        # En desarrollo, asume localhost:5173 o lo que envíe el cliente en origin
        origin = request.headers.get('origin', 'http://localhost:5173')
        success_url = f"{origin}/pagos/historial"
        cancel_url = f"{origin}/pagos/depositar"

        try:
            checkout_url = crear_sesion_stripe(
                usuario_id=request.user.id,
                monto=monto,
                descripcion=descripcion,
                success_url=success_url,
                cancel_url=cancel_url
            )

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_SESION_PAGO",
                detalles={
                    "ip": ip_cliente,
                    "monto": float(monto),
                    "descripcion": descripcion
                }
            )

            return Response({'url': checkout_url}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error en CrearSesionPagoView: {str(e)}")
            return Response({'error': 'No se pudo crear la sesión de pago'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StripeWebhookView(APIView):
    permission_classes = [AllowAny] # Stripe llama a este endpoint sin auth

    def post(self, request):
        payload = request.body
        sig_header = request.headers.get('STRIPE_SIGNATURE')
        endpoint_secret = settings.STRIPE_WEBHOOK_SECRET

        try:
            # Si endpoint_secret no está configurado o está vacío, simplemente cargamos el JSON
            # NOTA: En producción siempre se debe verificar la firma
            if endpoint_secret:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, endpoint_secret
                )
            else:
                event = json.loads(payload)
                
        except ValueError as e:
            # Payload inválido
            return Response(status=status.HTTP_400_BAD_REQUEST)
        except stripe.error.SignatureVerificationError as e:
            # Firma inválida
            return Response(status=status.HTTP_400_BAD_REQUEST)

        # Manejar el evento de checkout completado
        if event['type'] == 'checkout.session.completed':
            # Extraemos los datos como diccionario puro para evitar problemas con la librería de Stripe
            event_dict = json.loads(payload)
            session = event_dict['data']['object']
            session_id = session.get('id')
            metadata = session.get('metadata') or {}
            usuario_id = metadata.get('usuario_id')
            
            amount = session.get('amount_total')
            monto = (amount / 100.0) if amount is not None else 0.0

            try:
                confirmar_pago(session_id)
                
                # Intentamos registrar en bitacora, si tenemos usuario_id
                if usuario_id:
                    # NOTA: obtener el email puede requerir consulta, por simplicidad usamos 'webhook'
                    registrar_accion(
                        usuario_id=usuario_id,
                        usuario_email='webhook_stripe@sistema.com',
                        accion="PAGO_COMPLETADO",
                        detalles={
                            "ip": "0.0.0.0",
                            "session_id": session_id,
                            "monto": monto,
                            "metodo": "stripe"
                        }
                    )
            except Exception as e:
                logger.error(f"Error al confirmar pago desde webhook: {str(e)}")

        return Response(status=status.HTTP_200_OK)


class HistorialPagosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = get_supabase_client()
            
            # Solo los admin deberían ver todo el historial, pero por ahora obtenemos todos o los del usuario
            # Si quisieramos solo los del usuario: .eq('usuario_id', str(request.user.id))
            response = supabase.table('pagos_sistema') \
                .select('*, usuario:usuario_id(nombre, email)') \
                .order('fecha_creacion', desc=True) \
                .execute()
                
            pagos = response.data or []

            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CONSULTAR_HISTORIAL_PAGOS",
                detalles={
                    "ip": ip_cliente,
                    "total_registros_leidos": len(pagos)
                }
            )

            return Response(pagos, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error en HistorialPagosView: {str(e)}")
            return Response({'error': 'No se pudo obtener el historial de pagos'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SaldoPagosView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            supabase = get_supabase_client()

            # Obtener pagos completados
            response = supabase.table('pagos_sistema') \
                .select('monto') \
                .eq('estado', 'completado') \
                .execute()

            pagos = response.data or []
            saldo_total = sum(float(p['monto']) for p in pagos)

            return Response({'saldo_total': saldo_total}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error en SaldoPagosView: {str(e)}")
            return Response({'error': 'No se pudo obtener el saldo total'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ============================================================
#   PayPal (CU36 - Ciclo 5)
# ============================================================

class CrearOrdenPayPalView(APIView):
    """
    POST /api/pagos/paypal/crear-orden/
    Body: { "monto": number, "descripcion": str?, "return_url": str, "cancel_url": str }
    Devuelve { order_id, approve_url } para redirigir al usuario a PayPal.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        monto = request.data.get('monto')
        descripcion = request.data.get('descripcion', 'Pago al sistema')

        if not monto or float(monto) <= 0:
            return Response({'error': 'El monto debe ser mayor a 0.'}, status=status.HTTP_400_BAD_REQUEST)

        origin = request.headers.get('origin', 'http://localhost:5173')
        return_url = request.data.get('return_url') or f"{origin}/ventas"
        cancel_url = request.data.get('cancel_url') or f"{origin}/ventas"

        try:
            resultado = crear_orden_paypal(
                usuario_id=request.user.id,
                monto=monto,
                descripcion=descripcion,
                return_url=return_url,
                cancel_url=cancel_url,
            )

            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="CREAR_ORDEN_PAYPAL",
                detalles={"ip": ip_cliente, "monto": float(monto), "order_id": resultado.get('order_id')}
            )

            return Response(resultado, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error en CrearOrdenPayPalView: {str(e)}")
            return Response({'error': 'No se pudo crear la orden de PayPal'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CapturarPayPalView(APIView):
    """
    POST /api/pagos/paypal/capturar/
    Body: { "order_id": str }
    Captura la orden aprobada y marca el pago como completado.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get('order_id')
        if not order_id:
            return Response({'error': 'Falta order_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resultado = capturar_orden_paypal(order_id)

            if resultado.get('status') == 'COMPLETED':
                ip_cliente = obtener_ip_cliente(request)
                registrar_accion(
                    usuario_id=str(request.user.id),
                    usuario_email=request.user.email,
                    accion="PAGO_COMPLETADO",
                    detalles={"ip": ip_cliente, "order_id": order_id, "metodo": "paypal"}
                )

            return Response(resultado, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error en CapturarPayPalView: {str(e)}")
            return Response({'error': 'No se pudo capturar el pago de PayPal'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PayPalWebhookView(APIView):
    """
    POST /api/pagos/paypal/webhook/

    PayPal llama a este endpoint SERVIDOR-A-SERVIDOR cuando el
    comprador aprueba la orden (evento CHECKOUT.ORDER.APPROVED), sin
    depender de que el navegador del usuario vuelva a la app — a
    diferencia del flujo de retorno en HistorialPagos.tsx, que falla
    si el usuario cierra la pestaña antes de que el JS capture. Mismo
    patrón que StripeWebhookView (CU31).

    Configurar en developer.paypal.com > tu app > Webhooks:
      URL: https://<tu-backend>/api/pagos/paypal/webhook/
      Evento: CHECKOUT.ORDER.APPROVED
    Y copiar el Webhook ID a la variable de entorno PAYPAL_WEBHOOK_ID.
    """
    permission_classes = [AllowAny]  # PayPal llama a este endpoint sin auth

    def post(self, request):
        body_raw = request.body
        try:
            event = json.loads(body_raw)
        except ValueError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not verificar_webhook_paypal(request.headers, body_raw):
            logger.error("Firma de webhook de PayPal inválida")
            return Response(status=status.HTTP_400_BAD_REQUEST)

        event_type = event.get('event_type')
        if event_type == 'CHECKOUT.ORDER.APPROVED':
            resource = event.get('resource', {}) or {}
            order_id = resource.get('id')
            purchase_units = resource.get('purchase_units') or []
            usuario_id = purchase_units[0].get('custom_id') if purchase_units else None

            if order_id:
                try:
                    resultado = capturar_orden_paypal(order_id)
                    if resultado.get('status') == 'COMPLETED':
                        registrar_accion(
                            usuario_id=usuario_id or 'desconocido',
                            usuario_email='webhook_paypal@sistema.com',
                            accion="PAGO_COMPLETADO",
                            detalles={
                                "ip": "0.0.0.0",
                                "order_id": order_id,
                                "metodo": "paypal",
                            }
                        )
                except Exception as e:
                    logger.error(f"Error capturando orden PayPal desde webhook: {str(e)}")

        return Response(status=status.HTTP_200_OK)
