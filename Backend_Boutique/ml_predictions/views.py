from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import datetime, timedelta
import time
import logging

from .models import MLModel, Prediction, SalesForecast, MLTrainingLog
from .serializers import (
    MLModelSerializer, PredictionSerializer, SalesForecastSerializer,
    MLTrainingLogSerializer
)
from .services.sales_forecast import SalesForecastService
from .services.sales_insights import SalesInsightsService
from accounts.permissions import RequirePermission

logger = logging.getLogger(__name__)


# Permission class para panel users (admin, owner, seller)
class IsPanelUser(IsAuthenticated):
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        if not base:
            return False
        ut = getattr(request.user, 'user_type', 'customer')
        return ut in ('admin','owner','seller') or getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)


class MLModelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para modelos ML entrenados (solo lectura)
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    permission_classes = [IsPanelUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        model_type = self.request.query_params.get('model_type', None)
        if model_type:
            queryset = queryset.filter(model_type=model_type)
        return queryset.order_by('-trained_at')


class PredictionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para historial de predicciones
    """
    queryset = Prediction.objects.all()
    serializer_class = PredictionSerializer
    permission_classes = [IsPanelUser]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        days = int(self.request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        return queryset.filter(created_at__gte=start_date).order_by('-created_at')


class MLTrainingLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para logs de entrenamiento
    """
    queryset = MLTrainingLog.objects.all()
    serializer_class = MLTrainingLogSerializer
    permission_classes = [IsPanelUser]
    
    def get_queryset(self):
        return super().get_queryset().order_by('-started_at')[:50]


# ==================== API ENDPOINTS ====================

@api_view(['POST'])
@permission_classes([IsPanelUser])
def train_sales_forecast_model(request):
    """
    Entrena el modelo de predicción de ventas
    POST /api/ml/train-sales-forecast/
    Body: {
        "model_type": "random_forest" (opcional: random_forest, gradient_boosting, linear)
    }
    """
    try:
        # Crear log de entrenamiento
        training_log = MLTrainingLog.objects.create(
            model_type='sales_forecast',
            status='training',
            started_by=request.user
        )
        
        start_time = time.time()
        
        # Entrenar modelo
        model_type = request.data.get('model_type', 'random_forest')
        service = SalesForecastService()
        result = service.train_model(model_type=model_type)
        
        duration = int(time.time() - start_time)
        
        if result['success']:
            # Guardar modelo en DB
            ml_model = MLModel.objects.create(
                name=f"Pronóstico de Ventas {model_type}",
                model_type='sales_forecast',
                version=datetime.now().strftime('%Y%m%d_%H%M%S'),
                file_path=service.model_path,
                accuracy_score=result['metrics'].get('test_r2', 0),
                metrics=result['metrics'],
                training_data_size=result['training_data_size'],
                trained_by=request.user
            )
            
            # Actualizar log
            training_log.status = 'completed'
            training_log.training_duration_seconds = duration
            training_log.metrics = result['metrics']
            training_log.records_processed = result['training_data_size']
            training_log.completed_at = timezone.now()
            training_log.model_saved = ml_model
            training_log.save()
            
            return Response({
                'success': True,
                'message': 'Modelo entrenado exitosamente',
                'model_id': str(ml_model.id),
                'metrics': result['metrics'],
                'duration_seconds': duration
            }, status=status.HTTP_201_CREATED)
        else:
            # Error en entrenamiento
            training_log.status = 'failed'
            training_log.error_message = result.get('error', 'Unknown error')
            training_log.training_duration_seconds = duration
            training_log.completed_at = timezone.now()
            training_log.save()
            
            return Response({
                'success': False,
                'error': result.get('error', 'Error desconocido')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error entrenando modelo: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsPanelUser])
def predict_sales(request):
    """
    Predice ventas futuras
    POST /api/ml/predict-sales/
    Body: {
        "days_ahead": 30 (opcional, default: 30)
    }
    """
    try:
        days_ahead = int(request.data.get('days_ahead', 30))
        print("---------------------------------------------------")

        print(f"Días a predecir: {days_ahead}")
        print("---------------------------------------------------")
        if days_ahead < 1 or days_ahead > 365:
            return Response({
                'error': 'days_ahead debe estar entre 1 y 365'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        start_time = time.time()
        
        # Generar predicciones
        service = SalesForecastService()
        result = service.predict_future_sales(days_ahead=days_ahead)
        print("---------------------------------------------------")
        print(f"Resultado de la predicción: {result}")
        print("---------------------------------------------------")        
        if not result['success']:
            return Response({
                'success': False,
                'error': result.get('error', 'Error generando predicciones')
            }, status=status.HTTP_400_BAD_REQUEST)
        
        execution_time = int((time.time() - start_time) * 1000)
        
        # Buscar el modelo activo más reciente
        ml_model = MLModel.objects.filter(model_type='sales_forecast', is_active=True).order_by('-trained_at').first()
        
        if ml_model:
            # Guardar predicción en DB
            prediction = Prediction.objects.create(
                model=ml_model,
                input_data={'days_ahead': days_ahead},
                prediction_result=result,
                requested_by=request.user,
                execution_time_ms=execution_time
            )
            
            # Guardar pronósticos individuales
            for pred in result['predictions']:
                SalesForecast.objects.create(
                    prediction=prediction,
                    forecast_date=pred['date'],
                    predicted_sales=pred['predicted_sales'],
                    predicted_quantity=pred['predicted_quantity']
                )
            
            # Actualizar last_used_at del modelo
            ml_model.last_used_at = timezone.now()
            ml_model.save()
        
        return Response({
            'success': True,
            'predictions': result['predictions'],
            'summary': result['summary'],
            'execution_time_ms': execution_time
        })
        
    except Exception as e:
        logger.error(f"Error prediciendo ventas: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def sales_analytics(request):
    """
    Obtiene analytics de ventas históricas
    GET /api/ml/sales-analytics/
    """
    try:
        service = SalesForecastService()
        result = service.get_sales_analytics()
        
        if result['success']:
            return Response(result)
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Error obteniendo analytics')
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        logger.error(f"Error obteniendo analytics: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def ml_dashboard_summary(request):
    """
    Resumen para el dashboard de ML
    GET /api/ml/dashboard-summary/
    """
    try:
        # Obtener modelo activo más reciente
        active_model = MLModel.objects.filter(
            model_type='sales_forecast',
            is_active=True
        ).order_by('-trained_at').first()
        
        # Contar predicciones recientes
        thirty_days_ago = timezone.now() - timedelta(days=30)
        recent_predictions = Prediction.objects.filter(
            created_at__gte=thirty_days_ago
        ).count()
        
        # Últimos logs de entrenamiento
        recent_trainings = MLTrainingLog.objects.filter(
            model_type='sales_forecast'
        ).order_by('-started_at')[:5]
        
        # Analytics de ventas
        service = SalesForecastService()
        analytics = service.get_sales_analytics()
        
        return Response({
            'success': True,
            'active_model': MLModelSerializer(active_model).data if active_model else None,
            'recent_predictions_count': recent_predictions,
            'recent_trainings': MLTrainingLogSerializer(recent_trainings, many=True).data,
            'sales_analytics': analytics if analytics['success'] else None
        })
        
    except Exception as e:
        logger.error(f"Error obteniendo resumen de dashboard: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==================== SALES INSIGHTS ENDPOINTS ====================

@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_top_products(request):
    """
    Productos más vendidos
    GET /api/ml/insights/top-products/?days=30&limit=10
    """
    try:
        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 10))
        
        service = SalesInsightsService()
        result = service.get_top_selling_products(days=days, limit=limit)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo top productos: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_category_performance(request):
    """
    Rendimiento por categoría
    GET /api/ml/insights/category-performance/?days=30
    """
    try:
        days = int(request.query_params.get('days', 30))
        
        service = SalesInsightsService()
        result = service.get_category_performance(days=days)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo rendimiento de categorías: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_sales_by_day_of_week(request):
    """
    Ventas por día de la semana
    GET /api/ml/insights/sales-by-day/?days=90
    """
    try:
        days = int(request.query_params.get('days', 90))
        
        service = SalesInsightsService()
        result = service.get_sales_by_day_of_week(days=days)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo ventas por día: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_monthly_trends(request):
    """
    Tendencias mensuales
    GET /api/ml/insights/monthly-trends/?months=6
    """
    try:
        months = int(request.query_params.get('months', 6))
        
        service = SalesInsightsService()
        result = service.get_monthly_trends(months=months)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo tendencias mensuales: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_customer_insights(request):
    """
    Insights de clientes
    GET /api/ml/insights/customers/?days=90
    """
    try:
        days = int(request.query_params.get('days', 90))
        
        service = SalesInsightsService()
        result = service.get_customer_insights(days=days)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo insights de clientes: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_low_stock_alerts(request):
    """
    Alertas de stock bajo
    GET /api/ml/insights/low-stock/?threshold=10
    """
    try:
        threshold = int(request.query_params.get('threshold', 10))
        
        service = SalesInsightsService()
        result = service.get_low_stock_alerts(threshold=threshold)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo alertas de stock: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_payment_methods_stats(request):
    """
    Estadísticas por método de pago
    GET /api/ml/insights/payment-methods/?days=30
    """
    try:
        days = int(request.query_params.get('days', 30))
        
        service = SalesInsightsService()
        result = service.get_revenue_by_payment_method(days=days)
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo stats de métodos de pago: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsPanelUser])
def get_comprehensive_insights(request):
    """
    Dashboard completo con todos los insights
    GET /api/ml/insights/comprehensive/
    """
    try:
        service = SalesInsightsService()
        result = service.get_comprehensive_dashboard()
        
        return Response(result)
    except Exception as e:
        logger.error(f"Error obteniendo dashboard completo: {str(e)}")
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

