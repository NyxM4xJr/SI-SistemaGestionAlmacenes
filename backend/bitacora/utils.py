"""
Utilidades para el registro de bitácora en Supabase.

Este módulo proporciona funciones helper para registrar acciones
de auditoría directamente en la tabla 'bitacora' de Supabase
utilizando la API REST oficial.

¿Por qué usamos la API de Supabase en lugar del ORM de Django?
- Evitamos configurar PostgreSQL como base de datos principal.
- Mantenemos la simplicidad del proyecto.
- Usamos el mismo patrón que para otras tablas (alertas, reportes, etc.).
- La API de Supabase es escalable y profesional.

Autor: Grupo 2 - INF342
Fecha: Abril 11/05/26
Última modificación: Abril 2026 - Cambio a API de Supabase
"""

from supabase import create_client
from django.conf import settings
from datetime import datetime, timezone, timedelta
import logging

# Configurar logger para este módulo
# Esto permite ver mensajes de éxito/error en la consola de Django
logger = logging.getLogger(__name__)

# Zona horaria de Bolivia (UTC-4)
BOLIVIA_TZ = timezone(timedelta(hours=-4))





def obtener_ip_cliente(request) -> str:
    """
    Obtiene la dirección IP real del cliente desde el objeto request de Django.
    
    Esta función considera proxies y cabeceras comunes (como HTTP_X_FORWARDED_FOR)
    para obtener la IP real del usuario, incluso si la aplicación está detrás
    de un balanceador de carga o proxy (como Railway).
    
    Args:
        request: Objeto HttpRequest de Django que contiene los metadatos de la petición.
    
    Returns:
        str: Dirección IP del cliente en formato string (ej: "192.168.1.10").
             Si no se puede determinar, devuelve "IP no disponible".
    
    Example:
        >>> ip = obtener_ip_cliente(request)
        >>> print(ip)
        '192.168.1.10'
    """
    # Intentar obtener la IP de la cabecera HTTP_X_FORWARDED_FOR
    # Esta cabecera es estándar cuando la app está detrás de un proxy
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    
    if x_forwarded_for:
        # Si hay múltiples IPs (separadas por coma), la primera es la del cliente original
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        # Si no hay proxy, usar REMOTE_ADDR (IP directa de la conexión)
        ip = request.META.get('REMOTE_ADDR', 'IP no disponible')
    
    return ip


def registrar_accion(usuario_id: str, usuario_email: str, accion: str, detalles: dict = None) -> bool:
    """
    Registra una acción de auditoría directamente en la tabla 'bitacora' de Supabase.
    
    Esta función debe ser llamada cada vez que ocurra un evento relevante que requiera
    ser auditado (login, logout, cambios de rol, activación/desactivación de usuarios, etc.).
    
    Utiliza la API REST de Supabase (create_client) para insertar un registro
    en la tabla 'bitacora'. NO depende del ORM de Django.
    
    Args:
        usuario_id (str): UUID del usuario que realiza la acción.
        usuario_email (str): Email del usuario que realiza la acción.
        accion (str): Tipo de acción realizada. Valores típicos:
                      "LOGIN", "LOGIN_FALLIDO", "LOGOUT", "REGISTER",
                      "CHANGE_ROLE", "TOGGLE_ACTIVE", "UPDATE_PROFILE", etc.
        detalles (dict, optional): Diccionario con información adicional en formato JSON.
                                   Puede incluir: IP, navegador, usuario afectado,
                                   valores anteriores/nuevos, etc.
                                   Por defecto es un diccionario vacío {}.
    
    Returns:
        bool: True si el registro se insertó correctamente en Supabase.
              False en caso de cualquier error (conexión, permisos, etc.).
              El error se registra en el logger para depuración.
    
    Example:
        >>> # Registrar un login exitoso
        >>> registrar_accion(
        ...     usuario_id="123e4567-e89b-12d3-a456-426614174000",
        ...     usuario_email="chef@cocina.com",
        ...     accion="LOGIN",
        ...     detalles={"ip": "192.168.1.10", "exitoso": True}
        ... )
        True
        
        >>> # Registrar un cambio de rol
        >>> registrar_accion(
        ...     usuario_id="admin-id",
        ...     usuario_email="admin@cocina.com",
        ...     accion="CHANGE_ROLE",
        ...     detalles={
        ...         "ip": "192.168.1.10",
        ...         "usuario_afectado": "usuario-id",
        ...         "nuevo_rol": "administrador"
        ...     }
        ... )
        True
    """
    print(f"🔥🔥🔥 BITÁCORA LLAMADA: {usuario_email} - {accion}")
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        
        fecha_bolivia = datetime.now(BOLIVIA_TZ).isoformat()
        
        # Decidir en qué tabla registrar según la acción
        if accion in ['LOGIN', 'LOGOUT', 'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO']:
            # ============================================
            # Registrar en bitacora (solo login/logout)
            # ============================================
            data = {
                'usuario_id': usuario_id,
                'usuario_email': usuario_email,
                'accion': accion,
                'detalles': detalles or {},
                'fecha': fecha_bolivia,
            }
            response = supabase.table('bitacora').insert(data).execute()
            
            if response.data:
                logger.info(f"✅ Bitácora (LOGIN/LOGOUT): {usuario_email} - {accion}")
                return True
        
        else:
            # ============================================
            # Registrar en detalle_bitacora (resto de acciones)
            # ============================================
            ip = detalles.get('ip', 'no disponible') if detalles else 'no disponible'
            
            data = {
                'usuario_id': usuario_id,
                'accion': accion,
                'descripcion': str(detalles) if detalles else '',
                'ip_address': ip,
                'created_at': fecha_bolivia,
            }
            response = supabase.table('detalle_bitacora').insert(data).execute()
            
            if response.data:
                logger.info(f"✅ Detalle bitácora: {usuario_email} - {accion}")
                return True
        
        logger.error(f"❌ Error registrando: Respuesta vacía de Supabase")
        return False
            
    except Exception as e:
        logger.error(f"❌ Error registrando para {usuario_email}: {str(e)}")
        return False       
    except Exception as e:
        # 5. Capturar cualquier excepción (error de conexión, timeout, etc.)
        #    NO relanzamos la excepción para que el flujo principal de la aplicación
        #    no se vea interrumpido por un fallo en la bitácora.
        logger.error(f"❌ Error registrando bitácora para {usuario_email}: {str(e)}")
        return False