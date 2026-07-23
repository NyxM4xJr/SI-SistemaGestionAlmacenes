from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .proveedor_views import ProveedorListView, ProveedorDetailView, ProveedorInsumoView
from .mapa_views import ProveedorMapaView
from .caducidad_views import CaducidadListView  # CU34 (Ciclo 5)
from .orden_compra_views import (  # CU36 (Ciclo 5)
    OrdenCompraListView,
    OrdenCompraDetailView,
    GenerarOrdenesAutomaticasView,
)
from .factura_views import (  # CU39 / CU40 (Ciclo 6, visión IA)
    FacturaOCRView,
    FacturaListView,
    FacturaDetailView,
    ConciliarFacturaView,
)
from .recepcion_views import RecepcionRemitoView  # CU42 (Ciclo 6, visión IA)
from .contrapropuesta_views import EnviarContrapropuestaView  # Optimizador de Recetas (contrapropuesta a proveedor)
# CU41 vive en la app usuarios (paquete Seguridad) pero su ruta cuelga de
# /api/facturas/ para mantener el módulo de facturas junto.
from usuarios.factura_anomalias_views import DetectarFacturasAnomalasView

router = DefaultRouter()
router.register(r'lotes', views.LoteViewSet, basename='lote')

urlpatterns = [
    # CU42: debe ir ANTES del router de 'lotes', si no el router captura
    # "recepcion-remito" como si fuera el id de un lote.
    path('lotes/recepcion-remito/', RecepcionRemitoView.as_view(), name='recepcion-remito'),

    path('', include(router.urls)),

    # ============================================
    #             ---- CICLO #5 ----
    # ============================================
    #--- CU34 GESTIÓN DE CADUCIDAD (FEFO) ---
    path('caducidad/', CaducidadListView.as_view(), name='caducidad-list'),

    #--- CU36 ÓRDENES DE COMPRA AUTOMÁTICAS ---
    # IMPORTANTE: generar/ va ANTES de <int:orden_id>/ para evitar conflicto
    path('ordenes-compra/', OrdenCompraListView.as_view(), name='orden-compra-list'),
    path('ordenes-compra/generar/', GenerarOrdenesAutomaticasView.as_view(), name='orden-compra-generar'),
    path('ordenes-compra/<int:orden_id>/', OrdenCompraDetailView.as_view(), name='orden-compra-detail'),

    # ============================================
    #             ---- CICLO #6 (visión IA) ----
    # ============================================
    #--- CU39 OCR DE FACTURAS + CU40 CONCILIACIÓN ---
    # IMPORTANTE: ocr/ va ANTES de <int:factura_id>/ para evitar conflicto
    path('facturas/ocr/', FacturaOCRView.as_view(), name='factura-ocr'),
    path('facturas/anomalias/', DetectarFacturasAnomalasView.as_view(), name='factura-anomalias'),
    path('facturas/', FacturaListView.as_view(), name='factura-list'),
    path('facturas/<int:factura_id>/', FacturaDetailView.as_view(), name='factura-detail'),
    path('facturas/<int:factura_id>/conciliar/', ConciliarFacturaView.as_view(), name='factura-conciliar'),

    #--- CU17 GESTIONAR PROVEEDORES ---
    path('proveedores/', ProveedorListView.as_view(), name='proveedor-list'),

    #--- CU19 LOCALIZAR PROVEEDORES MEDIANTE MAPA ---
    # IMPORTANTE: mapa/ y contrapropuesta/ van ANTES de <int:proveedor_id>/ para evitar conflicto de rutas
    path('proveedores/mapa/', ProveedorMapaView.as_view(), name='proveedor-mapa'),
    path('proveedores/contrapropuesta/', EnviarContrapropuestaView.as_view(), name='proveedor-contrapropuesta'),

    path('proveedores/<int:proveedor_id>/', ProveedorDetailView.as_view(), name='proveedor-detail'),

    #--- CU18 ASOCIAR INSUMOS A PROVEEDORES ---
    path('proveedores/<int:proveedor_id>/insumos/', ProveedorInsumoView.as_view(), name='proveedor-insumo'),
    path('proveedores/<int:proveedor_id>/insumos/<int:insumo_id>/', ProveedorInsumoView.as_view(), name='proveedor-insumo-delete'),
]