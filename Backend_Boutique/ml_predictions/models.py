from django.db import models
from django.contrib.auth import get_user_model
import uuid

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
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    model_type = models.CharField(max_length=50, choices=MODEL_TYPES)
    version = models.CharField(max_length=50)
    file_path = models.CharField(max_length=500)
    accuracy_score = models.FloatField(null=True, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    training_data_size = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    trained_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    trained_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        ordering = ['-trained_at']
        verbose_name = 'Modelo ML'
        verbose_name_plural = 'Modelos ML'
    
    def __str__(self):
        return f"{self.name} v{self.version}"


class Prediction(models.Model):
    """
    Registro de predicciones realizadas
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model = models.ForeignKey(MLModel, on_delete=models.CASCADE, related_name='predictions')
    input_data = models.JSONField()
    prediction_result = models.JSONField()
    confidence_score = models.FloatField(null=True, blank=True)
    requested_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    execution_time_ms = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Predicción'
        verbose_name_plural = 'Predicciones'
    
    def __str__(self):
        return f"Predicción {self.id} - {self.model.model_type}"


class SalesForecast(models.Model):
    """
    Pronósticos de ventas generados por ML
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prediction = models.ForeignKey(Prediction, on_delete=models.CASCADE, related_name='sales_forecasts')
    forecast_date = models.DateField()
    predicted_sales = models.DecimalField(max_digits=12, decimal_places=2)
    predicted_quantity = models.IntegerField()
    confidence_interval_lower = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    confidence_interval_upper = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    category_id = models.IntegerField(null=True, blank=True)
    product_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['forecast_date']
        verbose_name = 'Pronóstico de Ventas'
        verbose_name_plural = 'Pronósticos de Ventas'
    
    def __str__(self):
        return f"Pronóstico {self.forecast_date}: Bs. {self.predicted_sales}"


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
    model_saved = models.ForeignKey(MLModel, on_delete=models.SET_NULL, null=True, blank=True)
    
    class Meta:
        ordering = ['-started_at']
        verbose_name = 'Log de Entrenamiento'
        verbose_name_plural = 'Logs de Entrenamiento'
    
    def __str__(self):
        return f"Entrenamiento {self.model_type} - {self.status}"
