from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'ml_predictions'

router = DefaultRouter()
router.register(r'models', views.MLModelViewSet, basename='mlmodel')
router.register(r'predictions', views.PredictionViewSet, basename='prediction')
router.register(r'inventory-alerts', views.InventoryAlertViewSet, basename='inventory-alert')
router.register(r'training-logs', views.MLTrainingLogViewSet, basename='training-log')

urlpatterns = [
    # Router URLs
    path('', include(router.urls)),
    
    # Sales Forecast
    path('train-sales-forecast/', views.train_sales_forecast_model, name='train-sales-forecast'),
    path('predict-sales/', views.predict_sales, name='predict-sales'),
    
    # Product Recommendations
    path('train-product-recommendation/', views.train_product_recommendation_model, name='train-product-recommendation'),
    path('product-recommendations/<uuid:product_id>/', views.get_product_recommendations, name='product-recommendations'),
    
    # Customer Segmentation
    path('train-customer-segmentation/', views.train_customer_segmentation_model, name='train-customer-segmentation'),
    path('customer-segment/<uuid:customer_id>/', views.get_customer_segment, name='customer-segment'),
    
    # Inventory Optimization
    path('inventory-analysis/', views.analyze_inventory, name='inventory-analysis'),
    path('reorder-recommendations/', views.get_reorder_recommendations, name='reorder-recommendations'),
    path('inventory-health/', views.get_inventory_health, name='inventory-health'),
    
    # Dashboard
    path('dashboard-summary/', views.ml_dashboard_summary, name='dashboard-summary'),
]
