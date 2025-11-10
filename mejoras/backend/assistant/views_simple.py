"""
Vistas simples para el sistema de asistente virtual
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404

from .models import ChatConversation, ChatMessage, AssistantFeedback
from .serializers import (
    ChatConversationSerializer,
    ChatConversationListSerializer,
    ChatMessageSerializer,
    AssistantFeedbackSerializer,
    ChatRequestSerializer
)
from .ai_service import AssistantAIService

# Instancia global del servicio de IA (lazy loading)
_ai_service = None

def get_ai_service():
    """Obtiene la instancia del servicio de IA (singleton con lazy loading)"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AssistantAIService()
    return _ai_service


def _get_user_role(user) -> str:
    """Determina el rol del usuario para el contexto del chatbot"""
    if user.is_superuser or user.is_staff:
        return 'admin'
    elif hasattr(user, 'role'):
        role_map = {
            'admin': 'admin',
            'manager': 'manager',
            'employee': 'employee',
            'cashier': 'employee',
            'customer': 'customer'
        }
        return role_map.get(user.role, 'employee')
    return 'employee'


def _generate_conversation_title(first_message: str) -> str:
    """Genera un título para la conversación basado en el primer mensaje"""
    words = first_message.split()[:6]
    title = ' '.join(words)
    if len(first_message.split()) > 6:
        title += '...'
    return title


def _get_conversation_history(conversation: ChatConversation) -> list:
    """Obtiene el historial de mensajes de una conversación"""
    messages = conversation.messages.order_by('created_at')[:10]
    return [
        {'role': msg.role, 'content': msg.content}
        for msg in messages
    ]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chat_message(request):
    """
    Endpoint principal para enviar mensajes al chatbot
    
    POST /api/assistant/chat/
    Body: {
        "message": "¿Cómo veo el inventario?",
        "conversation_id": "uuid-opcional"
    }
    """
    serializer = ChatRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': 'Datos inválidos', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = request.user
    message_text = serializer.validated_data['message']
    conversation_id = serializer.validated_data.get('conversation_id')
    
    # Determinar el rol del usuario
    user_role = _get_user_role(user)
    
    # Obtener o crear conversación
    if conversation_id:
        conversation = get_object_or_404(
            ChatConversation, 
            id=conversation_id, 
            user=user
        )
    else:
        conversation = ChatConversation.objects.create(
            user=user,
            title=_generate_conversation_title(message_text)
        )
    
    # Guardar mensaje del usuario
    user_message = ChatMessage.objects.create(
        conversation=conversation,
        role='user',
        content=message_text
    )
    
    # Obtener historial
    history = _get_conversation_history(conversation)
    
    # Procesar con IA
    try:
        ai_service = get_ai_service()
        ai_response = ai_service.chat(
            user_message=message_text,
            user_role=user_role,
            conversation_history=history
        )
    except Exception as e:
        return Response(
            {'error': 'Error al procesar el mensaje', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Guardar respuesta del asistente
    assistant_message = ChatMessage.objects.create(
        conversation=conversation,
        role='assistant',
        content=ai_response['response'],
        suggested_actions=ai_response.get('suggested_actions', []),
        related_resources=ai_response.get('related_resources', [])
    )
    
    return Response({
        'success': True,
        'conversation_id': str(conversation.id),
        'message': ChatMessageSerializer(assistant_message).data,
        'user_role': user_role
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_conversations(request):
    """
    Obtener todas las conversaciones del usuario
    
    GET /api/assistant/conversations/
    """
    conversations = ChatConversation.objects.filter(
        user=request.user,
        is_active=True
    ).order_by('-last_message_at')
    
    serializer = ChatConversationListSerializer(conversations, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_detail(request, conversation_id):
    """
    Obtener detalle de una conversación con todos sus mensajes
    
    GET /api/assistant/conversations/<uuid>/
    """
    conversation = get_object_or_404(
        ChatConversation,
        id=conversation_id,
        user=request.user
    )
    
    serializer = ChatConversationSerializer(conversation)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_conversation(request, conversation_id):
    """
    Eliminar (desactivar) una conversación
    
    DELETE /api/assistant/conversations/<uuid>/delete/
    """
    conversation = get_object_or_404(
        ChatConversation,
        id=conversation_id,
        user=request.user
    )
    
    conversation.is_active = False
    conversation.save()
    
    return Response({
        'success': True,
        'message': 'Conversación eliminada correctamente'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_feedback(request):
    """
    Enviar feedback sobre una respuesta del asistente
    
    POST /api/assistant/feedback/
    Body: {
        "message": "uuid-del-mensaje",
        "rating": 5,
        "comment": "Muy útil"
    }
    """
    serializer = AssistantFeedbackSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {'error': 'Datos inválidos', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verificar que el mensaje pertenezca a una conversación del usuario
    message = get_object_or_404(ChatMessage, id=request.data['message'])
    if message.conversation.user != request.user:
        return Response(
            {'error': 'No tienes permiso para dar feedback a este mensaje'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    feedback = serializer.save(user=request.user)
    
    return Response({
        'success': True,
        'message': 'Gracias por tu feedback',
        'feedback': AssistantFeedbackSerializer(feedback).data
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_quick_actions(request):
    """
    Obtener acciones rápidas según el rol del usuario
    
    GET /api/assistant/quick-actions/
    """
    user_role = _get_user_role(request.user)
    
    quick_actions = {
        'admin': [
            {'label': '📦 Ver Productos', 'url': '/inventory', 'icon': 'package'},
            {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
            {'label': '📊 Ver Reportes', 'url': '/reports', 'icon': 'bar-chart'},
            {'label': '👥 Gestionar Empleados', 'url': '/employees', 'icon': 'users'},
        ],
        'employee': [
            {'label': '📦 Ver Productos', 'url': '/inventory', 'icon': 'package'},
            {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
            {'label': '📋 Mis Ventas', 'url': '/pos', 'icon': 'list'},
            {'label': '👤 Mi Perfil', 'url': '/profile', 'icon': 'user'},
        ],
        'manager': [
            {'label': '📦 Ver Productos', 'url': '/inventory', 'icon': 'package'},
            {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
            {'label': '📊 Ver Reportes', 'url': '/reports', 'icon': 'bar-chart'},
            {'label': '👨‍💼 Ver Empleados', 'url': '/employees', 'icon': 'users'},
        ]
    }
    
    return Response({
        'success': True,
        'role': user_role,
        'quick_actions': quick_actions.get(user_role, quick_actions['employee'])
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_suggestions(request):
    """
    Obtener sugerencias de preguntas según el rol del usuario
    
    GET /api/assistant/suggestions/
    """
    user_role = _get_user_role(request.user)
    
    suggestions = {
        'admin': [
            "¿Cómo creo un nuevo producto?",
            "¿Cómo genero un reporte de ventas del mes?",
            "¿Cómo agrego un nuevo empleado?",
        ],
        'employee': [
            "¿Cómo registro una venta?",
            "¿Cómo busco un producto por SKU?",
            "¿Cómo veo el stock disponible?",
        ],
        'manager': [
            "¿Cómo agrego stock a un producto?",
            "¿Cómo veo el rendimiento de ventas?",
            "¿Cómo genero un reporte de inventario?",
        ]
    }
    
    return Response({
        'success': True,
        'role': user_role,
        'suggestions': suggestions.get(user_role, suggestions['employee'])
    }, status=status.HTTP_200_OK)
