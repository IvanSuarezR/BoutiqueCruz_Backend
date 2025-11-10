from django.db import models
from django.contrib.auth import get_user_model
import uuid

User = get_user_model()


class ReportLog(models.Model):
    """
    Registro de reportes generados para auditoría
    """
    REPORT_TYPES = [
        ('sales', 'Ventas'),
        ('purchases', 'Compras'),
        ('inventory', 'Inventario'),
        ('customers', 'Clientes'),
        ('financial', 'Financiero'),
        ('custom', 'Personalizado'),
    ]
    
    INPUT_TYPES = [
        ('text', 'Texto'),
        ('audio', 'Audio'),
    ]
    
    EXPORT_FORMATS = [
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('json', 'JSON'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='generated_reports')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    input_type = models.CharField(max_length=10, choices=INPUT_TYPES)
    
    # Entrada del usuario
    original_prompt = models.TextField(help_text="Prompt original del usuario")
    audio_file = models.FileField(upload_to='reports/audio/', null=True, blank=True)
    transcription = models.TextField(null=True, blank=True, help_text="Transcripción del audio")
    
    # SQL generado
    generated_sql = models.TextField(help_text="SQL generado por la IA")
    sql_params = models.JSONField(default=dict, blank=True)
    
    # Resultados
    results_count = models.IntegerField(default=0)
    export_format = models.CharField(max_length=10, choices=EXPORT_FORMATS)
    file_path = models.CharField(max_length=500, null=True, blank=True)
    
    # Metadata
    execution_time = models.FloatField(help_text="Tiempo de ejecución en segundos")
    tokens_used = models.IntegerField(default=0, help_text="Tokens consumidos en la IA")
    success = models.BooleanField(default=True)
    error_message = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['report_type']),
        ]
    
    def __str__(self):
        return f"{self.user.email} - {self.report_type} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"
