"""
URLs para el sistema de asistente virtual
"""

from django.urls import path
from .views_simple import (
    chat_message,
    list_conversations,
    conversation_detail,
    delete_conversation,
    send_feedback,
    get_quick_actions,
    get_suggestions
)

urlpatterns = [
    # Chat endpoints
    path('chat/', chat_message, name='assistant-chat'),
    path('conversations/', list_conversations, name='assistant-conversations'),
    path('conversations/<uuid:conversation_id>/', conversation_detail, name='assistant-conversation-detail'),
    path('conversations/<uuid:conversation_id>/delete/', delete_conversation, name='assistant-delete-conversation'),
    
    # Feedback
    path('feedback/', send_feedback, name='assistant-feedback'),
    
    # Quick actions & suggestions
    path('quick-actions/', get_quick_actions, name='assistant-quick-actions'),
    path('suggestions/', get_suggestions, name='assistant-suggestions'),
]


# cuando termines de hacer las pruebas con views_simple.py, elimina el archivo y mueve las vistas a views.py  # Nota: Este archivo utiliza vistas simples para facilitar las pruebas iniciales.