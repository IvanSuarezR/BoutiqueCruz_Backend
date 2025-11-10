from django.contrib import admin
from .models import (
    MLModel, Prediction, SalesForecast, ProductRecommendation,
    CustomerSegment, InventoryAlert, MLTrainingLog
)


@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ['name', 'model_type', 'version', 'accuracy_score', 'is_active', 'trained_at']
    list_filter = ['model_type', 'is_active', 'trained_at']
    search_fields = ['name', 'version']
    readonly_fields = ['id', 'trained_at', 'last_used_at']
    ordering = ['-trained_at']


@admin.register(Prediction)
class PredictionAdmin(admin.ModelAdmin):
    list_display = ['id', 'model', 'requested_by', 'created_at', 'execution_time_ms']
    list_filter = ['created_at', 'model__model_type']
    search_fields = ['id']
    readonly_fields = ['id', 'created_at']
    ordering = ['-created_at']


@admin.register(SalesForecast)
class SalesForecastAdmin(admin.ModelAdmin):
    list_display = ['forecast_date', 'predicted_sales', 'predicted_quantity', 'category']
    list_filter = ['forecast_date', 'category']
    ordering = ['forecast_date']


@admin.register(ProductRecommendation)
class ProductRecommendationAdmin(admin.ModelAdmin):
    list_display = ['source_product_id', 'recommended_product_id', 'confidence_score', 'reason']
    list_filter = ['reason', 'created_at']
    ordering = ['-confidence_score']


@admin.register(CustomerSegment)
class CustomerSegmentAdmin(admin.ModelAdmin):
    list_display = ['customer_id', 'segment_type', 'confidence_score', 'lifetime_value_prediction']
    list_filter = ['segment_type', 'created_at']
    ordering = ['-confidence_score']


@admin.register(InventoryAlert)
class InventoryAlertAdmin(admin.ModelAdmin):
    list_display = ['product_id', 'alert_type', 'current_stock', 'urgency_level', 'resolved', 'created_at']
    list_filter = ['alert_type', 'urgency_level', 'resolved', 'created_at']
    search_fields = ['product_id']
    readonly_fields = ['id', 'created_at']
    ordering = ['-urgency_level', '-created_at']
    
    actions = ['mark_as_resolved']
    
    def mark_as_resolved(self, request, queryset):
        from django.utils import timezone
        queryset.update(resolved=True, resolved_at=timezone.now())
    mark_as_resolved.short_description = "Marcar como resueltas"


@admin.register(MLTrainingLog)
class MLTrainingLogAdmin(admin.ModelAdmin):
    list_display = ['model_type', 'status', 'started_by', 'started_at', 'training_duration_seconds']
    list_filter = ['model_type', 'status', 'started_at']
    search_fields = ['model_type']
    readonly_fields = ['id', 'started_at', 'completed_at']
    ordering = ['-started_at']

