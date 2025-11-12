"""
Vista para gestionar la galería de imágenes en Google Cloud Storage
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from django.core.files.storage import default_storage
from google.cloud import storage
import os


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_gcs_images(request):
    """
    Lista todas las imágenes en el bucket de GCS
    """
    if not settings.USE_GCS:
        return Response({
            'error': 'Google Cloud Storage no está habilitado',
            'use_gcs': False
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        client = storage.Client(project=settings.GS_PROJECT_ID)
        bucket = client.bucket(settings.GS_BUCKET_NAME)
        
        # Listar todos los blobs (archivos) en el bucket
        blobs = bucket.list_blobs()
        
        images = []
        for blob in blobs:
            # Solo incluir imágenes (extensiones comunes)
            if any(blob.name.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                images.append({
                    'name': blob.name,
                    'url': blob.public_url,
                    'size': blob.size,
                    'content_type': blob.content_type,
                    'created': blob.time_created.isoformat() if blob.time_created else None,
                    'updated': blob.updated.isoformat() if blob.updated else None,
                })
        
        return Response({
            'images': images,
            'total': len(images),
            'bucket': settings.GS_BUCKET_NAME,
        })
    
    except Exception as e:
        return Response({
            'error': f'Error al listar imágenes: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_to_gcs(request):
    """
    Sube una o más imágenes directamente al bucket de GCS
    """
    if not settings.USE_GCS:
        return Response({
            'error': 'Google Cloud Storage no está habilitado'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    files = request.FILES.getlist('images')
    if not files:
        return Response({
            'error': 'No se recibieron imágenes'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Obtener carpeta destino (opcional)
    folder = request.data.get('folder', 'gallery').strip('/')
    
    try:
        uploaded = []
        
        for file in files:
            # Construir path: folder/YYYY/MM/filename
            from datetime import datetime
            now = datetime.now()
            path = f"{folder}/{now.year}/{now.month:02d}/{file.name}"
            
            # Guardar usando el storage de Django
            saved_path = default_storage.save(path, file)
            url = default_storage.url(saved_path)
            
            uploaded.append({
                'name': saved_path,
                'url': url,
                'original_name': file.name,
                'size': file.size,
            })
        
        return Response({
            'uploaded': uploaded,
            'total': len(uploaded),
        })
    
    except Exception as e:
        return Response({
            'error': f'Error al subir imágenes: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_from_gcs(request):
    """
    Elimina una imagen del bucket de GCS
    """
    if not settings.USE_GCS:
        return Response({
            'error': 'Google Cloud Storage no está habilitado'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    image_path = request.data.get('path')
    if not image_path:
        return Response({
            'error': 'Se requiere el path de la imagen'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Eliminar usando el storage de Django
        if default_storage.exists(image_path):
            default_storage.delete(image_path)
            return Response({
                'message': 'Imagen eliminada correctamente',
                'path': image_path,
            })
        else:
            return Response({
                'error': 'La imagen no existe'
            }, status=status.HTTP_404_NOT_FOUND)
    
    except Exception as e:
        return Response({
            'error': f'Error al eliminar imagen: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_folder_in_gcs(request):
    """
    Crea una carpeta (placeholder) en GCS
    """
    if not settings.USE_GCS:
        return Response({
            'error': 'Google Cloud Storage no está habilitado'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    folder_name = request.data.get('folder', '').strip('/')
    if not folder_name:
        return Response({
            'error': 'Se requiere el nombre de la carpeta'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        client = storage.Client(project=settings.GS_PROJECT_ID)
        bucket = client.bucket(settings.GS_BUCKET_NAME)
        
        # Crear un blob vacío con "/" al final (placeholder de carpeta)
        blob = bucket.blob(f"{folder_name}/")
        blob.upload_from_string('', content_type='text/plain')
        
        return Response({
            'message': 'Carpeta creada correctamente',
            'folder': folder_name,
        })
    
    except Exception as e:
        return Response({
            'error': f'Error al crear carpeta: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def download_gcs_image(request):
    """
    Descarga una imagen de GCS y la devuelve como blob
    Esto evita problemas de CORS al hacer fetch desde el frontend
    """
    from django.http import HttpResponse
    import requests
    
    image_url = request.data.get('url')
    if not image_url:
        return Response({
            'error': 'Se requiere la URL de la imagen'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Descargar imagen desde GCS
        response = requests.get(image_url, timeout=10)
        response.raise_for_status()
        
        # Devolver la imagen como respuesta
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        return HttpResponse(response.content, content_type=content_type)
    
    except Exception as e:
        return Response({
            'error': f'Error al descargar imagen: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
