from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from supabase import create_client
from bitacora.utils import registrar_accion, obtener_ip_cliente
from django.conf import settings
from django.http import Http404
import logging

from .serializers import LoginSerializer, RegisterSerializer, ResetPasswordSerializer

logger = logging.getLogger(__name__)


class LoginView(APIView):
    """
    Endpoint para iniciar sesión con Supabase Auth.
    
    Método: POST
    URL: /api/auth/login/
    Body: { "email": "usuario@example.com", "password": "123456" }
    
    Flujo:
    1. Valida credenciales con Supabase Auth.
    2. Si son correctas, verifica que la cuenta esté activa.
    3. Si la cuenta está desactivada, cierra sesión y devuelve error 403.
    4. Si el email no está confirmado, devuelve error 403 con instrucciones.
    5. Si todo es correcto, devuelve tokens de acceso.
    6. Registra la acción en la bitácora (LOGIN o LOGIN_FALLIDO).
    7. Registra el intento en login_attempts para control de bloqueo.
    
    Respuesta exitosa (200):
    {
        "access_token": "...",
        "refresh_token": "...",
        "user": { "id": "...", "email": "..." }
    }
    
    Posibles errores:
    - 400: Datos inválidos (falta email o password).
    - 401: Credenciales inválidas.
    - 403: Cuenta desactivada, email no confirmado, o cuenta bloqueada por intentos.
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            auth_response = supabase.auth.sign_in_with_password({
                'email': email,
                'password': password
            })
            
            # ============================================
            #  NUEVO: Registrar intento EXITOSO en login_attempts
            # ============================================
            try:
                ip_cliente = obtener_ip_cliente(request)
                supabase.table('login_attempts').insert({
                    'email': email,
                    'ip_address': ip_cliente,
                    'success': True
                }).execute()
            except Exception as log_error:
                logger.error(f"Error registrando intento exitoso: {str(log_error)}")
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=auth_response.user.id,
                usuario_email=email,
                accion="LOGIN",
                detalles={
                    "ip": ip_cliente,
                    "exitoso": True
                }
            )
            
            # Verificar si el usuario está activo en nuestra tabla
            user_id = auth_response.user.id
            profile = supabase.table('usuario').select('activo', 'rol', 'nombre').eq('id', user_id).execute()

            if profile.data and profile.data[0].get('activo') == False:
                supabase.auth.sign_out()
                return Response({
                    'error': 'Tu cuenta ha sido desactivada. Contacta al administrador.'
                }, status=status.HTTP_403_FORBIDDEN)
            
            # Verificar si el email está confirmado
            try:
                user_details = supabase.auth.admin.get_user_by_id(user_id)
                if user_details.user and not user_details.user.email_confirmed_at:
                    return Response({
                        'error': 'Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada y haz clic en el enlace de confirmación.'
                    }, status=status.HTTP_403_FORBIDDEN)
            except:
                pass

            return Response({
                'access_token': auth_response.session.access_token,
                'refresh_token': auth_response.session.refresh_token,
                'user': {
                    'id': auth_response.user.id,
                    'email': auth_response.user.email,
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error en login: {str(e)}")
            
            # ============================================
            #  NUEVO: Registrar intento FALLIDO en login_attempts
            # ============================================
            try:
                ip_cliente = obtener_ip_cliente(request)
                supabase.table('login_attempts').insert({
                    'email': email,
                    'ip_address': ip_cliente,
                    'success': False
                }).execute()
            except Exception as log_error:
                logger.error(f"Error registrando intento fallido: {str(log_error)}")
            
            # ============================================
            #  NUEVO: Verificar si debe ser BLOQUEADO
            # ============================================
            try:
                from datetime import datetime, timedelta
                limite_tiempo = (datetime.now() - timedelta(minutes=15)).isoformat()
                
                intentos = supabase.table('login_attempts') \
                    .select('*', count='exact') \
                    .eq('email', email) \
                    .eq('success', False) \
                    .gte('attempt_time', limite_tiempo) \
                    .execute()
                
                if intentos.count and intentos.count >= 3:
                    # Registrar en bitácora el bloqueo
                    try:
                        ip_cliente = obtener_ip_cliente(request)
                        registrar_accion(
                            usuario_id="00000000-0000-0000-0000-000000000000",
                            usuario_email=email,
                            accion="LOGIN_BLOQUEADO",
                            detalles={
                                "ip": ip_cliente,
                                "intentos_fallidos": intentos.count
                            }
                        )
                    except:
                        pass
                    
                    return Response({
                        'error': 'Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente. Espera 15 minutos e inténtalo de nuevo.'
                    }, status=status.HTTP_403_FORBIDDEN)
            except Exception as block_error:
                logger.error(f"Error verificando bloqueo: {str(block_error)}")
            
            # Registrar fallo en bitácora
            try:
                ip_cliente = obtener_ip_cliente(request)
                registrar_accion(
                    usuario_id="00000000-0000-0000-0000-000000000000",
                    usuario_email=email,
                    accion="LOGIN_FALLIDO",
                    detalles={
                        "ip": ip_cliente,
                        "exitoso": False,
                        "error": str(e)
                    }
                )
            except:
                pass
            
            return Response({
                'error': 'Credenciales inválidas'
            }, status=status.HTTP_401_UNAUTHORIZED)

class RegisterView(APIView):
    """
    Endpoint para registrar nuevos usuarios.
    POST /api/auth/register/
    Body: { "email": "nuevo@example.com", "password": "123456", "nombre": "Juan Perez", "rol": "usuario"(por defecto) }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        nombre = serializer.validated_data['nombre']
        rol = serializer.validated_data.get('rol', 'usuario')  # <-- Usar 'usuario' si no se envía
        
        # FORZAR 'usuario' para todos los nuevos registros
        rol = 'usuario'
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # 1. Crear usuario en Supabase Auth
            auth_response = supabase.auth.sign_up({
                'email': email,
                'password': password,
                'options': {
                    'data': {
                        'nombre': nombre,
                        'rol': rol,
                    }
                }
            })
            
            # 2. El trigger on_auth_user_created ya inserta en public.usuario
            #    Pero actualizamos el nombre por si acaso
            supabase.table('usuario').update({
                'nombre': nombre,
                'rol': rol,
            }).eq('id', auth_response.user.id).execute()
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=auth_response.user.id,
                usuario_email=email,
                accion="REGISTER",
                detalles={
                    "ip": ip_cliente,
                    "rol_inicial": rol
                }
            )

            return Response({
                'message': 'Usuario registrado exitosamente',
                'user': {
                    'id': auth_response.user.id,
                    'email': email,
                    'nombre': nombre,
                    'rol': rol,
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error en registro: {str(e)}")
            return Response({
                'error': 'Error al registrar usuario. Puede que el email ya esté en uso.'
            }, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    Endpoint para cerrar sesión.
    POST /api/auth/logout/
    Headers: Authorization: Bearer <access_token>
    """
    def post(self, request):
        try:
            # Registrar en bitácora
            if hasattr(request.user, 'id') and hasattr(request.user, 'email'):
                ip_cliente = obtener_ip_cliente(request)
                registrar_accion(
                    usuario_id=request.user.id,
                    usuario_email=request.user.email,
                    accion="LOGOUT",
                    detalles={"ip": ip_cliente}
                )

            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Obtener token del header
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
                supabase.auth.sign_out(token)
            
            return Response({'message': 'Sesión cerrada exitosamente'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error en logout: {str(e)}")
            return Response({'error': 'Error al cerrar sesión'}, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    """
    Endpoint para solicitar recuperación de contraseña.
    POST /api/auth/reset-password/
    Body: { "email": "usuario@example.com" }
    """
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        email = serializer.validated_data['email']
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            supabase.auth.reset_password_email(email)
            
            # Registrar en bitácora (sin usuario_id porque aún no está autenticado)
            ip_cliente = obtener_ip_cliente(request)
            try:
                # Intentar obtener el ID del usuario por email
                supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                user_response = supabase.table('usuario').select('id').eq('email', email).execute()
                usuario_id = user_response.data[0]['id'] if user_response.data else "desconocido"
            except:
                usuario_id = "desconocido"

            registrar_accion(
                usuario_id=usuario_id,
                usuario_email=email,
                accion="PASSWORD_RESET_REQUESTED",
                detalles={
                    "ip": ip_cliente
                }
            )

            return Response({
                'message': 'Se ha enviado un enlace de recuperación a tu email'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error en reset password: {str(e)}")
            # Por seguridad, no revelamos si el email existe o no
            return Response({
                'message': 'Si el email está registrado, recibirás un enlace de recuperación'
            }, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """
    Endpoint para obtener el perfil del usuario autenticado.
    GET /api/auth/profile/
    Headers: Authorization: Bearer <access_token>
    """
    def get(self, request):
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Obtener datos de la tabla 'usuario'
            response = supabase.table('usuario').select('*').eq('id', request.user.id).execute()
            
            if response.data:
                user_data = response.data[0]
                return Response({
                    'id': user_data['id'],
                    'email': user_data['email'],
                    'nombre': user_data['nombre'],
                    'rol': user_data['rol'],
                    'telefono': user_data.get('telefono'),
                }, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Usuario no encontrado'}, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            logger.error(f"Error obteniendo perfil: {str(e)}")
            return Response({'error': 'Error al obtener perfil'}, status=status.HTTP_400_BAD_REQUEST)
        
    def patch(self, request):
        """
        Actualiza el perfil del usuario autenticado.
        PATCH /api/auth/profile/
        Body: { "nombre": "Nuevo nombre", "email": "nuevo@email.com" }
        """
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            user_id = request.user.id
            update_data = {}
            
            if 'nombre' in request.data:
                update_data['nombre'] = request.data['nombre']
            if 'email' in request.data:
                update_data['email'] = request.data['email']
            
            if not update_data:
                return Response(
                    {'error': 'Al menos un campo (nombre o email) es requerido'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Actualizar en la tabla usuario
            response = supabase.table('usuario').update(update_data).eq('id', str(user_id)).execute()
            
            if not response.data:
                return Response(
                    {'error': 'Usuario no encontrado'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Si se actualizó el email, también actualizar en auth.users
            if 'email' in update_data:
                try:
                    supabase.auth.admin.update_user_by_id(
                        str(user_id), 
                        {'email': update_data['email']}
                    )
                except Exception as e:
                    logger.warning(f"No se pudo actualizar email en auth.users: {str(e)}")
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(user_id),
                usuario_email=request.user.email,
                accion="UPDATE_PROFILE",
                detalles={
                    "ip": ip_cliente,
                    "campos_actualizados": list(update_data.keys())
                }
            )

            return Response({
                'message': 'Perfil actualizado exitosamente',
                'nombre': response.data[0].get('nombre'),
                'email': response.data[0].get('email')
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error actualizando perfil: {str(e)}")
            return Response(
                {'error': f'Error al actualizar perfil: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
class UserListView(APIView):
    """
    Lista todos los usuarios (solo para administradores).
    GET /api/auth/users/
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Verificar que el usuario es administrador
        # NOTA: request.user.rol viene del objeto que creamos en SupabaseAuthentication
        if not hasattr(request.user, 'rol') or request.user.rol != 'administrador':
            return Response(
                {'error': 'No tienes permiso para ver esta lista'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            response = supabase.table('usuario').select('*').execute()
            
            return Response(response.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            # IMPRIMIR EL ERROR COMPLETO EN LA CONSOLA
            import traceback
            print("=" * 50)
            print("ERROR EN UserListView:")
            traceback.print_exc()
            print("=" * 50)
            logger.error(f"Error listando usuarios: {str(e)}")
            return Response(
                {'error': f'Error al obtener la lista de usuarios: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ChangeUserRoleView(APIView):
    """
    Cambia el rol de un usuario (solo para administradores).
    PATCH /api/auth/users/<uuid:id>/role/
    Body: { "rol": "chef" | "administrador" | "usuario" }
    """
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, user_id):
        # Verificar que el usuario es administrador
        if request.user.rol != 'administrador':
            return Response(
                {'error': 'No tienes permiso para cambiar roles'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        nuevo_rol = request.data.get('rol')
        if nuevo_rol not in ['chef', 'administrador', 'gerente', 'usuario']:
            return Response(
                {'error': 'Rol inválido'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # No permitir cambiarse el rol a sí mismo
        if str(request.user.id) == str(user_id):
            return Response(
                {'error': 'No puedes cambiar tu propio rol'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # SOLO actualizar la tabla usuario (no tocar auth.users)
            response = supabase.table('usuario').update({
                'rol': nuevo_rol
            }).eq('id', str(user_id)).execute()
            
            if not response.data:
                raise Http404("Usuario no encontrado")
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=request.user.id,
                usuario_email=request.user.email,
                accion="CHANGE_ROLE",
                detalles={
                    "ip": ip_cliente,
                    "usuario_afectado": str(user_id),
                    "nuevo_rol": nuevo_rol
                }
            )

            return Response({
                'message': 'Rol actualizado exitosamente',
                'user': response.data[0]
            }, status=status.HTTP_200_OK)
            
        except Http404:
            raise
        except Exception as e:
            logger.error(f"Error cambiando rol: {str(e)}")
            return Response(
                {'error': f'Error al cambiar el rol: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ToggleUserActiveView(APIView):
    """
    Activa/desactiva un usuario (solo para administradores).
    PATCH /api/auth/users/<uuid:id>/toggle-active/
    """
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, user_id):
        # Verificar que el usuario es administrador
        if request.user.rol != 'administrador':
            return Response(
                {'error': 'No tienes permiso para modificar usuarios'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # No permitir desactivarse a sí mismo
        if str(request.user.id) == str(user_id):
            return Response(
                {'error': 'No puedes desactivar tu propia cuenta'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Obtener estado actual
            user_response = supabase.table('usuario').select('activo').eq('id', str(user_id)).execute()
            if not user_response.data:
                raise Http404("Usuario no encontrado")
            
            current_active = user_response.data[0].get('activo', True)
            new_active = not current_active
            
            # SOLO actualizar la tabla usuario (no tocar auth.users)
            response = supabase.table('usuario').update({
                'activo': new_active
            }).eq('id', str(user_id)).execute()
            
            # Registrar en bitácora
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=request.user.id,
                usuario_email=request.user.email,
                accion="TOGGLE_ACTIVE",
                detalles={
                    "ip": ip_cliente,
                    "usuario_afectado": str(user_id),
                    "nuevo_estado": "activado" if new_active else "desactivado"
                }
            )
            
            return Response({
                'message': f'Usuario {"activado" if new_active else "desactivado"} exitosamente',
                'user': response.data[0]
            }, status=status.HTTP_200_OK)
            
        except Http404:
            raise
        except Exception as e:
            logger.error(f"Error toggle active: {str(e)}")
            return Response(
                {'error': f'Error al cambiar el estado: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

class AdminCreateUserView(APIView):
    """
    Permite a un administrador crear un nuevo usuario manualmente.
    POST /api/auth/users/
    Body: { "email": "...", "password": "...", "nombre": "...", "rol": "..." }
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Verificar que el usuario es administrador
        if request.user.rol != 'administrador':
            return Response(
                {'error': 'No tienes permiso para crear usuarios'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        email = request.data.get('email')
        password = request.data.get('password')
        nombre = request.data.get('nombre')
        rol = request.data.get('rol', 'usuario')
        
        if not all([email, password, nombre]):
            return Response(
                {'error': 'Email, password y nombre son requeridos'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if rol not in ['chef', 'administrador', 'gerente', 'usuario']:
            return Response(
                {'error': 'Rol inválido'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            # Crear usuario en Supabase Auth
            auth_response = supabase.auth.admin.create_user({
                'email': email,
                'password': password,
                'email_confirm': True,  # Confirmar automáticamente
                'user_metadata': {'nombre': nombre, 'rol': rol}
            })
            
            # Insertar en tabla usuario
            supabase.table('usuario').insert({
                'id': auth_response.user.id,
                'nombre': nombre,
                'email': email,
                'rol': rol,
                'activo': True
            }).execute()
            
            return Response({
                'message': 'Usuario creado exitosamente',
                'user': {
                    'id': auth_response.user.id,
                    'email': email,
                    'nombre': nombre,
                    'rol': rol
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creando usuario: {str(e)}")
            return Response(
                {'error': f'Error al crear usuario: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class AdminUpdateUserView(APIView):
    """
    Permite a un administrador editar datos básicos de un usuario.
    PATCH /api/auth/users/<uuid:id>/
    Body: { "nombre": "...", "email": "..." }
    """
    permission_classes = [IsAuthenticated]
    
    def patch(self, request, user_id):
        if request.user.rol != 'administrador':
            return Response(
                {'error': 'No tienes permiso para editar usuarios'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        nombre = request.data.get('nombre')
        email = request.data.get('email')
        
        if not nombre and not email:
            return Response(
                {'error': 'Al menos un campo (nombre o email) es requerido'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            
            update_data = {}
            if nombre:
                update_data['nombre'] = nombre
            if email:
                update_data['email'] = email
            
            response = supabase.table('usuario').update(update_data).eq('id', str(user_id)).execute()
            
            if not response.data:
                raise Http404("Usuario no encontrado")
            
            # Si cambió el email, actualizar en auth.users
            if email:
                supabase.auth.admin.update_user_by_id(str(user_id), {'email': email})
            
            return Response({
                'message': 'Usuario actualizado exitosamente',
                'user': response.data[0]
            }, status=status.HTTP_200_OK)
            
        except Http404:
            raise
        except Exception as e:
            logger.error(f"Error actualizando usuario: {str(e)}")
            return Response(
                {'error': f'Error al actualizar: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LogPasswordResetView(APIView):
    """
    Registra en bitácora que un usuario completó el cambio de contraseña.
    POST /api/auth/log-password-reset/
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            ip_cliente = obtener_ip_cliente(request)
            registrar_accion(
                usuario_id=str(request.user.id),
                usuario_email=request.user.email,
                accion="PASSWORD_RESET_COMPLETED",
                detalles={"ip": ip_cliente}
            )
            return Response({'message': 'Registrado'}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error registrando password reset: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)