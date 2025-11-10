"""
Modelos para el sistema de asistente virtual (chatbot)
"""

from django.db import models
from authentication.models import User
import uuid


class ChatConversation(models.Model):
    """
    Representa una conversación completa del usuario con el chatbot
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chat_conversations')
    title = models.CharField(max_length=255, blank=True)  # Título auto-generado de la conversación
    started_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-last_message_at']
        
    def __str__(self):
        return f"Conversación de {self.user.email} - {self.title or 'Sin título'}"


class ChatMessage(models.Model):
    """
    Representa un mensaje individual en una conversación
    """
    ROLE_CHOICES = [
        ('user', 'Usuario'),
        ('assistant', 'Asistente'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(ChatConversation, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    
    # Metadata adicional para respuestas del asistente
    suggested_actions = models.JSONField(null=True, blank=True)  # Enlaces y acciones sugeridas
    related_resources = models.JSONField(null=True, blank=True)  # Recursos relacionados
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['created_at']
        
    def __str__(self):
        return f"{self.get_role_display()}: {self.content[:50]}..."


class AssistantFeedback(models.Model):
    """
    Feedback del usuario sobre las respuestas del asistente
    """
    RATING_CHOICES = [
        (1, 'Muy mala'),
        (2, 'Mala'),
        (3, 'Regular'),
        (4, 'Buena'),
        (5, 'Excelente'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='feedbacks')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.IntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"Feedback de {self.user.email} - Rating: {self.rating}/5"
