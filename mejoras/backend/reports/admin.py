from django.contrib import admin
from .models import ReportLog


@admin.register(ReportLog)
class ReportLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'report_type', 'input_type', 'results_count', 'success', 'created_at']
    list_filter = ['report_type', 'input_type', 'success', 'created_at']
    search_fields = ['user__email', 'original_prompt', 'transcription']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Usuario', {
            'fields': ('user',)
        }),
        ('Entrada', {
            'fields': ('input_type', 'original_prompt', 'transcription', 'audio_file')
        }),
        ('SQL', {
            'fields': ('generated_sql', 'sql_params')
        }),
        ('Resultados', {
            'fields': ('report_type', 'results_count', 'export_format', 'file_path')
        }),
        ('Metadata', {
            'fields': ('execution_time', 'tokens_used', 'success', 'error_message', 'created_at')
        }),
    )
