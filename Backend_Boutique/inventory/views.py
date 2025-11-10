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

        # 1) Handle removed images (by ids or urls)
        removed_ids = request.data.get('removed_image_ids')
        removed_urls = request.data.get('removed_images')
        # Optional: force permanent deletion of underlying file from library context
        # Accept a list 'force_delete_image_ids' -> will remove ALL ProductImage rows referencing the same file path
        force_delete_ids_raw = request.data.get('force_delete_image_ids')
        import json
        to_remove_ids = []
        to_remove_paths = []
        force_delete_ids = []
        if removed_ids:
            try:
                parsed = removed_ids if isinstance(removed_ids, list) else json.loads(str(removed_ids))
                if isinstance(parsed, list):
                    to_remove_ids = [int(x) for x in parsed if str(x).isdigit()]
            except Exception:
                pass
        if removed_urls:
            try:
                parsed = removed_urls if isinstance(removed_urls, list) else json.loads(str(removed_urls))
                if isinstance(parsed, list):
                    for u in parsed:
                        rel = self._url_to_rel_media(u)
                        if rel:
                            to_remove_paths.append(rel)
            except Exception:
                # accept comma separated string
                try:
                    for u in str(removed_urls).split(','):
                        rel = self._url_to_rel_media(u.strip())
                        if rel:
                            to_remove_paths.append(rel)
                except Exception:
                    pass
        if force_delete_ids_raw:
            try:
                parsed = force_delete_ids_raw if isinstance(force_delete_ids_raw, list) else json.loads(str(force_delete_ids_raw))
                if isinstance(parsed, list):
                    force_delete_ids = [int(x) for x in parsed if str(x).isdigit()]
            except Exception:
                pass

        if to_remove_ids:
            # Detach only: delete ProductImage rows for this product (do not delete physical file)
            for img in list(product.images.filter(id__in=to_remove_ids)):
                try:
                    img.delete()
                except Exception:
                    pass
        if to_remove_paths:
            # Detach only by path/url for this product (do not delete physical file)
            from os.path import basename
            qs = product.images.all()
            for img in list(qs):
                try:
                    name = str(img.image.name)
                    if name in to_remove_paths or basename(name) in [basename(p) for p in to_remove_paths]:
                        try:
                            img.delete()
                        except Exception:
                            pass
                except Exception:
                    continue
        # Force-delete logic: remove all ProductImage rows referencing same underlying file for provided ids
        # This bypasses reuse protection; underlying file will be deleted even if other products referenced it.
        if force_delete_ids:
            from os.path import basename
            for img in list(ProductImage.objects.filter(id__in=force_delete_ids)):
                try:
                    path = str(img.image.name)
                except Exception:
                    path = None
                # Delete every ProductImage referencing this path first
                if path:
                    related_qs = ProductImage.objects.filter(image=path)
                    for rel_img in list(related_qs):
                        try:
                            rel_img.delete()
                        except Exception:
                            pass
                    # Finally delete underlying file if present
                    try:
                        if default_storage.exists(path):
                            default_storage.delete(path)
                    except Exception:
                        pass

        # 2) Ordering and new images via images_order payload
        images_order = request.data.get('images_order')
        primary_image_url = request.data.get('primary_image_url')
        primary_image_id = request.data.get('primary_image_id')
        primary_library_source_id = request.data.get('primary_library_source_id')
        primary_target = None

        files_list = []
        try:
            files_list = list(request.FILES.getlist('images') or [])
        except Exception:
            files_list = []
        # include single 'image' in files map for potential matching
        single_image_file = request.FILES.get('image') if hasattr(request, 'FILES') else None
        files_by_name = {}
        try:
            from os.path import basename
            for f in files_list:
                try:
                    n = getattr(f, 'name', None)
                    if n:
                        files_by_name[basename(n)] = f
                except Exception:
                    continue
            if single_image_file is not None:
                n = getattr(single_image_file, 'name', '')
                if n:
                    files_by_name[basename(n)] = single_image_file
        except Exception:
            pass

        # Build mapping of existing by rel path and by id
        existing = list(product.images.all())
        existing_by_id = {img.id: img for img in existing}
        existing_by_rel = {}
        from os.path import basename
        for img in existing:
            try:
                rel = str(img.image.name)
                existing_by_rel[rel] = img
                existing_by_rel[basename(rel)] = img
            except Exception:
                continue

        library_source_ids_created = {}
        if images_order:
            try:
                ordered = images_order if isinstance(images_order, list) else json.loads(str(images_order))
            except Exception:
                ordered = None
            if isinstance(ordered, list):
                next_order = 1
                used_existing_ids = set()
                used_file_names = set()

                # Helper to resolve existing by url
                def find_existing_by_url(u):
                    rel = self._url_to_rel_media(u)
                    if not rel:
                        return None
                    return existing_by_rel.get(rel) or existing_by_rel.get(basename(rel))

                # Apply order based on the provided combined list
                for entry in ordered:
                    etype = entry.get('type') if isinstance(entry, dict) else None
                    if etype == 'existing':
                        img = None
                        try:
                            iid = entry.get('id')
                            if iid is not None:
                                img = existing_by_id.get(int(iid))
                        except Exception:
                            img = None
                        url = entry.get('url')
                        if img is None and url:
                            img = find_existing_by_url(url)
                        if img and img.id not in used_existing_ids:
                            img.sort_order = next_order
                            img.save(update_fields=['sort_order'])
                            used_existing_ids.add(img.id)
                            # set primary target if matches primary_image_url
                            if primary_image_url and url and str(url) == str(primary_image_url):
                                primary_target = img
                            next_order += 1
                    elif etype == 'new':
                        name = entry.get('name')
                        f = files_by_name.get(name)
                        if f and name not in used_file_names:
                            new_img = ProductImage.objects.create(product=product, image=f, sort_order=next_order)
                            used_file_names.add(name)
                            # If 'image' refers to this filename and primary not set by id/url, mark later
                            if single_image_file is not None and getattr(single_image_file, 'name', '') == name and primary_target is None and not primary_image_id and not primary_image_url:
                                primary_target = new_img
                            next_order += 1
                    elif etype == 'library':
                        source_id = entry.get('source_id')
                        try:
                            sid = int(source_id)
                        except Exception:
                            sid = None
                        if sid:
                            src_img = ProductImage.objects.filter(id=sid).first()
                            if src_img:
                                # Move/reassign the existing ProductImage to this product instead of duplicating
                                try:
                                    src_img.product = product
                                    src_img.sort_order = next_order
                                    src_img.is_primary = False
                                    src_img.save(update_fields=['product', 'sort_order', 'is_primary'])
                                except Exception:
                                    pass
                                library_source_ids_created[sid] = src_img
                                # Mark as used to avoid appending duplicate later
                                used_existing_ids.add(src_img.id)
                                if primary_library_source_id and str(primary_library_source_id) == str(sid) and primary_target is None:
                                    primary_target = src_img
                                next_order += 1

                # Append remaining existing not referenced
                for img in product.images.exclude(id__in=used_existing_ids).order_by('sort_order', '-created_at'):
                    img.sort_order = next_order
                    img.save(update_fields=['sort_order'])
                    next_order += 1

                # Append remaining new files not referenced
                for name, f in files_by_name.items():
                    if name not in used_file_names:
                        ProductImage.objects.create(product=product, image=f, sort_order=next_order)
                        next_order += 1
            else:
                images_order = None  # fallback to default path below

        if not images_order:
            # Fallback: append all new images at the end in received order
            images = request.FILES.getlist('images')
            if images:
                current_max = product.images.aggregate(models.Max('sort_order')).get('sort_order__max') or 0
                order = current_max + 1
                for f in images:
                    ProductImage.objects.create(product=product, image=f, sort_order=order)
                    order += 1

        # 3) Primary image selection
        # Priority: primary_image_id -> primary_image_url -> single 'image' file (if created above) -> lowest sort_order
        if primary_target is None and primary_library_source_id:
            try:
                sid = int(primary_library_source_id)
                created = library_source_ids_created.get(sid)
                if created:
                    primary_target = created
            except Exception:
                pass
        if primary_image_id:
            try:
                img = product.images.get(id=int(primary_image_id))
                primary_target = img
            except Exception:
                pass
        elif primary_image_url and not primary_target:
            try:
                rel = self._url_to_rel_media(primary_image_url)
                if rel:
                    img = existing_by_rel.get(rel) or existing_by_rel.get(basename(rel))
                    if img:
                        primary_target = img
            except Exception:
                pass

        # If we received a single primary file under 'image' but haven't created a ProductImage for it
        if 'image' in request.FILES and primary_target is None:
            # Create a ProductImage for the primary file at the front
            current_min = product.images.aggregate(models.Min('sort_order')).get('sort_order__min') or 1
            new_order = max(1, current_min - 1)
            img = ProductImage.objects.create(product=product, image=request.FILES['image'], sort_order=new_order)
            primary_target = img

        # Apply primary flags and sync legacy product.image
        if primary_target is None:
            # Fallback: choose the image with the lowest sort_order as primary
            try:
                first = product.images.order_by('sort_order', '-created_at').first()
                if first:
                    primary_target = first
            except Exception:
                pass

        if primary_target is not None:
            product.images.exclude(id=primary_target.id).update(is_primary=False)
            primary_target.is_primary = True
            primary_target.save(update_fields=['is_primary'])
            # sync legacy primary field
            try:
                product.image = primary_target.image
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
from django.shortcuts import render

# Create your views here.
