from django.contrib import admin
from .models import Category, Product, StockMovement, ProductImage, SiteConfiguration


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "created_at")
    search_fields = ("name",)
    list_filter = ("is_active",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "category", "price", "stock", "is_active")
    search_fields = ("sku", "name")
    list_filter = ("is_active", "category")


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("product", "image", "alt_text", "created_at")
    search_fields = ("product__name", "product__sku")


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "created_by", "created_at")
    list_filter = ("movement_type",)
    search_fields = ("product__name", "product__sku")


@admin.register(SiteConfiguration)
class SiteConfigurationAdmin(admin.ModelAdmin):
    list_display = ("banner_url", "updated_at")
    
    def has_add_permission(self, request):
        # Solo permitir crear si no existe ninguno
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        # No permitir borrar la configuración
        return False

