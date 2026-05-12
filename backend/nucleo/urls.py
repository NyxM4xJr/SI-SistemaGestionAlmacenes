"""
Configuración de rutas (URLs) principal del proyecto.

Este módulo define la estructura de URLs de nivel superior.
Todas las rutas de la API están bajo el prefijo /api/.

Rutas:
- /admin/  -> Panel de administración de Django (no usado actualmente)
- /api/    -> Todas las rutas de la API (incluye auth y futuras apps)

Fecha: 05/05/26
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Panel de administración de Django (para desarrollo)
    path('admin/', admin.site.urls),

    # API REST: Todas las rutas de la aplicación
    path('api/', include('usuarios.urls')),
    path('api/', include('inventario.urls')),
]