from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import CategoryViewSet, ProductViewSet, StockMovementViewSet
from .views_gcs_gallery import (
    list_gcs_images,
    upload_to_gcs,
    delete_from_gcs,
    create_folder_in_gcs,
    download_gcs_image,
)
from .views_banner import manage_banner

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')

urlpatterns = [
    # Banner management
    path('banner/', manage_banner, name='banner-manage'),
    
    # GCS Gallery endpoints
    path('gcs-gallery/', list_gcs_images, name='gcs-gallery-list'),
    path('gcs-gallery/upload/', upload_to_gcs, name='gcs-gallery-upload'),
    path('gcs-gallery/delete/', delete_from_gcs, name='gcs-gallery-delete'),
    path('gcs-gallery/create-folder/', create_folder_in_gcs, name='gcs-gallery-create-folder'),
    path('gcs-gallery/download/', download_gcs_image, name='gcs-gallery-download'),
] + router.urls
