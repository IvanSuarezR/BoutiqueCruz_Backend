from rest_framework import serializers
from .models import MLModel, Prediction, SalesForecast, MLTrainingLog


class MLModelSerializer(serializers.ModelSerializer):
    trained_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = MLModel
        fields = '__all__'
    
    def get_trained_by_name(self, obj):
        return obj.trained_by.get_full_name() if obj.trained_by else None


class PredictionSerializer(serializers.ModelSerializer):
    model_name = serializers.CharField(source='model.name', read_only=True)
    requested_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Prediction
        fields = '__all__'
    
    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else None


class SalesForecastSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesForecast
        fields = '__all__'


class MLTrainingLogSerializer(serializers.ModelSerializer):
    started_by_name = serializers.SerializerMethodField()
    model_name = serializers.CharField(source='model_saved.name', read_only=True)
    
    class Meta:
        model = MLTrainingLog
        fields = '__all__'
    
    def get_started_by_name(self, obj):
        return obj.started_by.get_full_name() if obj.started_by else None
