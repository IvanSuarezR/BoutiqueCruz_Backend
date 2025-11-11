from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'ml_predictions'

router = DefaultRouter()
router.register(r'models', views.MLModelViewSet, basename='mlmodel')
router.register(r'predictions', views.PredictionViewSet, basename='prediction')
router.register(r'training-logs', views.MLTrainingLogViewSet, basename='training-log')

urlpatterns = [
    # Router URLs
    path('', include(router.urls)),
    
    # Sales Forecast
    path('train-sales-forecast/', views.train_sales_forecast_model, name='train-sales-forecast'),
    path('predict-sales/', views.predict_sales, name='predict-sales'),
    path('sales-analytics/', views.sales_analytics, name='sales-analytics'),
    
    # Sales Insights
    path('insights/top-products/', views.get_top_products, name='top-products'),
    path('insights/category-performance/', views.get_category_performance, name='category-performance'),
    path('insights/sales-by-day/', views.get_sales_by_day_of_week, name='sales-by-day'),
    path('insights/monthly-trends/', views.get_monthly_trends, name='monthly-trends'),
    path('insights/customers/', views.get_customer_insights, name='customer-insights'),
    path('insights/low-stock/', views.get_low_stock_alerts, name='low-stock'),
    path('insights/payment-methods/', views.get_payment_methods_stats, name='payment-methods'),
    path('insights/comprehensive/', views.get_comprehensive_insights, name='comprehensive-insights'),
    
    # Dashboard
    path('dashboard-summary/', views.ml_dashboard_summary, name='dashboard-summary'),
]
