import stripe
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
        from datetime import datetime
        
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
