from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import models
from datetime import datetime, timedelta
import time
import logging

from .models import (
    MLModel, Prediction, SalesForecast, ProductRecommendation,
    CustomerSegment, InventoryAlert, MLTrainingLog
)
from .serializers import (
    MLModelSerializer, PredictionSerializer, SalesForecastSerializer,
    ProductRecommendationSerializer, CustomerSegmentSerializer,
    InventoryAlertSerializer, MLTrainingLogSerializer
)
from .services import (
    SalesForecastService,
    ProductRecommendationService,
    CustomerSegmentationService,
    InventoryOptimizationService
)
from authentication.permissions import IsSuperuserOrAdmin

logger = logging.getLogger(__name__)


class MLModelViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para modelos ML entrenados
    Solo lectura - los modelos se crean mediante entrenamiento
    """
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer
    permission_classes = [IsAuthenticated, IsSuperuserOrAdmin]
    
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
    permission_classes = [IsAuthenticated, IsSuperuserOrAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        days = int(self.request.query_params.get('days', 30))
        start_date = timezone.now() - timedelta(days=days)
        return queryset.filter(created_at__gte=start_date).order_by('-created_at')


class InventoryAlertViewSet(viewsets.ModelViewSet):
    """
    ViewSet para alertas de inventario
    """
    queryset = InventoryAlert.objects.all()
    serializer_class = InventoryAlertSerializer
    permission_classes = [IsAuthenticated, IsSuperuserOrAdmin]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        resolved = self.request.query_params.get('resolved', None)
        if resolved is not None:
            queryset = queryset.filter(resolved=(resolved.lower() == 'true'))
        return queryset.order_by('-urgency_level', '-created_at')
    
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """
        Marca una alerta como resuelta
        """
        alert = self.get_object()
        alert.resolved = True
        alert.resolved_at = timezone.now()
        alert.save()
        return Response({'status': 'alert resolved'})


class MLTrainingLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para logs de entrenamiento
    """
    queryset = MLTrainingLog.objects.all()
    serializer_class = MLTrainingLogSerializer
    permission_classes = [IsAuthenticated, IsSuperuserOrAdmin]
    
    def get_queryset(self):
        return super().get_queryset().order_by('-started_at')


# ==================== API ENDPOINTS ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
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
                name=f"Sales Forecast {model_type}",
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
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
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
        
        if days_ahead < 1 or days_ahead > 365:
            return Response({
                'error': 'days_ahead debe estar entre 1 y 365'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        start_time = time.time()
        
        service = SalesForecastService()
        result = service.predict_future_sales(days_ahead=days_ahead)
        
        execution_time = int((time.time() - start_time) * 1000)  # ms
        
        if result['success']:
            # Guardar predicción
            ml_model = MLModel.objects.filter(
                model_type='sales_forecast',
                is_active=True
            ).order_by('-trained_at').first()
            
            if ml_model:
                prediction = Prediction.objects.create(
                    model=ml_model,
                    input_data={'days_ahead': days_ahead},
                    prediction_result=result,
                    requested_by=request.user,
                    execution_time_ms=execution_time
                )
                
                # Actualizar último uso del modelo
                ml_model.last_used_at = timezone.now()
                ml_model.save()
                
                # Guardar pronósticos individuales
                for pred_data in result['predictions']:
                    SalesForecast.objects.create(
                        prediction=prediction,
                        forecast_date=pred_data['date'],
                        predicted_sales=pred_data['predicted_sales'],
                        predicted_quantity=pred_data['predicted_quantity'],
                        confidence_interval_lower=pred_data['confidence_lower'],
                        confidence_interval_upper=pred_data['confidence_upper']
                    )
            
            return Response({
                'success': True,
                'predictions': result['predictions'],
                'summary': result['summary'],
                'execution_time_ms': execution_time
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error', 'Error en predicción')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error prediciendo ventas: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def train_product_recommendation_model(request):
    """
    Entrena el modelo de recomendación de productos
    POST /api/ml/train-product-recommendation/
    """
    try:
        training_log = MLTrainingLog.objects.create(
            model_type='product_recommendation',
            status='training',
            started_by=request.user
        )
        
        start_time = time.time()
        
        service = ProductRecommendationService()
        result = service.train_model()
        
        duration = int(time.time() - start_time)
        
        if result['success']:
            ml_model = MLModel.objects.create(
                name="Product Recommendation System",
                model_type='product_recommendation',
                version=datetime.now().strftime('%Y%m%d_%H%M%S'),
                file_path=service.model_path,
                metrics=result['metrics'],
                training_data_size=result['metrics']['total_products'],
                trained_by=request.user
            )
            
            training_log.status = 'completed'
            training_log.training_duration_seconds = duration
            training_log.metrics = result['metrics']
            training_log.completed_at = timezone.now()
            training_log.model_saved = ml_model
            training_log.save()
            
            return Response({
                'success': True,
                'message': 'Modelo de recomendaciones entrenado exitosamente',
                'model_id': str(ml_model.id),
                'metrics': result['metrics'],
                'duration_seconds': duration
            }, status=status.HTTP_201_CREATED)
        else:
            training_log.status = 'failed'
            training_log.error_message = result.get('error')
            training_log.training_duration_seconds = duration
            training_log.completed_at = timezone.now()
            training_log.save()
            
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error entrenando modelo de recomendaciones: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def get_product_recommendations(request, product_id):
    """
    Obtiene recomendaciones para un producto
    GET /api/ml/product-recommendations/<product_id>/?top_n=10
    """
    try:
        top_n = int(request.query_params.get('top_n', 10))
        
        service = ProductRecommendationService()
        result = service.get_recommendations(product_id, top_n=top_n)
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error obteniendo recomendaciones: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def train_customer_segmentation_model(request):
    """
    Entrena el modelo de segmentación de clientes
    POST /api/ml/train-customer-segmentation/
    Body: {
        "n_clusters": 6 (opcional, default: 6)
    }
    """
    try:
        training_log = MLTrainingLog.objects.create(
            model_type='customer_segmentation',
            status='training',
            started_by=request.user
        )
        
        start_time = time.time()
        
        n_clusters = int(request.data.get('n_clusters', 6))
        
        service = CustomerSegmentationService()
        result = service.train_model(n_clusters=n_clusters)
        
        duration = int(time.time() - start_time)
        
        if result['success']:
            ml_model = MLModel.objects.create(
                name=f"Customer Segmentation ({n_clusters} clusters)",
                model_type='customer_segmentation',
                version=datetime.now().strftime('%Y%m%d_%H%M%S'),
                file_path=service.model_path,
                metrics=result['metrics'],
                parameters={'n_clusters': n_clusters},
                training_data_size=result['metrics']['n_customers'],
                trained_by=request.user
            )
            
            training_log.status = 'completed'
            training_log.training_duration_seconds = duration
            training_log.metrics = result['metrics']
            training_log.records_processed = result['metrics']['n_customers']
            training_log.completed_at = timezone.now()
            training_log.model_saved = ml_model
            training_log.save()
            
            return Response({
                'success': True,
                'message': 'Modelo de segmentación entrenado exitosamente',
                'model_id': str(ml_model.id),
                'metrics': result['metrics'],
                'duration_seconds': duration
            }, status=status.HTTP_201_CREATED)
        else:
            training_log.status = 'failed'
            training_log.error_message = result.get('error')
            training_log.training_duration_seconds = duration
            training_log.completed_at = timezone.now()
            training_log.save()
            
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error entrenando modelo de segmentación: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def get_customer_segment(request, customer_id):
    """
    Obtiene el segmento de un cliente
    GET /api/ml/customer-segment/<customer_id>/
    """
    try:
        service = CustomerSegmentationService()
        result = service.predict_customer_segment(customer_id)
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error obteniendo segmento de cliente: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def analyze_inventory(request):
    """
    Analiza el inventario completo
    GET /api/ml/inventory-analysis/
    """
    try:
        service = InventoryOptimizationService()
        result = service.analyze_inventory()
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error analizando inventario: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def get_reorder_recommendations(request):
    """
    Obtiene recomendaciones de reorden
    GET /api/ml/reorder-recommendations/
    """
    try:
        service = InventoryOptimizationService()
        result = service.get_reorder_recommendations()
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error obteniendo recomendaciones de reorden: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def get_inventory_health(request):
    """
    Obtiene el score de salud del inventario
    GET /api/ml/inventory-health/
    """
    try:
        service = InventoryOptimizationService()
        result = service.get_inventory_health_score()
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response({
                'success': False,
                'error': result.get('error')
            }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error obteniendo health score: {str(e)}")
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSuperuserOrAdmin])
def ml_dashboard_summary(request):
    """
    Resumen general de ML para el dashboard
    GET /api/ml/dashboard-summary/
    """
    try:
        # Obtener predicción de ventas reciente
        try:
            sales_forecast_service = SalesForecastService()
            sales_prediction = sales_forecast_service.predict(days_ahead=30)
            
            # Calcular totales
            next_7_days = sum([p['predicted_sales'] for p in sales_prediction['predictions'][:7]])
            next_30_days = sum([p['predicted_sales'] for p in sales_prediction['predictions']])
            trend = "alcista" if next_30_days > next_7_days * 4 else "estable"
            
            sales_forecast_summary = {
                'next_7_days': round(next_7_days, 2),
                'next_30_days': round(next_30_days, 2),
                'trend': trend
            }
        except Exception as e:
            logger.warning(f"No se pudo obtener predicción de ventas: {str(e)}")
            sales_forecast_summary = {
                'next_7_days': 0,
                'next_30_days': 0,
                'trend': 'N/A'
            }
        
        # Obtener análisis de inventario
        try:
            inventory_service = InventoryOptimizationService()
            inventory_analysis = inventory_service.analyze_inventory()
            
            inventory_summary = {
                'total_alerts': inventory_analysis.get('total_alerts', 0),
                'critical_alerts': len([a for a in inventory_analysis.get('alerts', []) if a.get('urgency_level', 0) >= 8]),
                'health_score': inventory_analysis.get('health_score', 0)
            }
        except Exception as e:
            logger.warning(f"No se pudo obtener análisis de inventario: {str(e)}")
            inventory_summary = {
                'total_alerts': 0,
                'critical_alerts': 0,
                'health_score': 0
            }
        
        # Obtener información de clientes
        try:
            segmentation_service = CustomerSegmentationService()
            total_segments = CustomerSegment.objects.values('segment_type').distinct().count()
            vip_customers = CustomerSegment.objects.filter(segment_type='VIP').count()
            at_risk_customers = CustomerSegment.objects.filter(segment_type='At Risk').count()
            
            customers_summary = {
                'total_segments': total_segments,
                'vip_customers': vip_customers,
                'at_risk_customers': at_risk_customers
            }
        except Exception as e:
            logger.warning(f"No se pudo obtener información de clientes: {str(e)}")
            customers_summary = {
                'total_segments': 0,
                'vip_customers': 0,
                'at_risk_customers': 0
            }
        
        # Obtener información de recomendaciones
        try:
            total_products = ProductRecommendation.objects.values('source_product_id').distinct().count()
            avg_similarity = ProductRecommendation.objects.aggregate(
                avg_sim=models.Avg('similarity_score')
            )['avg_sim'] or 0
            
            recommendations_summary = {
                'total_products': total_products,
                'avg_similarity': round(avg_similarity, 2)
            }
        except Exception as e:
            logger.warning(f"No se pudo obtener información de recomendaciones: {str(e)}")
            recommendations_summary = {
                'total_products': 0,
                'avg_similarity': 0
            }
        
        return Response({
            'sales_forecast': sales_forecast_summary,
            'inventory': inventory_summary,
            'customers': customers_summary,
            'recommendations': recommendations_summary
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error obteniendo resumen del dashboard: {str(e)}")
        return Response({
            'sales_forecast': {'next_7_days': 0, 'next_30_days': 0, 'trend': 'N/A'},
            'inventory': {'total_alerts': 0, 'critical_alerts': 0, 'health_score': 0},
            'customers': {'total_segments': 0, 'vip_customers': 0, 'at_risk_customers': 0},
            'recommendations': {'total_products': 0, 'avg_similarity': 0}
        }, status=status.HTTP_200_OK)

