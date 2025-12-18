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
        # Usar cliente nativo de GCS para mayor control y evitar problemas con django-storages ACLs
        client = storage.Client(project=settings.GS_PROJECT_ID)
        bucket = client.bucket(settings.GS_BUCKET_NAME)
        
        uploaded = []
        import uuid
        from datetime import datetime
        
        for file in files:
            # Construir path: folder/YYYY/MM/filename_uuid.ext
            now = datetime.now()
            ext = os.path.splitext(file.name)[1]
            name_without_ext = os.path.splitext(file.name)[0]
            # Sanitize filename simple
            name_clean = "".join(c for c in name_without_ext if c.isalnum() or c in ('-', '_')).strip()
            if not name_clean:
                name_clean = "image"
                
            filename = f"{name_clean}_{uuid.uuid4().hex[:8]}{ext}"
            path = f"{folder}/{now.year}/{now.month:02d}/{filename}"
            
            blob = bucket.blob(path)
            
            # Reset file pointer just in case
            file.seek(0)
            blob.upload_from_file(file, content_type=file.content_type)
            
            # Configurar Cache-Control para mejor rendimiento
            try:
                blob.cache_control = 'public, max-age=31536000'
                blob.patch()
            except Exception as e:
                print(f"Warning setting cache control: {e}")

            # No intentamos hacer público el blob explícitamente porque usamos Uniform Bucket-Level Access
            # La visibilidad depende de los permisos del bucket (allUsers -> Storage Object Viewer)
            
            # Construir URL pública explícita
            public_url = f"https://storage.googleapis.com/{settings.GS_BUCKET_NAME}/{path}"
            
            uploaded.append({
                'name': path,
                'url': public_url,
                'original_name': file.name,
                'size': file.size,
            })
        
        return Response({
            'uploaded': uploaded,
            'total': len(uploaded),
        })
    
    except Exception as e:
        import traceback
        print(f"Error uploading to GCS: {str(e)}")
        print(traceback.format_exc())
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
    import traceback
    
    image_url = request.data.get('url')
    if not image_url:
        return Response({
            'error': 'Se requiere la URL de la imagen'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        print(f"Downloading image from: {image_url}")
        
        # Headers para simular un navegador y evitar bloqueos
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Descargar imagen desde GCS
        # verify=False para evitar problemas de certificados en desarrollo local
        response = requests.get(image_url, timeout=30, verify=False, headers=headers)
        
        if response.status_code != 200:
            print(f"Error downloading from GCS. Status: {response.status_code}, Content: {response.text[:200]}")
            return Response({
                'error': f'Error remoto: {response.status_code}'
            }, status=status.HTTP_502_BAD_GATEWAY)
            
        response.raise_for_status()
        
        # Devolver la imagen como respuesta
        content_type = response.headers.get('Content-Type', 'image/jpeg')
        return HttpResponse(response.content, content_type=content_type)
    
    except Exception as e:
        print(f"Error downloading image: {str(e)}")
        print(traceback.format_exc())
        return Response({
            'error': f'Error al descargar imagen: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
