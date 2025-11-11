from django.contrib import admin
from .models import MLModel, Prediction, SalesForecast, MLTrainingLog


@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ('name', 'model_type', 'version', 'accuracy_score', 'is_active', 'trained_at')
    list_filter = ('model_type', 'is_active', 'trained_at')
    search_fields = ('name', 'version')
    readonly_fields = ('id', 'trained_at', 'last_used_at')


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = ('id', 'model', 'confidence_score', 'requested_by', 'created_at')
    list_filter = ('model__model_type', 'created_at')
    readonly_fields = ('id', 'created_at', 'execution_time_ms')


@admin.register(SalesForecast)
class SalesForecastAdmin(admin.ModelAdmin):
    list_display = ('forecast_date', 'predicted_sales', 'predicted_quantity', 'created_at')
    list_filter = ('forecast_date', 'created_at')
    readonly_fields = ('id', 'created_at')


@admin.register(MLTrainingLog)
class MLTrainingLogAdmin(admin.ModelAdmin):
    list_display = ('model_type', 'status', 'records_processed', 'training_duration_seconds', 'started_at')
    list_filter = ('model_type', 'status', 'started_at')
    readonly_fields = ('id', 'started_at', 'completed_at')
