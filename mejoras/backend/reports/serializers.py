from rest_framework import serializers
from .models import ReportLog


class ReportLogSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()
    
    class Meta:
        model = ReportLog
        fields = [
            'id',
            'user_email',
            'user_name',
            'report_type',
            'input_type',
            'original_prompt',
            'transcription',
            'results_count',
            'export_format',
            'execution_time',
            'tokens_used',
            'success',
            'error_message',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email
