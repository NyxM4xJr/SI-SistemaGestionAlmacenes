from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .proveedor_views import ProveedorListView, ProveedorDetailView, ProveedorInsumoView
from .mapa_views import ProveedorMapaView
from .caducidad_views import CaducidadListView  # CU34 (Ciclo 5)
from .orden_compra_views import (  # CU37 (Ciclo 5)
    OrdenCompraListView,
    OrdenCompraDetailView,
    GenerarOrdenesAutomaticasView,
)

router = DefaultRouter()
router.register(r'lotes', views.LoteViewSet, basename='lote')

urlpatterns = [
    path('', include(router.urls)),

    # ============================================
    #             ---- CICLO #5 ----
    # ============================================
    #--- CU34 GESTIÓN DE CADUCIDAD (FEFO) ---
    path('caducidad/', CaducidadListView.as_view(), name='caducidad-list'),

    #--- CU37 ÓRDENES DE COMPRA AUTOMÁTICAS ---
    # IMPORTANTE: generar/ va ANTES de <int:orden_id>/ para evitar conflicto
    path('ordenes-compra/', OrdenCompraListView.as_view(), name='orden-compra-list'),
    path('ordenes-compra/generar/', GenerarOrdenesAutomaticasView.as_view(), name='orden-compra-generar'),
    path('ordenes-compra/<int:orden_id>/', OrdenCompraDetailView.as_view(), name='orden-compra-detail'),

    #--- CU17 GESTIONAR PROVEEDORES ---
    path('proveedores/', ProveedorListView.as_view(), name='proveedor-list'),

    #--- CU19 LOCALIZAR PROVEEDORES MEDIANTE MAPA ---
    # IMPORTANTE: mapa/ va ANTES de <int:proveedor_id>/ para evitar conflicto de rutas
    path('proveedores/mapa/', ProveedorMapaView.as_view(), name='proveedor-mapa'),

    path('proveedores/<int:proveedor_id>/', ProveedorDetailView.as_view(), name='proveedor-detail'),

    #--- CU18 ASOCIAR INSUMOS A PROVEEDORES ---
    path('proveedores/<int:proveedor_id>/insumos/', ProveedorInsumoView.as_view(), name='proveedor-insumo'),
    path('proveedores/<int:proveedor_id>/insumos/<int:insumo_id>/', ProveedorInsumoView.as_view(), name='proveedor-insumo-delete'),
]