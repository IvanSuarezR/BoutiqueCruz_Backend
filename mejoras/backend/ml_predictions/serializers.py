from rest_framework import serializers
from .models import (
    MLModel, Prediction, SalesForecast, ProductRecommendation,
    CustomerSegment, InventoryAlert, MLTrainingLog
)


class MLModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = MLModel
        fields = '__all__'
        read_only_fields = ['id', 'trained_at', 'last_used_at']


class PredictionSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='model.name', read_only=True)
    model_type = serializers.CharField(source='model.model_type', read_only=True)
    
    class Meta:
        model = Prediction
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class SalesForecastSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesForecast
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class ProductRecommendationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductRecommendation
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class CustomerSegmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerSegment
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class InventoryAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryAlert
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
    
    def get_product_name(self, obj):
        from products.models import Product
        try:
            product = Product.objects.get(id=obj.product_id)
            return product.name
        except Product.DoesNotExist:
            return "Producto no encontrado"


class MLTrainingLogSerializer(serializers.ModelSerializer):
    started_by_email = serializers.EmailField(source='started_by.email', read_only=True)
    duration_display = serializers.SerializerMethodField()
    
    class Meta:
        model = MLTrainingLog
        fields = '__all__'
        read_only_fields = ['id', 'started_at', 'completed_at']
    
    def get_duration_display(self, obj):
        if obj.training_duration_seconds:
            minutes = obj.training_duration_seconds // 60
            seconds = obj.training_duration_seconds % 60
            return f"{minutes}m {seconds}s"
        return "N/A"
