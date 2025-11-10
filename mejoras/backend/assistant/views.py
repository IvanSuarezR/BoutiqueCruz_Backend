"""
Vistas para el sistema de asistente virtual
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
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


class AssistantViewSet(viewsets.ViewSet):
    """
    ViewSet para el chatbot asistente
    """
    permission_classes = [IsAuthenticated]
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.ai_service = AssistantAIService()
    
    @action(detail=False, methods=['post'], url_path='chat')
    def chat(self, request):
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
        
        # Determinar el rol del usuario para el contexto
        user_role = self._get_user_role(user)
        
        # Obtener el nombre del usuario
        user_name = self._get_user_name(user)
        
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
                title=self._generate_conversation_title(message_text)
            )
        
        # Guardar mensaje del usuario
        user_message = ChatMessage.objects.create(
            conversation=conversation,
            role='user',
            content=message_text
        )
        
        # Obtener historial de la conversación (últimos 10 mensajes)
        history = self._get_conversation_history(conversation)
        
        # Procesar con IA
        ai_response = self.ai_service.chat(
            user_message=message_text,
            user_role=user_role,
            user_name=user_name,
            conversation_history=history
        )
        
        # Guardar respuesta del asistente
        assistant_message = ChatMessage.objects.create(
            conversation=conversation,
            role='assistant',
            content=ai_response['response'],
            suggested_actions=ai_response.get('suggested_actions', []),
            related_resources=ai_response.get('related_resources', [])
        )
        
        # Serializar respuesta
        return Response({
            'success': True,
            'conversation_id': str(conversation.id),
            'message': ChatMessageSerializer(assistant_message).data,
            'user_role': user_role
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='conversations')
    def conversations(self, request):
        """
        Obtener todas las conversaciones del usuario
        
        GET /api/assistant/conversations/
        """
        conversations = ChatConversation.objects.filter(
            user=request.user,
            is_active=True
        )
        
        serializer = ChatConversationListSerializer(conversations, many=True)
        return Response({
            'success': True,
            'conversations': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='conversation/(?P<conversation_id>[^/.]+)')
    def conversation_detail(self, request, conversation_id=None):
        """
        Obtener detalle de una conversación con todos sus mensajes
        
        GET /api/assistant/conversation/<uuid>/
        """
        conversation = get_object_or_404(
            ChatConversation,
            id=conversation_id,
            user=request.user
        )
        
        serializer = ChatConversationSerializer(conversation)
        return Response({
            'success': True,
            'conversation': serializer.data
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['delete'], url_path='conversation/(?P<conversation_id>[^/.]+)')
    def delete_conversation(self, request, conversation_id=None):
        """
        Eliminar (desactivar) una conversación
        
        DELETE /api/assistant/conversation/<uuid>/
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
    
    @action(detail=False, methods=['post'], url_path='feedback')
    def feedback(self, request):
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
    
    @action(detail=False, methods=['get'], url_path='quick-actions')
    def quick_actions(self, request):
        """
        Obtener acciones rápidas según el rol del usuario
        
        GET /api/assistant/quick-actions/
        """
        user_role = self._get_user_role(request.user)
        
        quick_actions = {
            'admin': [
                {'label': '📦 Ver Productos', 'url': '/products', 'icon': 'package'},
                {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
                {'label': '📊 Ver Inventario', 'url': '/inventory', 'icon': 'bar-chart'},
                {'label': '👥 Gestionar Clientes', 'url': '/customers', 'icon': 'users'},
                {'label': '👨‍💼 Gestionar Empleados', 'url': '/employees', 'icon': 'user-check'},
                {'label': '📈 Generar Reporte', 'url': '/reports', 'icon': 'trending-up'},
                {'label': '⚙️ Configuración', 'url': '/settings', 'icon': 'settings'},
            ],
            'employee': [
                {'label': '📦 Ver Productos', 'url': '/products', 'icon': 'package'},
                {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
                {'label': '📋 Mis Ventas', 'url': '/orders?employee=me', 'icon': 'list'},
                {'label': '👥 Buscar Cliente', 'url': '/customers', 'icon': 'search'},
            ],
            'manager': [
                {'label': '📦 Ver Productos', 'url': '/products', 'icon': 'package'},
                {'label': '💰 Nueva Venta', 'url': '/pos', 'icon': 'shopping-cart'},
                {'label': '📊 Ver Inventario', 'url': '/inventory', 'icon': 'bar-chart'},
                {'label': '📋 Ver Órdenes', 'url': '/orders', 'icon': 'list'},
                {'label': '📈 Reportes', 'url': '/reports', 'icon': 'trending-up'},
                {'label': '👨‍💼 Ver Empleados', 'url': '/employees', 'icon': 'users'},
            ]
        }
        
        return Response({
            'success': True,
            'role': user_role,
            'quick_actions': quick_actions.get(user_role, quick_actions['employee'])
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'], url_path='suggestions')
    def suggestions(self, request):
        """
        Obtener sugerencias de preguntas según el rol del usuario
        
        GET /api/assistant/suggestions/
        """
        user_role = self._get_user_role(request.user)
        
        suggestions = {
            'admin': [
                "¿Cómo creo un nuevo producto?",
                "¿Cómo genero un reporte de ventas del mes?",
                "¿Cómo agrego un nuevo empleado?",
                "¿Cómo veo el inventario de productos con bajo stock?",
                "¿Cómo proceso una devolución?",
                "¿Cómo exporto datos a Excel?",
                "¿Cómo configuro los métodos de pago?",
                "¿Cómo veo las ventas por empleado?",
            ],
            'employee': [
                "¿Cómo registro una venta?",
                "¿Cómo busco un producto por SKU?",
                "¿Cómo veo el stock disponible de un producto?",
                "¿Cómo registro un nuevo cliente?",
                "¿Cómo proceso un pago con tarjeta?",
                "¿Cómo genero una factura?",
                "¿Cómo veo mis ventas del día?",
                "¿Qué hago si un producto no tiene stock?",
            ],
            'manager': [
                "¿Cómo agrego stock a un producto?",
                "¿Cómo veo el rendimiento de ventas?",
                "¿Cómo genero un reporte de inventario?",
                "¿Cómo veo las ventas por categoría?",
                "¿Cómo reviso el desempeño de los cajeros?",
                "¿Cómo marco productos como destacados?",
            ]
        }
        
        return Response({
            'success': True,
            'role': user_role,
            'suggestions': suggestions.get(user_role, suggestions['employee'])
        }, status=status.HTTP_200_OK)
    
    # Métodos auxiliares
    def _get_user_role(self, user) -> str:
        """
        Determina el rol del usuario para el contexto del chatbot
        """
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
    
    def _get_user_name(self, user) -> str:
        """
        Obtiene el nombre del usuario para personalización
        """
        # Intentar obtener el nombre completo
        if hasattr(user, 'first_name') and user.first_name:
            return user.first_name
        elif hasattr(user, 'username'):
            return user.username
        return 'Usuario'
    
    def _generate_conversation_title(self, first_message: str) -> str:
        """
        Genera un título para la conversación basado en el primer mensaje
        """
        # Tomar las primeras palabras del mensaje
        words = first_message.split()[:6]
        title = ' '.join(words)
        if len(first_message.split()) > 6:
            title += '...'
        return title
    
    def _get_conversation_history(self, conversation: ChatConversation) -> list:
        """
        Obtiene el historial de mensajes de una conversación
        """
        messages = conversation.messages.order_by('created_at')[:10]
        return [
            {
                'role': msg.role,
                'content': msg.content
            }
            for msg in messages
        ]
