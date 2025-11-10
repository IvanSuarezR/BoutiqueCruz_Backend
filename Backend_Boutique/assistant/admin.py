"""
Configuración del panel de administración para el sistema de asistente
"""

from django.contrib import admin
from .models import ChatConversation, ChatMessage, AssistantFeedback


@admin.register(ChatConversation)
class ChatConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'title', 'started_at', 'last_message_at', 'is_active']
    list_filter = ['is_active', 'started_at']
    search_fields = ['user__email', 'title']
    readonly_fields = ['id', 'started_at', 'last_message_at']
    date_hierarchy = 'started_at'


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation', 'role', 'content_preview', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content', 'conversation__user__email']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'
    
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Contenido'


@admin.register(AssistantFeedback)
class AssistantFeedbackAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'rating', 'message', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['user__email', 'comment']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'
