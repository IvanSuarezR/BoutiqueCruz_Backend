from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.permissions import AllowAny
from accounts.permissions import ReadOnlyOrPermission, RequirePermission
from .models import Category, Product, StockMovement, ProductImage, ProductVariant
from django.db import models
from .serializers import CategorySerializer, ProductSerializer, StockMovementSerializer, ProductImageSerializer
from django.utils.dateparse import parse_date
from django.core.files.storage import default_storage


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated & ReadOnlyOrPermission.with_perms('inventory.manage')]

    def get_permissions(self):
        # Permitir lectura pública para list/retrieve, exigir permisos para modificaciones
        if self.request and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        request = getattr(self, 'request', None)
        if not request:
            return qs
        q = request.query_params.get('q')
        if q:
            # Permitir búsqueda por nombre o SKU para soportar caja/POS
            qs = qs.filter(models.Q(name__icontains=q) | models.Q(sku__icontains=q))
        is_active = request.query_params.get('is_active')
        if is_active in ('true', 'True', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', 'False', '0'):
            qs = qs.filter(is_active=False)
        gender = request.query_params.get('gender')
        if gender:
            g = str(gender).strip().lower()
            # soporte de alias: hombre/mujer/unisex
            if g.startswith('h'):
                qs = qs.filter(gender='M')
            elif g.startswith('m') and g != 'mujer':  # por si 'male' o 'masculino'
                qs = qs.filter(gender='M')
            elif g.startswith('f') or g.startswith('mujer'):
                qs = qs.filter(gender='F')
            elif g.startswith('u'):
                qs = qs.filter(gender='U')
            elif g in ('m', 'f', 'u'):
                qs = qs.filter(gender=g.upper())
        kind = request.query_params.get('kind')
        if kind:
            k = str(kind).strip().lower()
            # alias: vestir/calzado
            if k.startswith('v'):
                qs = qs.filter(kind='V')
            elif k.startswith('c') or k.startswith('z'):
                qs = qs.filter(kind='Z')
        return qs


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by('name')
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated & ReadOnlyOrPermission.with_perms('inventory.manage')]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        # Permitir lectura pública para list/retrieve, exigir permisos para escritura
        if self.request and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        request = getattr(self, 'request', None)
        if not request:
            return qs
        # Filtros opcionales: category, q (nombre), is_active, color, stock_level; y orden: sort
        category = request.query_params.get('category')
        if category:
            try:
                qs = qs.filter(category_id=int(category))
            except ValueError:
                pass
        # Precise SKU search support
        sku = request.query_params.get('sku')
        if sku:
            qs = qs.filter(models.Q(sku__iexact=sku) | models.Q(sku__icontains=sku))
        q = request.query_params.get('q')
        if q:
            qs = qs.filter(models.Q(name__icontains=q) | models.Q(sku__icontains=q))
        is_active = request.query_params.get('is_active')
        if is_active in ('true', 'True', '1'):
            qs = qs.filter(is_active=True)
        elif is_active in ('false', 'False', '0'):
            qs = qs.filter(is_active=False)

        # Filtro por género de categoría (hombre/mujer/unisex)
        gender = request.query_params.get('gender')
        if gender:
            g_raw = str(gender).strip().lower()
            g = None
            if g_raw in ('m', 'f', 'u'):
                g = g_raw.upper()
            elif g_raw.startswith('h') or (g_raw.startswith('m') and g_raw != 'mujer'):
                g = 'M'
            elif g_raw.startswith('f') or g_raw.startswith('mujer'):
                g = 'F'
            elif g_raw.startswith('u'):
                g = 'U'
            if g:
                qs = qs.filter(
                    models.Q(gender=g) | (models.Q(gender__isnull=True) & models.Q(category__gender=g))
                )

        # Filtro por color único (legacy) o múltiples colores
        color = request.query_params.get('color')
        colors_multi = []
        # soportar ?colors=rojo,azul o ?colors=rojo&colors=azul o ?colors[]=rojo&colors[]=azul
        colors_multi += [c for c in request.query_params.getlist('colors') if c]
        colors_multi += [c for c in request.query_params.getlist('colors[]') if c]
        colors_csv = request.query_params.get('colors')
        if colors_csv and not colors_multi:
            colors_multi = [x.strip() for x in colors_csv.split(',') if x.strip()]

        if color:
            qs = qs.filter(models.Q(color__icontains=color) | models.Q(colors__icontains=color))
        if colors_multi:
            cond = models.Q()
            for c in colors_multi:
                cond |= models.Q(colors__icontains=c) | models.Q(color__icontains=c)
            qs = qs.filter(cond)

        stock_level = request.query_params.get('stock_level')
        if stock_level == 'out':
            qs = qs.filter(stock__lte=0)
        elif stock_level == 'low':
            qs = qs.filter(stock__gt=0, stock__lte=5)
        elif stock_level == 'ok':
            qs = qs.filter(stock__gt=5, stock__lte=50)
        elif stock_level == 'high':
            qs = qs.filter(stock__gt=50)

        # Advanced stock range filtering
        stock_min = request.query_params.get('stock_min')
        stock_max = request.query_params.get('stock_max')
        try:
            if stock_min is not None and stock_min != '':
                qs = qs.filter(stock__gte=int(stock_min))
        except ValueError:
            pass
        try:
            if stock_max is not None and stock_max != '':
                qs = qs.filter(stock__lte=int(stock_max))
        except ValueError:
            pass

        # Created (date added) range filtering: created_from, created_to -> YYYY-MM-DD
        created_from = request.query_params.get('created_from')
        created_to = request.query_params.get('created_to')
        if created_from:
            d = parse_date(created_from)
            if d:
                qs = qs.filter(created_at__date__gte=d)
        if created_to:
            d = parse_date(created_to)
            if d:
                qs = qs.filter(created_at__date__lte=d)

        sort = request.query_params.get('sort')
        if sort == 'recent':
            qs = qs.order_by('-created_at')
        elif sort == 'price_asc':
            qs = qs.order_by('price')
        elif sort == 'price_desc':
            qs = qs.order_by('-price')
        elif sort == 'stock_asc':
            qs = qs.order_by('stock')
        elif sort == 'stock_desc':
            qs = qs.order_by('-stock')
        else:
            # default keeps name ordering
            qs = qs.order_by('name')
        return qs

    # Removed _get_library_product; we no longer create library bucket products.

    def _parse_size_stocks(self, request):
        raw = request.data.get('size_stocks')
        mapping = {}
        if raw is None:
            return None
        if isinstance(raw, dict):
            mapping = raw
        elif isinstance(raw, str):
            try:
                import json
                parsed = json.loads(raw)
                if isinstance(parsed, dict):
                    mapping = parsed
            except Exception:
                # allow formats like "S:2,M:1"
                try:
                    parts = [x.strip() for x in raw.split(',') if x.strip()]
                    for p in parts:
                        if ':' in p:
                            s, q = p.split(':', 1)
                            mapping[s.strip()] = int(q.strip())
                except Exception:
                    mapping = {}
        # normalize values to ints and keys to strings
        norm = {}
        for k, v in mapping.items():
            try:
                norm[str(k)] = int(v)
            except Exception:
                continue
        return norm

    def _url_to_rel_media(self, url: str):
        try:
            from urllib.parse import urlparse
            p = urlparse(str(url)).path or ''
            # Typical: /media/products/2025/11/file.jpg -> products/2025/11/file.jpg
            if p.startswith('/'): p = p[1:]
            if p.startswith('media/'):
                return p[len('media/'):]
            # If MEDIA_URL is configured differently, try to find 'products/' segment
            idx = p.find('products/')
            if idx >= 0:
                return p[idx:]
            return p
        except Exception:
            return None

    def _apply_variants_and_images(self, request, product: Product, is_update=False):
        # Handle variants via size_stocks mapping
        size_map = self._parse_size_stocks(request)
        if size_map is not None:
            # Replace existing variants with provided mapping
            existing = {v.size: v for v in product.variants.all()}
            keep_sizes = set()
            for size, qty in size_map.items():
                v = existing.get(size)
                if v:
                    v.stock = qty
                    v.save(update_fields=['stock'])
                else:
                    ProductVariant.objects.create(product=product, size=size, stock=qty)
                keep_sizes.add(size)
            # Delete variants not present anymore
            for size, v in existing.items():
                if size not in keep_sizes:
                    v.delete()
            # Update product stock and sizes list
            product.stock = sum(int(q or 0) for q in size_map.values())
            product.sizes = sorted(list(keep_sizes))
            product.save(update_fields=['stock', 'sizes'])

        # ============================================================
        # MANEJO DE IMÁGENES - SISTEMA SIMPLIFICADO Y CORRECTO
        # ============================================================
        
        import json
        from os.path import basename
        
        # PASO 1: Eliminar imágenes marcadas para eliminación
        removed_ids = request.data.get('removed_image_ids')
        force_delete_ids = request.data.get('force_delete_image_ids')
        
        # Convertir a lista si es necesario
        to_remove_ids = []
        if removed_ids:
            try:
                parsed = removed_ids if isinstance(removed_ids, list) else json.loads(str(removed_ids))
                if isinstance(parsed, list):
                    to_remove_ids = [int(x) for x in parsed if str(x).isdigit()]
            except Exception:
                pass
        
        # Eliminar las imágenes marcadas (solo desvincular, no borrar archivo físico)
        if to_remove_ids:
            product.images.filter(id__in=to_remove_ids).delete()
        
        # Eliminación forzada (borra archivo físico si no está usado por otros productos)
        if force_delete_ids:
            try:
                parsed = force_delete_ids if isinstance(force_delete_ids, list) else json.loads(str(force_delete_ids))
                if isinstance(parsed, list):
                    force_ids = [int(x) for x in parsed if str(x).isdigit()]
                    for img_id in force_ids:
                        try:
                            img = ProductImage.objects.filter(id=img_id).first()
                            if img:
                                path = str(img.image.name)
                                # Borrar todas las referencias a este archivo
                                ProductImage.objects.filter(image=path).delete()
                                # Borrar archivo físico
                                if default_storage.exists(path):
                                    default_storage.delete(path)
                        except Exception:
                            pass
            except Exception:
                pass

        # PASO 2: Procesar orden de imágenes (images_order)
        images_order = request.data.get('images_order')
        primary_image_url = request.data.get('primary_image_url')
        primary_target = None

        # Obtener archivos subidos
        files_list = list(request.FILES.getlist('images') or [])
        files_by_name = {}
        for f in files_list:
            try:
                name = basename(getattr(f, 'name', ''))
                if name:
                    files_by_name[name] = f
            except Exception:
                continue

        # Si hay images_order, usarlo como fuente de verdad
        if images_order:
            try:
                ordered = images_order if isinstance(images_order, list) else json.loads(str(images_order))
            except Exception:
                ordered = []
            
            if isinstance(ordered, list) and len(ordered) > 0:
                # Obtener todas las imágenes existentes actuales
                existing_images = {img.id: img for img in product.images.all()}
                existing_by_filename = {}
                for img in existing_images.values():
                    try:
                        fname = basename(str(img.image.name))
                        existing_by_filename[fname] = img
                    except Exception:
                        continue
                
                # Procesar cada imagen en el orden especificado
                next_order = 1
                processed_existing_ids = set()
                processed_filenames = set()
                
                for entry in ordered:
                    etype = entry.get('type') if isinstance(entry, dict) else None
                    
                    if etype == 'existing':
                        # Imagen que ya existe en el producto
                        img_id = entry.get('id')
                        if img_id and int(img_id) in existing_images:
                            img = existing_images[int(img_id)]
                            if img.id not in processed_existing_ids:
                                img.sort_order = next_order
                                img.save(update_fields=['sort_order'])
                                processed_existing_ids.add(img.id)
                                
                                # Marcar como primary si corresponde
                                url = entry.get('url', '')
                                if primary_image_url and url and str(url) == str(primary_image_url):
                                    primary_target = img
                                
                                next_order += 1
                    
                    elif etype == 'new':
                        # Archivo nuevo subido
                        filename = entry.get('name', '')
                        if filename and filename in files_by_name and filename not in processed_filenames:
                            # Verificar si ya existe una imagen con este nombre de archivo
                            if filename in existing_by_filename:
                                # Reutilizar la existente
                                img = existing_by_filename[filename]
                                if img.id not in processed_existing_ids:
                                    img.sort_order = next_order
                                    img.save(update_fields=['sort_order'])
                                    processed_existing_ids.add(img.id)
                                    processed_filenames.add(filename)
                                    next_order += 1
                            else:
                                # Crear nueva
                                file_obj = files_by_name[filename]
                                new_img = ProductImage.objects.create(
                                    product=product,
                                    image=file_obj,
                                    sort_order=next_order
                                )
                                processed_filenames.add(filename)
                                processed_existing_ids.add(new_img.id)
                                
                                if primary_target is None:
                                    primary_target = new_img
                                
                                next_order += 1
                    
                    elif etype == 'library':
                        # Imagen desde librería (mover de otro producto)
                        source_id = entry.get('source_id')
                        if source_id:
                            try:
                                src_img = ProductImage.objects.filter(id=int(source_id)).first()
                                if src_img and src_img.id not in processed_existing_ids:
                                    src_img.product = product
                                    src_img.sort_order = next_order
                                    src_img.is_primary = False
                                    src_img.save(update_fields=['product', 'sort_order', 'is_primary'])
                                    processed_existing_ids.add(src_img.id)
                                    next_order += 1
                            except Exception:
                                pass
                
                # IMPORTANTE: Eliminar imágenes existentes que NO están en images_order
                # Esto significa que fueron eliminadas intencionalmente
                images_to_delete = product.images.exclude(id__in=processed_existing_ids)
                images_to_delete.delete()
            
            else:
                # images_order está vacío = eliminar todas las imágenes
                product.images.all().delete()
        
        else:
            # No hay images_order (modo legacy): solo agregar nuevas imágenes al final
            if files_list:
                current_max = product.images.aggregate(models.Max('sort_order')).get('sort_order__max') or 0
                order = current_max + 1
                for f in files_list:
                    ProductImage.objects.create(product=product, image=f, sort_order=order)
                    order += 1

        # PASO 3: Establecer imagen principal
        # Si ya se marcó primary_target durante el procesamiento, usarlo
        # Si no, buscar por URL o tomar la primera imagen
        if primary_target is None and primary_image_url:
            # Buscar por URL proporcionada
            try:
                rel_path = self._url_to_rel_media(primary_image_url)
                if rel_path:
                    # Buscar en las imágenes actuales del producto
                    for img in product.images.all():
                        try:
                            img_path = str(img.image.name)
                            if img_path == rel_path or basename(img_path) == basename(rel_path):
                                primary_target = img
                                break
                        except Exception:
                            continue
            except Exception:
                pass
        
        # Si aún no hay primary_target, tomar la primera imagen (sort_order más bajo)
        if primary_target is None:
            try:
                first = product.images.order_by('sort_order').first()
                if first:
                    primary_target = first
            except Exception:
                pass
        
        # Aplicar la marca de primary y sincronizar con el campo legacy product.image
        if primary_target is not None:
            # Desmarcar todas las demás como no primary
            product.images.exclude(id=primary_target.id).update(is_primary=False)
            # Marcar esta como primary
            primary_target.is_primary = True
            primary_target.save(update_fields=['is_primary'])
            # Sincronizar campo legacy
            try:
                product.image = primary_target.image
                product.save(update_fields=['image'])
            except Exception:
                pass
        else:
            # No hay imágenes, limpiar el campo legacy
            try:
                product.image = None
                product.save(update_fields=['image'])
            except Exception:
                pass

    @action(detail=False, methods=['get'])
    def images_library(self, request):
        limit = request.query_params.get('limit')
        try:
            lim = int(limit) if limit is not None else 200
        except Exception:
            lim = 200
        qs = ProductImage.objects.select_related('product').order_by('-created_at')[:lim]
        data = []
        # Helper to count how many distinct products (excluding library bucket) reference the same file
        def shared_count_for(name: str):
            try:
                return ProductImage.objects.filter(image=name).exclude(product__sku__startswith='__LIB__').values('product_id').distinct().count()
            except Exception:
                return 0
        for img in qs:
            url = img.image.url if img.image else None
            if url and request and not url.startswith('http'):
                try:
                    url = request.build_absolute_uri(url)
                except Exception:
                    pass
            try:
                name = str(img.image.name)
            except Exception:
                name = None
            data.append({
                'id': img.id,
                'url': url,
                'product_id': img.product_id,
                'product_sku': getattr(img.product, 'sku', None),
                'created_at': img.created_at.isoformat() if img.created_at else None,
                'shared_count': shared_count_for(name) if name else 0,
            })
        return Response(data)

    def perform_create(self, serializer):
        instance = serializer.save()
        self._apply_variants_and_images(self.request, instance, is_update=False)

    def perform_update(self, serializer):
        instance = serializer.save()
        self._apply_variants_and_images(self.request, instance, is_update=True)

    @action(detail=True, methods=['get'])
    def images(self, request, pk=None):
        product = self.get_object()
        ser = ProductImageSerializer(product.images.all(), many=True, context={'request': request})
        return Response(ser.data)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def add_images(self, request, pk=None):
        product = self.get_object()
        files = request.FILES.getlist('images')
        created = []
        current_max = product.images.aggregate(models.Max('sort_order')).get('sort_order__max') or 0
        order = current_max + 1
        for f in files:
            img = ProductImage.objects.create(product=product, image=f, sort_order=order)
            order += 1
            created.append(img)
        ser = ProductImageSerializer(created, many=True, context={'request': request})
        return Response(ser.data)

    @action(detail=True, methods=['delete'], url_path='images/(?P<img_id>[^/.]+)')
    def delete_image(self, request, pk=None, img_id=None):
        product = self.get_object()
        try:
            img = product.images.get(id=img_id)
            self._safe_delete_product_image(img)
            return Response({"ok": True})
        except ProductImage.DoesNotExist:
            return Response({"detail": "Imagen no encontrada"}, status=404)

    @action(detail=True, methods=['get'], url_path='sales-by-size')
    def sales_by_size(self, request, pk=None):
        """Devuelve cantidades vendidas por talla/variante para este producto"""
        product = self.get_object()
        from orders.models import OrderItem, Order
        from django.db.models import Sum, Q
        
        # Solo contar ventas confirmadas (no borrador ni canceladas/reembolsadas)
        valid_statuses = ['PENDING_PAYMENT', 'PAID', 'AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED']
        
        sales_data = {}
        
        # Si el producto tiene variantes, contar por variante
        variants = product.variants.all()
        if variants:
            for variant in variants:
                sold = OrderItem.objects.filter(
                    product=product,
                    variant=variant,
                    order__status__in=valid_statuses
                ).aggregate(total=Sum('quantity'))['total'] or 0
                sales_data[variant.size] = sold
        else:
            # Sin variantes, contar ventas totales
            sold = OrderItem.objects.filter(
                product=product,
                order__status__in=valid_statuses
            ).aggregate(total=Sum('quantity'))['total'] or 0
            sales_data['total'] = sold
        
        return Response({'product_id': product.id, 'sales_by_size': sales_data})

    def _safe_delete_product_image(self, img: ProductImage):
        """Delete ProductImage and remove the underlying file only if no other ProductImage references it."""
        try:
            name = str(img.image.name)
        except Exception:
            name = None
        # Delete DB row first
        try:
            img.delete()
        except Exception:
            return
        # If name is valid and no other ProductImage references it, delete the file from storage
        if name:
            try:
                still_used = ProductImage.objects.filter(image=name).exists()
                if not still_used and default_storage.exists(name):
                    default_storage.delete(name)
            except Exception:
                pass

    @action(detail=False, methods=['delete'], url_path='images-library/(?P<img_id>[^/.]+)')
    def delete_from_library(self, request, img_id=None):
        try:
            img = ProductImage.objects.get(id=img_id)
            self._safe_delete_product_image(img)
            return Response({"ok": True})
        except ProductImage.DoesNotExist:
            return Response({"detail": "Imagen no encontrada"}, status=404)

    @action(detail=False, methods=['get'], url_path='images-library/(?P<img_id>[^/.]+)/usage')
    def image_usage(self, request, img_id=None):
        """Return the list of products that reference the same underlying file as the given ProductImage id."""
        try:
            img = ProductImage.objects.select_related('product').get(id=img_id)
        except ProductImage.DoesNotExist:
            return Response({"detail": "Imagen no encontrada"}, status=404)
        try:
            name = str(img.image.name)
        except Exception:
            name = None
        if not name:
            return Response([])
        # Gather distinct products sharing this file (exclude library bucket products)
        prod_ids = (ProductImage.objects
                    .filter(image=name)
                    .exclude(product__sku__startswith='__LIB__')
                    .values_list('product_id', flat=True)
                    .distinct())
        prods = Product.objects.filter(id__in=list(prod_ids)).only('id', 'sku', 'name')
        data = [{
            'id': p.id,
            'sku': p.sku,
            'name': p.name,
        } for p in prods]
        return Response(data)


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('product').all()
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated & RequirePermission.with_perms('inventory.manage')]

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # Update product stock accordingly
        product = instance.product
        qty = instance.quantity or 0
        if instance.movement_type == StockMovement.IN:
            product.stock = (product.stock or 0) + qty
        elif instance.movement_type == StockMovement.OUT:
            product.stock = (product.stock or 0) - qty
        else:  # ADJUST uses quantity as absolute delta
            product.stock = (product.stock or 0) + qty
        product.save(update_fields=['stock'])
