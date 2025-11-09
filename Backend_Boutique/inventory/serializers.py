from rest_framework import serializers
import json
from .models import Category, Product, StockMovement, ProductImage, ProductVariant


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField(read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    kind_display = serializers.CharField(source='get_kind_display', read_only=True)
    class Meta:
        model = Category
        fields = [
            "id", "name", "description", "gender", "gender_display", "kind", "kind_display",
            "sizes", "is_active", "product_count", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_product_count(self, obj):
        try:
            return Product.objects.filter(category=obj).count()
        except Exception:
            return 0


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    images = serializers.SerializerMethodField(read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    variants = serializers.SerializerMethodField(read_only=True)
    size_stocks = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "sku", "name", "category", "category_name", "gender", "gender_display", "price", "stock", "description",
            "color", "colors", "sizes", "size_stocks", "image", "images", "variants",
            "is_active", "created_at", "updated_at"
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate(self, attrs):
        # Permitir que 'colors' llegue como JSON string o lista y mapear 'color' (legacy) cuando sea necesario
        initial = getattr(self, 'initial_data', {}) or {}
        colors_in = initial.get('colors', None)
        single_color = initial.get('color', None)
        colors_list = None
        if colors_in is not None:
            if isinstance(colors_in, list):
                colors_list = [str(c).strip() for c in colors_in if str(c).strip()]
            elif isinstance(colors_in, str):
                s = colors_in.strip()
                if s:
                    try:
                        parsed = json.loads(s)
                        if isinstance(parsed, list):
                            colors_list = [str(c).strip() for c in parsed if str(c).strip()]
                        else:
                            # intentar separar por comas
                            colors_list = [x.strip() for x in s.split(',') if x.strip()]
                    except Exception:
                        colors_list = [x.strip() for x in s.split(',') if x.strip()]
        elif single_color:
            sc = str(single_color).strip()
            if sc:
                colors_list = [sc]

        if colors_list is not None:
            attrs['colors'] = colors_list
            # Para compatibilidad, setear 'color' como el primero
            if colors_list:
                attrs['color'] = colors_list[0]
        return attrs

    def get_images(self, obj):
        request = self.context.get('request') if hasattr(self, 'context') else None
        data = []
        for img in obj.images.all():
            url = img.image.url if img.image else None
            if url and request and not url.startswith('http'):
                url = request.build_absolute_uri(url)
            data.append({
                "id": img.id,
                "image": url,
                "alt_text": img.alt_text,
            })
        return data

    def get_variants(self, obj):
        return [
            {
                "id": v.id,
                "size": v.size,
                "stock": v.stock,
                "sku": v.sku,
            }
            for v in getattr(obj, 'variants').all()
        ]

    def get_size_stocks(self, obj):
        # Representación de conveniencia: {size: stock}
        return {v.size: v.stock for v in getattr(obj, 'variants').all()}

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request') if hasattr(self, 'context') else None
        url = data.get('image')
        if url and request and isinstance(url, str) and not url.startswith('http'):
            try:
                data['image'] = request.build_absolute_uri(instance.image.url)
            except Exception:
                pass
        return data


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "movement_type", "quantity", "note", "created_by", "created_at"
        ]
        read_only_fields = ["id", "created_by", "created_at"]


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "image", "alt_text", "created_at"]
        read_only_fields = ["id", "created_at"]
