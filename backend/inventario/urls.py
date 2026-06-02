from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .proveedor_views import ProveedorListView, ProveedorDetailView, ProveedorInsumoView

router = DefaultRouter()
router.register(r'lotes', views.LoteViewSet, basename='lote')

urlpatterns = [
    path('', include(router.urls)),
    path('proveedores/', ProveedorListView.as_view(), name='proveedor-list'),
    path('proveedores/<int:proveedor_id>/', ProveedorDetailView.as_view(), name='proveedor-detail'),
    path('proveedores/<int:proveedor_id>/insumos/', ProveedorInsumoView.as_view(), name='proveedor-insumo'),
    path('proveedores/<int:proveedor_id>/insumos/<int:insumo_id>/', ProveedorInsumoView.as_view(), name='proveedor-insumo-delete'),
]