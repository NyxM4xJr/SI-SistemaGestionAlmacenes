import stripe
import requests
import json
from datetime import datetime
from django.conf import settings
from supabase import create_client
import logging

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

def get_supabase_client():
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def crear_sesion_stripe(usuario_id, monto, descripcion, success_url, cancel_url):
    """
    Crea una sesión de Stripe y un registro en 'pagos_sistema' como 'pendiente'.
    """
    try:
        # Crear la sesión en Stripe
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'bob', # Moneda bolivianos
                    'product_data': {
                        'name': 'Depósito al Sistema',
                        'description': descripcion or 'Depósito de fondos',
                    },
                    'unit_amount': int(float(monto) * 100), # Stripe espera centavos
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url + '?session_id={CHECKOUT_SESSION_ID}',
            cancel_url=cancel_url,
            client_reference_id=str(usuario_id),
            metadata={
                'usuario_id': str(usuario_id),
                'descripcion': descripcion or ''
            }
        )

        # Registrar en Supabase como pendiente
        supabase = get_supabase_client()
        pago_data = {
            'usuario_id': str(usuario_id),
            'monto': float(monto),
            'moneda': 'BOB',
            'estado': 'pendiente',
            'stripe_session_id': session.id,
            'metodo': 'stripe',
            'descripcion': descripcion or ''
        }
        
        supabase.table('pagos_sistema').insert(pago_data).execute()

        return session.url
    except Exception as e:
        logger.error(f"Error al crear sesión de Stripe: {str(e)}")
        raise e

def confirmar_pago(session_id):
    """
    Actualiza el estado del pago en 'pagos_sistema' a 'completado'.
    """
    try:
        supabase = get_supabase_client()

        update_data = {
            'estado': 'completado',
            'fecha_completado': datetime.now().isoformat()
        }

        supabase.table('pagos_sistema') \
            .update(update_data) \
            .eq('stripe_session_id', session_id) \
            .execute()
    except Exception as e:
        logger.error(f"Error al confirmar pago en BD: {str(e)}")
        raise e


# ============================================================
#   PayPal (CU36 - Ciclo 5) — Segunda pasarela de pago
#   Flujo server-side por redirección (análogo a Stripe):
#   crear orden -> aprobar en PayPal -> capturar al volver.
#   NOTA: PayPal sandbox no admite BOB; se usa USD.
# ============================================================

def _paypal_base_url():
    """URL base de la API de PayPal según el modo configurado."""
    if (settings.PAYPAL_MODE or 'sandbox') == 'live':
        return 'https://api-m.paypal.com'
    return 'https://api-m.sandbox.paypal.com'


def _obtener_token_paypal():
    """Obtiene un access token OAuth2 (client_credentials)."""
    resp = requests.post(
        f"{_paypal_base_url()}/v1/oauth2/token",
        auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
        data={'grant_type': 'client_credentials'},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()['access_token']


def crear_orden_paypal(usuario_id, monto, descripcion, return_url, cancel_url):
    """
    Crea una orden de PayPal (intent CAPTURE) y registra el pago en
    'pagos_sistema' como pendiente con metodo='paypal'.

    Returns:
        dict: { 'order_id': str, 'approve_url': str }
    """
    try:
        token = _obtener_token_paypal()

        body = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {
                    'currency_code': 'USD',  # PayPal sandbox no admite BOB
                    'value': f"{float(monto):.2f}",
                },
                'description': (descripcion or 'Pago al sistema')[:127],
                # custom_id permite identificar al usuario desde el webhook,
                # análogo a 'metadata' en la sesión de Stripe.
                'custom_id': str(usuario_id),
            }],
            'application_context': {
                'return_url': return_url,
                'cancel_url': cancel_url,
                'user_action': 'PAY_NOW',
                'shipping_preference': 'NO_SHIPPING',
            },
        }

        resp = requests.post(
            f"{_paypal_base_url()}/v2/checkout/orders",
            json=body,
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()

        order_id = data['id']
        approve_url = next(
            (l['href'] for l in data.get('links', []) if l.get('rel') == 'approve'),
            None
        )

        # Registrar en Supabase como pendiente
        supabase = get_supabase_client()
        supabase.table('pagos_sistema').insert({
            'usuario_id': str(usuario_id),
            'monto': float(monto),
            'moneda': 'USD',
            'estado': 'pendiente',
            'paypal_order_id': order_id,
            'metodo': 'paypal',
            'descripcion': descripcion or '',
        }).execute()

        return {'order_id': order_id, 'approve_url': approve_url}
    except Exception as e:
        logger.error(f"Error al crear orden de PayPal: {str(e)}")
        raise e


def capturar_orden_paypal(order_id):
    """
    Captura una orden de PayPal aprobada y, si queda COMPLETED,
    marca el pago como 'completado' en 'pagos_sistema'.

    Idempotente: si el webhook ya capturó esta orden, no vuelve a
    llamar a PayPal (evita el error ORDER_ALREADY_CAPTURED cuando el
    webhook y el retorno del navegador se disparan casi al mismo tiempo).

    Returns:
        dict: { 'status': str, 'order_id': str }
    """
    try:
        supabase = get_supabase_client()
        ya = supabase.table('pagos_sistema').select('estado') \
            .eq('paypal_order_id', order_id).execute()
        if ya.data and ya.data[0].get('estado') == 'completado':
            return {'status': 'COMPLETED', 'order_id': order_id}

        token = _obtener_token_paypal()

        resp = requests.post(
            f"{_paypal_base_url()}/v2/checkout/orders/{order_id}/capture",
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        estado = data.get('status')

        if estado == 'COMPLETED':
            supabase = get_supabase_client()
            supabase.table('pagos_sistema').update({
                'estado': 'completado',
                'fecha_completado': datetime.now().isoformat(),
            }).eq('paypal_order_id', order_id).execute()

        return {'status': estado, 'order_id': order_id}
    except Exception as e:
        logger.error(f"Error al capturar orden de PayPal: {str(e)}")
        raise e


def verificar_webhook_paypal(headers, body_raw):
    """
    Verifica la firma de un webhook de PayPal contra la 'Verify Webhook
    Signature API'. Requiere PAYPAL_WEBHOOK_ID configurado (ver
    developer.paypal.com > tu app > Webhooks).

    Si no hay PAYPAL_WEBHOOK_ID configurado, no verifica y deja pasar
    el evento (mismo patrón de degradación que StripeWebhookView cuando
    falta STRIPE_WEBHOOK_SECRET) — solo para no bloquear el desarrollo
    local; en producción SIEMPRE debe configurarse.
    """
    webhook_id = getattr(settings, 'PAYPAL_WEBHOOK_ID', None)
    if not webhook_id:
        logger.warning("PAYPAL_WEBHOOK_ID no configurado: webhook sin verificar firma")
        return True

    try:
        token = _obtener_token_paypal()
        payload = {
            'transmission_id': headers.get('Paypal-Transmission-Id'),
            'transmission_time': headers.get('Paypal-Transmission-Time'),
            'cert_url': headers.get('Paypal-Cert-Url'),
            'auth_algo': headers.get('Paypal-Auth-Algo'),
            'transmission_sig': headers.get('Paypal-Transmission-Sig'),
            'webhook_id': webhook_id,
            'webhook_event': json.loads(body_raw),
        }
        resp = requests.post(
            f"{_paypal_base_url()}/v1/notifications/verify-webhook-signature",
            json=payload,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get('verification_status') == 'SUCCESS'
    except Exception as e:
        logger.error(f"Error verificando webhook de PayPal: {str(e)}")
        return False
