from django.urls import path
from .views import (
    LoginView,
    RegisterView,
    LogoutView,
    ResetPasswordView,
    UserProfileView,
    UserListView,           
    ChangeUserRoleView,      
    ToggleUserActiveView,    
    AdminCreateUserView,  
    AdminUpdateUserView,   
    LogPasswordResetView, # NUEVO
)
from .insumo_views import InsumoListView, InsumoDetailView

"""
Configuración de rutas (URLs) para la app de Usuarios.

Este módulo define todas las rutas de la API relacionadas con
autenticación y gestión de usuarios.

Todas las rutas están bajo el prefijo /api/auth/ definido en nucleo/urls.py.

Rutas:
- POST /api/auth/login/              -> Iniciar sesión
- POST /api/auth/register/           -> Registrar nuevo usuario
- POST /api/auth/logout/             -> Cerrar sesión
- POST /api/auth/reset-password/     -> Solicitar recuperación de contraseña
- GET  /api/auth/profile/            -> Obtener perfil del usuario autenticado
- PATCH /api/auth/profile/           -> Actualizar perfil del usuario autenticado
- GET  /api/auth/users/              -> Listar todos los usuarios (solo admin)
- POST /api/auth/users/create/       -> Crear usuario (solo admin)
- PATCH /api/auth/users/<id>/        -> Actualizar usuario por admin
- PATCH /api/auth/users/<id>/role/   -> Cambiar rol de usuario (solo admin)
- PATCH /api/auth/users/<id>/toggle-active/ -> Activar/desactivar usuario (solo admin)
- POST /api/auth/log-password-reset/ -> Registrar cambio de contraseña en bitácora

Fecha: 05/05/26
"""
urlpatterns = [
    # Autenticación básica
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/reset-password/', ResetPasswordView.as_view(), name='reset-password'),

    # Perfil de usuario
    path('auth/profile/', UserProfileView.as_view(), name='profile'),
    
    
    # Gestión de usuarios (admin) 
    path('auth/users/', UserListView.as_view(), name='user-list'), # GET: Listar usuarios
    path('auth/users/create/', AdminCreateUserView.as_view(), name='admin-create-user'),  # POST: Crear usuario
    path('auth/users/<uuid:user_id>/', AdminUpdateUserView.as_view(), name='admin-update-user'),  # PATCH: Actualizar usuario
    path('auth/users/<uuid:user_id>/role/', ChangeUserRoleView.as_view(), name='change-role'),  #PATCH: Cambiar rol
    path('auth/users/<uuid:user_id>/toggle-active/', ToggleUserActiveView.as_view(), name='toggle-active'),  # PATCH: Activar/desactivar
    
    # Bitácora
    path('auth/log-password-reset/', LogPasswordResetView.as_view(), name='log-password-reset'),

    # ============================================
    #             ---- CICLO #2 ----
    # ============================================
    # ---- CU7 ----
    path('insumos/', InsumoListView.as_view(), name='insumo-list'),
    path('insumos/<int:insumo_id>/', InsumoDetailView.as_view(), name='insumo-detail'),
]