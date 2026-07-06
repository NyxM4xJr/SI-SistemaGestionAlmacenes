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
from .receta_views import (   # CU21
    RecetaListView,
    RecetaDetailView,
    RecetaCatalogosView,
)
from .menu_views import MenuListView, MenuDetailView, DetalleMenuView # CU23

from .movimiento_views import MovimientoListView, MovimientoDetailView #CU14
from .alerta_views import AlertaListView, AlertaConteoView, AlertaDetailView # CU13
from .reporte_views import ReporteComparativaPreciosView, ReporteComparativaPDFView, ReporteComparativaExcelView

from .cierre_turno_views import CierreTurnoView, ValidarCierreTurnoView  # CU15
from .reporte_costos_views import (  # CU27
    ReporteCostosView,
    ReporteCostosPDFView,
    ReporteCostosExcelView,
)
from .reporte_rotacion_views import (  # CU26
    ReporteRotacionView,
    ReporteRotacionPDFView,
    ReporteRotacionExcelView,
)
from .sugerencia_menu_views import SugerirMenuView  # CU24
from .reporte_valor_perdido_views import (   # CU25
    ReporteValorPerdidoView,
    ReporteValorPerdidoPDFView,
    ReporteValorPerdidoExcelView,
)
from .dashboard_kpis_views import DashboardKPIsView  # CU29
from .descargo_views import DescargoAutomaticoView, ConfirmarDescargoView  # CU16
from .comando_voz_views import LogComandoVozView  # CU32
from .pago_views import (  # CU31
    CrearSesionPagoView,
    StripeWebhookView,
    HistorialPagosView,
    SaldoPagosView,
    CrearOrdenPayPalView,   # CU36 (Ciclo 5)
    CapturarPayPalView,     # CU36 (Ciclo 5)
    PayPalWebhookView,      # CU36 (Ciclo 5)
    EstadoOrdenPayPalView,  # CU36 (Ciclo 5) - diagnóstico de solo lectura
    AprobarPagoManualView,  # CU36 (Ciclo 5) - aprobación manual fallback
    RechazarPagoManualView, # CU36 (Ciclo 5)
)
from .notificacion_views import RevisarNotificarView  # CU33 (Ciclo 5)
from .briefing_ia_views import BriefingIAView  # CU40 (Ciclo 5)
from .receta_ia_views import SugerirRecetaIAView  # CU41 (Ciclo 5)

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
    # ---- CU9 HISTORIAL DE PRECIOS ----
    path('insumos/<int:insumo_id>/historial-precios/', InsumoHistorialPreciosView.as_view(), name='insumo-historial-precios'),
    
    # ---- CU10 ESTACIONALIDAD DE INSUMOS ----
    path('insumos/<int:insumo_id>/estacionalidad/', EstacionalidadView.as_view(), name='insumo-estacionalidad'),
    
    # ----CU17 GESTIONAR PROVEEDORES ----
        # Estas rutas ya están definidas en inventario/urls.py, pero se incluyen aquí para referencia y organización, aunque realmente se manejan en el módulo de inventario.

    # ---- CU18 ASOCIAR INSUMOS A PROVEEDORES ----
        # Estas rutas ya están definidas en inventario/urls.py, pero se incluyen aquí para referencia y organización, aunque realmente se manejan en el módulo de inventario.

    # ---- CU20 GESTIONAR PLATOS DEL MENÚ ----
    path('platos/', PlatoListView.as_view(), name='plato-list'),           # GET: listar | POST: crear
    path('platos/<int:plato_id>/', PlatoDetailView.as_view(), name='plato-detail'),  # GET / PATCH / DELETE

    # ---- CU21 GESTIONAR RECETAS ----
    # IMPORTANTE: catalogos/ va ANTES de <int:receta_id>/ para evitar conflicto de rutas
    path('recetas/catalogos/', RecetaCatalogosView.as_view(), name='receta-catalogos'),
    path('recetas/', RecetaListView.as_view(), name='receta-list'),
    path('recetas/<int:receta_id>/', RecetaDetailView.as_view(), name='receta-detail'),

    # ---- CU22 GESTIONAR DETALLES DE RECETA ----
       #Es parte del CU7 y CU8, por lo que esta incluido en el código de esos CU, especificamente
       # en el archivo insumo_views.py, en la clase FichaTecnicaView, donde se manejan los detalles 
       # de receta relacionados a cada insumo.

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

    # ============================================
    #             ---- CICLO #4 ----
    # ============================================
    # ---- CU15 VALIDAR CIERRE DE TURNO ----
    # IMPORTANTE: validar/ va ANTES si en el futuro se agrega <int:id>/ a este recurso
    path('cierre-turno/', CierreTurnoView.as_view(), name='cierre-turno'),
    path('cierre-turno/validar/', ValidarCierreTurnoView.as_view(), name='cierre-turno-validar'),

    # ---- CU27 GENERAR REPORTE DE COSTOS POR PLATO ----
    path('reportes/costos-plato/', ReporteCostosView.as_view(), name='reporte-costos'),
    path('reportes/costos-plato/pdf/', ReporteCostosPDFView.as_view(), name='reporte-costos-pdf'),
    path('reportes/costos-plato/excel/', ReporteCostosExcelView.as_view(), name='reporte-costos-excel'),

    # ---- CU24 CONSULTAR SUGERENCIA DE MENÚ POR TEMPORADA ----
    # NOTA: "Agregar a Menú" reutiliza el endpoint YA EXISTENTE de CU23
    # (POST /api/menus/<id>/platos/, ver DetalleMenuView arriba), no se
    # crea un endpoint de escritura propio para esto.
    path('sugerir-menu/', SugerirMenuView.as_view(), name='sugerir-menu'),

    # ---- CU40 BRIEFING EJECUTIVO PROACTIVO CON IA ----
    path('briefing-ia/', BriefingIAView.as_view(), name='briefing-ia'),

    # ---- CU41 GENERACIÓN DE RECETAS CON IA ----
    path('recetas-ia/generar/', SugerirRecetaIAView.as_view(), name='recetas-ia-generar'),

    # ---- CU25 GENERAR REPORTE DE VALOR PERDIDO ----
    path('reportes/valor-perdido/', ReporteValorPerdidoView.as_view(), name='reporte-valor-perdido'),
    path('reportes/valor-perdido/pdf/', ReporteValorPerdidoPDFView.as_view(), name='reporte-valor-perdido-pdf'),
    path('reportes/valor-perdido/excel/', ReporteValorPerdidoExcelView.as_view(), name='reporte-valor-perdido-excel'),
    
    # ---- CU26 GENERAR REPORTE DE ROTACION DE INVENTARIO ----
    path('reportes/rotacion/', ReporteRotacionView.as_view(), name='reporte-rotacion'),
    path('reportes/rotacion/pdf/', ReporteRotacionPDFView.as_view(), name='reporte-rotacion-pdf'),
    path('reportes/rotacion/excel/', ReporteRotacionExcelView.as_view(), name='reporte-rotacion-excel'),

    # ---- CU29 VISUALIZAR DASHBOARD DE KPIs ----
    # Reutiliza _calcular_reporte_valor_perdido (CU25), _calcular_reporte_costos
    # (CU27) y _calcular_reporte_rotacion (CU26). No registra bitacora (solo lectura).
    path('dashboard/kpis/', DashboardKPIsView.as_view(), name='dashboard-kpis'),

    # ---- CU16 GENERAR PROPUESTA DE DESCARGO AUTOMATICO ----
    # IMPORTANTE: confirmar/ va ANTES si en el futuro se agrega <int:id>/ a este recurso
    path('descargo/', DescargoAutomaticoView.as_view(), name='descargo'),
    path('descargo/confirmar/', ConfirmarDescargoView.as_view(), name='descargo-confirmar'),

    # ---- CU32 REPORTES POR VOZ CON IA ----
    # Único endpoint de este CU: registro de bitácora genérico.
    # La captura de voz y la interpretación de comandos ocurren
    # enteramente en el frontend (useComandoVoz.ts, en AppHeader).
    path('bitacora/log-accion-voz/', LogComandoVozView.as_view(), name='log-comando-voz'),

    # ---- CU31 PASARELA DE PAGOS (STRIPE) ----
    path('pagos/crear-sesion/', CrearSesionPagoView.as_view(), name='pago-crear-sesion'),
    path('pagos/webhook/', StripeWebhookView.as_view(), name='pago-webhook'),
    path('pagos/historial/', HistorialPagosView.as_view(), name='pago-historial'),
    path('pagos/saldo/', SaldoPagosView.as_view(), name='pago-saldo'),

    # ---- CU36 PASARELA DE PAGOS (PAYPAL) — Ciclo 5 ----
    path('pagos/paypal/crear-orden/', CrearOrdenPayPalView.as_view(), name='paypal-crear-orden'),
    path('pagos/paypal/capturar/', CapturarPayPalView.as_view(), name='paypal-capturar'),
    path('pagos/paypal/webhook/', PayPalWebhookView.as_view(), name='paypal-webhook'),
    path('pagos/paypal/estado/<str:order_id>/', EstadoOrdenPayPalView.as_view(), name='paypal-estado'),
    path('pagos/<int:pago_id>/aprobar/', AprobarPagoManualView.as_view(), name='pago-aprobar-manual'),
    path('pagos/<int:pago_id>/rechazar/', RechazarPagoManualView.as_view(), name='pago-rechazar-manual'),

    # ============================================
    #             ---- CICLO #5 ----
    # ============================================
    # ---- CU33 NOTIFICACIONES DE ALERTAS POR EMAIL ----
    path('notificaciones/revisar/', RevisarNotificarView.as_view(), name='notificaciones-revisar'),

    # ==========================
    # PAQUETE 6: Reportes y Análisis
    # ==========================
    # CU28: Generar Reporte Comparativa de Precios
    path('reportes/comparativa-precios/', ReporteComparativaPreciosView.as_view(), name='reporte-comparativa'),
    path('reportes/comparativa-precios/pdf/', ReporteComparativaPDFView.as_view(), name='reporte-comparativa-pdf'),
    path('reportes/comparativa-precios/excel/', ReporteComparativaExcelView.as_view(), name='reporte-comparativa-excel'),
]