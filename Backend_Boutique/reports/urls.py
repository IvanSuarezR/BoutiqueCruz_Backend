from django.urls import path
from . import views
# from . import simple_views

app_name = 'reports'

urlpatterns = [
    # Reportes con IA (dinámicos)
    # Generar reporte completo (con exportación)
    path('generate/', views.generate_report, name='generate_report'),
    
    # Vista previa (solo JSON, sin exportar)
    path('preview/', views.preview_report, name='preview_report'),
    
    # Historial de reportes
    path('history/', views.report_history, name='report_history'),
    
    # Sugerencias de reportes
    path('suggestions/', views.report_suggestions, name='report_suggestions'),
    
    # Reportes Manuales (con filtros tradicionales)
    path('manual/preview/', views.manual_report_preview, name='manual_report_preview'),
    path('manual/generate/', views.manual_report_generate, name='manual_report_generate'),
]
