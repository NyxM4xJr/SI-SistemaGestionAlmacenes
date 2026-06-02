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
    LogPasswordResetView,
)
from .insumo_views import InsumoListView, InsumoDetailView, InsumoHistorialPreciosView
from .estacionalidad_views import EstacionalidadView
from .stock_views import StockListView, StockDetailView
from .ficha_views import FichaTecnicaView
from .bitacora_views import DetalleBitacoraListView
from .plato_views import PlatoListView, PlatoDetailView  # CU20
from .receta_views import (                                       # CU21
    RecetaListView,
    RecetaDetailView,
    RecetaCatalogosView,
)
from .menu_views import MenuListView, MenuDetailView, DetalleMenuView # CU23

from .movimiento_views import MovimientoListView, MovimientoDetailView #CU14
from .alerta_views import AlertaListView, AlertaConteoView, AlertaDetailView # CU13


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
    # ---- CU7 GESTION DE INSUMOS ----
    path('insumos/', InsumoListView.as_view(), name='insumo-list'),
    path('insumos/<int:insumo_id>/', InsumoDetailView.as_view(), name='insumo-detail'),
    path('insumos/<int:insumo_id>/historial-precios/', InsumoHistorialPreciosView.as_view(), name='insumo-historial-precios'),
    path('insumos/<int:insumo_id>/estacionalidad/', EstacionalidadView.as_view(), name='insumo-estacionalidad'),

    # ---- CU8 CONSULTAR FICHA TECNICA----
    path('insumos/<int:insumo_id>/ficha-tecnica/', FichaTecnicaView.as_view(), name='ficha-tecnica'),

    #=======CU 12 GESTION DE STOCK =======================
    path("stock/", StockListView.as_view()),
    path("stock/<int:stock_id>/", StockDetailView.as_view()),

    # ----- CU30 BITACORA DET. -------
    path('bitacora/completa/', DetalleBitacoraListView.as_view(), name='bitacora-completa'),


    # ============================================
    #             ---- CICLO #3 ----
    # ============================================
    # ---- CU20 GESTIONAR PLATOS DEL MENÚ ----
    path('platos/', PlatoListView.as_view(), name='plato-list'),           # GET: listar | POST: crear
    path('platos/<int:plato_id>/', PlatoDetailView.as_view(), name='plato-detail'),  # GET / PATCH / DELETE

    # ---- CU21 GESTIONAR RECETAS ----
    # IMPORTANTE: catalogos/ va ANTES de <int:receta_id>/ para evitar conflicto de rutas
    path('recetas/catalogos/', RecetaCatalogosView.as_view(), name='receta-catalogos'),
    path('recetas/', RecetaListView.as_view(), name='receta-list'),
    path('recetas/<int:receta_id>/', RecetaDetailView.as_view(), name='receta-detail'),

    # ---- CU23 GESTIONAR MENUS ----
    path('menus/', MenuListView.as_view(), name='menu-list'),
    path('menus/<int:menu_id>/', MenuDetailView.as_view(), name='menu-detail'),
    path('menus/<int:menu_id>/platos/', DetalleMenuView.as_view(), name='menu-plato-add'),
    path('menus/<int:menu_id>/platos/<int:detalle_id>/', DetalleMenuView.as_view(), name='menu-plato-delete'),

    # ---- CU14 MOVIMIENTOS DE INVENTARIO ----
    path('movimientos/', MovimientoListView.as_view(), name='movimiento-list'),
    path('movimientos/<int:movimiento_id>/', MovimientoDetailView.as_view(), name='movimiento-detail'),

    # ---- CU13 GESTIONAR ALERTAS ----
    path('alertas/', AlertaListView.as_view(), name='alerta-list'),
    path('alertas/conteo/', AlertaConteoView.as_view(), name='alerta-conteo'),
    path('alertas/<int:alerta_id>/', AlertaDetailView.as_view(), name='alerta-detail'),

]