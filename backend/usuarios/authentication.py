from rest_framework import authentication
from rest_framework import exceptions
from supabase import create_client
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class SupabaseAuthentication(authentication.BaseAuthentication):
    """
    Autenticación personalizada usando Supabase JWT.
    """
    
    def authenticate(self, request):
        # 1. Obtener el token del header de forma robusta
        auth_header = (
            request.headers.get('Authorization')
            or request.headers.get('authorization')
            or request.META.get('HTTP_AUTHORIZATION')
            or request.META.get('Authorization')
        )

        logger.debug(f"SupabaseAuthentication: Authorization header={auth_header}")

        if not auth_header:
            logger.warning("SupabaseAuthentication: authorization header no encontrado")
            return None

        # 2. Extraer el token (formato: "Bearer <token>")
        parts = auth_header.split()
        
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            logger.error(f"SupabaseAuthentication: formato de token invalido: {auth_header}")
            raise exceptions.AuthenticationFailed('Formato de token invalido')
        
        token = parts[1].strip()
        logger.debug(f"SupabaseAuthentication: token length={len(token) if token else '0'}")
        
        # 3. Validar el token contra Supabase
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            user_response = supabase.auth.get_user(token)
            
            if not user_response or not getattr(user_response, 'user', None):
                logger.error("SupabaseAuthentication: usuario no encontrado en respuesta de get_user")
                raise exceptions.AuthenticationFailed('Token invalido o expirado')
            
            # 4. Obtener el rol desde la tabla usuario
            user_id = user_response.user.id
            profile_response = supabase.table('usuario').select('rol, nombre').eq('id', user_id).execute()
            
            rol = 'usuario'  # valor por defecto
            nombre = user_response.user.email.split('@')[0]
            
            if profile_response.data:
                rol = profile_response.data[0].get('rol', 'usuario')
                nombre = profile_response.data[0].get('nombre', nombre)
            
            # 5. Crear un objeto usuario simple para DRF CON EL ROL
            user = type('User', (), {
                'id': user_response.user.id,
                'email': user_response.user.email,
                'nombre': nombre,
                'rol': rol,  # <-- ¡AÑADIMOS EL ROL!
                'is_authenticated': True,
            })()
            
            return (user, token)
            
        except Exception as e:
            logger.error(f"Error de autenticacion Supabase: {str(e)}")
            raise exceptions.AuthenticationFailed('Error al validar credenciales')
    
    def authenticate_header(self, request):
        return 'Bearer'