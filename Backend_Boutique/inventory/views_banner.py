"""
Vista para gestionar el banner del sitio.
Solo usuarios con permisos especiales (admin, dueño) pueden modificarlo.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_banner(request):
    """
    GET: Obtiene la URL actual del banner
    POST: Actualiza la URL del banner (solo admin/dueño)
    """
    
    # Para GET cualquier usuario autenticado puede ver
    if request.method == 'GET':
        banner_url = cache.get('site_banner_url', '')
        return Response({'banner_url': banner_url}, status=status.HTTP_200_OK)
    
    # Para POST solo usuarios con permisos especiales
    if request.method == 'POST':
        user = request.user
        
        # Verificar permisos: debe ser admin O tener rol "Dueño"
        is_owner = hasattr(user, 'user_type') and user.user_type == 'owner'
        
        if not (user.is_staff or is_owner):
            return Response(
                {'error': 'No tienes permiso para modificar el banner'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Obtener la nueva URL del banner
        banner_url = request.data.get('banner_url', '')
        
        if not banner_url:
            return Response(
                {'error': 'Se requiere una URL para el banner'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Guardar en caché (puedes cambiar esto a DB si prefieres)
        cache.set('site_banner_url', banner_url, timeout=None)
        
        return Response(
            {'message': 'Banner actualizado correctamente', 'banner_url': banner_url},
            status=status.HTTP_200_OK
        )
