from django.db import models
from django.contrib.auth import get_user_model
import uuid
import json

User = get_user_model()


class MLModel(models.Model):
    """
    Registro de modelos de Machine Learning entrenados
    """
    MODEL_TYPES = [
        ('sales_forecast', 'Predicción de Ventas'),
        ('product_recommendation', 'Recomendación de Productos'),
        ('customer_segmentation', 'Segmentación de Clientes'),
        ('inventory_optimization', 'Optimización de Inventario'),
        ('price_optimization', 'Optimización de Precios'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)
    version = models.CharField(max_length=50)
    file_path = models.CharField(max_length=500)  # Ruta al archivo .pkl del modelo
    accuracy_score = models.FloatField(null=True, blank=True)
    metrics = models.JSONField(default=dict, blank=True)  # Métricas del modelo (R2, RMSE, etc.)
    parameters = models.JSONField(default=dict, blank=True)  # Parámetros del modelo
    training_data_size = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    trained_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    trained_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-trained_at']
        verbose_name = 'ML Model'
        verbose_name_plural = 'ML Models'
    
    def __str__(self):
        return f"{self.name} v{self.version}"


class Prediction(models.Model):
    """
    Registro de predicciones realizadas
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='predictions')
    input_data = models.JSONField()  # Datos de entrada
    prediction_result = models.JSONField()  # Resultado de la predicción
    confidence_score = models.FloatField(null=True, blank=True)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    execution_time_ms = models.IntegerField(default=0)  # Tiempo de ejecución en milisegundos
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Prediction'
        verbose_name_plural = 'Predictions'
    
    def __str__(self):
        return f"Prediction {self.id} - {self.model.model_type}"


class SalesForecast(models.Model):
    """
    Pronósticos de ventas generados por ML
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='sales_forecasts')
    forecast_date = models.DateField()  # Fecha para la que se predice
    predicted_sales = models.DecimalField(max_digits=12, decimal_places=2)
    predicted_quantity = models.IntegerField()
    confidence_interval_lower = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    confidence_interval_upper = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)  # Categoría específica
    product_id = models.UUIDField(null=True, blank=True)  # Producto específico
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['forecast_date']
        verbose_name = 'Sales Forecast'
        verbose_name_plural = 'Sales Forecasts'
    
    def __str__(self):
        return f"Forecast for {self.forecast_date}: ${self.predicted_sales}"


class ProductRecommendation(models.Model):
    """
    Recomendaciones de productos basadas en ML
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='product_recommendations')
    source_product_id = models.UUIDField()  # Producto base
    recommended_product_id = models.UUIDField()  # Producto recomendado
    confidence_score = models.FloatField()  # 0-1
    reason = models.CharField(max_length=255, null=True, blank=True)  # frequently_bought_together, similar_items, etc.
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-confidence_score']
        verbose_name = 'Product Recommendation'
        verbose_name_plural = 'Product Recommendations'
    
    def __str__(self):
        return f"Recommendation: {self.source_product_id} -> {self.recommended_product_id}"


class CustomerSegment(models.Model):
    """
    Segmentación de clientes por ML
    """
    SEGMENT_TYPES = [
        ('vip', 'Cliente VIP'),
        ('frequent', 'Cliente Frecuente'),
        ('occasional', 'Cliente Ocasional'),
        ('at_risk', 'En Riesgo de Abandono'),
        ('new', 'Cliente Nuevo'),
        ('inactive', 'Cliente Inactivo'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='customer_segments')
    customer_id = models.UUIDField()
    segment_type = models.CharField(max_length=20, choices=SEGMENT_TYPES)
    confidence_score = models.FloatField()
    characteristics = models.JSONField(default=dict)  # Características del segmento
    recommendations = models.JSONField(default=list)  # Acciones recomendadas
    lifetime_value_prediction = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-confidence_score']
        verbose_name = 'Customer Segment'
        verbose_name_plural = 'Customer Segments'
    
    def __str__(self):
        return f"Customer {self.customer_id}: {self.segment_type}"


class InventoryAlert(models.Model):
    """
    Alertas de inventario basadas en ML
    """
    ALERT_TYPES = [
        ('low_stock', 'Stock Bajo'),
        ('overstock', 'Sobrestock'),
        ('reorder_now', 'Reabastecer Ahora'),
        ('slow_moving', 'Producto de Baja Rotación'),
        ('high_demand', 'Alta Demanda Próxima'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='inventory_alerts')
    product_id = models.UUIDField()
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    current_stock = models.IntegerField()
    recommended_stock = models.IntegerField()
    predicted_demand_7days = models.IntegerField(null=True, blank=True)
    predicted_demand_30days = models.IntegerField(null=True, blank=True)
    urgency_level = models.IntegerField(default=1)  # 1-5
    estimated_stockout_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-urgency_level', '-created_at']
        verbose_name = 'Inventory Alert'
        verbose_name_plural = 'Inventory Alerts'
    
    def __str__(self):
        return f"{self.alert_type} - Product {self.product_id}"


class MLTrainingLog(models.Model):
    """
    Log de entrenamientos de modelos
    """
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('training', 'Entrenando'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_type = models.CharField(max_length=50)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    data_from = models.DateField(null=True, blank=True)
    data_to = models.DateField(null=True, blank=True)
    records_processed = models.IntegerField(default=0)
    training_duration_seconds = models.IntegerField(default=0)
    metrics = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, null=True)
    started_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    model_saved = models.ForeignKey(MLModel, on_delete=models.SET_NULL, null=True, blank=True, related_name='training_logs')
    
    class Meta:
        ordering = ['-started_at']
        verbose_name = 'ML Training Log'
        verbose_name_plural = 'ML Training Logs'
    
    def __str__(self):
        return f"{self.model_type} - {self.status} - {self.started_at}"
