"""
URL configuration for boutique_Main project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

# Solo superusuarios (desarrolladores) pueden acceder al admin de Django
def _superuser_only(request):
    user = getattr(request, 'user', None)
    return bool(user and user.is_active and user.is_superuser)

admin.site.has_permission = _superuser_only

urlpatterns = [
    path('admin/', admin.site.urls),
    # API endpoints
    path('api/auth/', include('accounts.urls')),
    path('api/inventory/', include('inventory.urls')),
    path('api/', include('orders.urls')),
    path('api/sales/', include('sales.urls')),
    path('api/ml/', include('ml_predictions.urls')),
    path('api/assistant/', include('assistant.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
