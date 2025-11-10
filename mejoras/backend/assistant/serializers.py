"""
Serializadores para el sistema de asistente
"""

from rest_framework import serializers
from .models import ChatConversation, ChatMessage, AssistantFeedback


class ChatMessageSerializer(serializers.ModelSerializer):
    """
    Serializador para mensajes individuales
    """
    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'role',
            'content',
            'suggested_actions',
            'related_resources',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ChatConversationSerializer(serializers.ModelSerializer):
    """
    Serializador para conversaciones completas
    """
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id',
            'title',
            'started_at',
            'last_message_at',
            'is_active',
            'message_count',
            'messages'
        ]
        read_only_fields = ['id', 'started_at', 'last_message_at']
    
    def get_message_count(self, obj):
        return obj.messages.count()


class ChatConversationListSerializer(serializers.ModelSerializer):
    """
    Serializador ligero para listar conversaciones
    """
    message_count = serializers.SerializerMethodField()
    last_message_preview = serializers.SerializerMethodField()
    
    class Meta:
        model = ChatConversation
        fields = [
            'id',
            'title',
            'started_at',
            'last_message_at',
            'is_active',
            'message_count',
            'last_message_preview'
        ]
        read_only_fields = ['id', 'started_at', 'last_message_at']
    
    def get_message_count(self, obj):
        return obj.messages.count()
    
    def get_last_message_preview(self, obj):
        last_message = obj.messages.last()
        if last_message:
            return {
                'role': last_message.role,
                'content': last_message.content[:100] + '...' if len(last_message.content) > 100 else last_message.content
            }
        return None


class AssistantFeedbackSerializer(serializers.ModelSerializer):
    """
    Serializador para feedback
    """
    class Meta:
        model = AssistantFeedback
        fields = [
            'id',
            'message',
            'rating',
            'comment',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'user']


class ChatRequestSerializer(serializers.Serializer):
    """
    Serializador para peticiones de chat
    """
    message = serializers.CharField(required=True, max_length=2000)
    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate_message(self, value):
        """
        Validar que el mensaje no esté vacío
        """
        if not value.strip():
            raise serializers.ValidationError("El mensaje no puede estar vacío")
        return value.strip()
