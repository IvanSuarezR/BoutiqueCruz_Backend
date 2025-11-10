from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.utils import timezone
from django.db.models import Q

from orders.models import Order, OrderStatusHistory
from django.contrib.auth import get_user_model
from inventory.models import Product
from .serializers import SalesOrderSerializer


class IsPanelUser(IsAuthenticated):
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        if not base:
            return False
        ut = getattr(request.user, 'user_type', 'customer')
        return ut in ('admin','owner','seller') or getattr(request.user, 'is_staff', False) or getattr(request.user, 'is_superuser', False)


class SalesOrderViewSet(viewsets.ViewSet):
    permission_classes = [IsPanelUser]

    def _qs(self, request):
        qs = Order.objects.select_related('user','payment_method','shipping_method').prefetch_related('items').all()
        # Filters
        status_f = request.query_params.get('status')
        q = request.query_params.get('q')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        user_id = request.query_params.get('user')
        if status_f:
            qs = qs.filter(status=status_f)
        if q:
            # Buscar por id exacto si es número, o por email/username/notes
            if q.isdigit():
                qs = qs.filter(
                    Q(id=int(q)) |
                    Q(user__email__icontains=q) |
                    Q(user__username__icontains=q) |
                    Q(user__first_name__icontains=q) |
                    Q(user__last_name__icontains=q)
                )
            else:
                qs = qs.filter(
                    Q(user__email__icontains=q) |
                    Q(user__username__icontains=q) |
                    Q(user__first_name__icontains=q) |
                    Q(user__last_name__icontains=q) |
                    Q(notes__icontains=q) |
                    Q(customer_note__icontains=q)
                )
        if user_id:
            qs = qs.filter(user_id=user_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs.order_by('-created_at')

    def list(self, request):
        qs = self._qs(request)
        # Paginación simple vía page/page_size si vienen en query; si no, devolver lista plana limitada
        try:
            page = int(request.query_params.get('page') or 0)
            page_size = int(request.query_params.get('page_size') or 0)
        except Exception:
            page, page_size = 0, 0
        if page and page_size:
            total = qs.count()
            start = max(0, (page - 1) * page_size)
            end = start + page_size
            items = list(qs[start:end])
            ser = SalesOrderSerializer(items, many=True, context={'request': request})
            return Response({
                'results': ser.data,
                'count': total,
                'page': page,
                'page_size': page_size,
            })
        else:
            items = qs[:200]
            ser = SalesOrderSerializer(items, many=True, context={'request': request})
            return Response(ser.data)

    def retrieve(self, request, pk=None):
        obj = Order.objects.filter(pk=pk).first()
        if not obj:
            return Response({'detail': 'No encontrado'}, status=404)
        ser = SalesOrderSerializer(obj, context={'request': request})
        return Response(ser.data)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        order = Order.objects.filter(pk=pk).select_related('payment_method','shipping_method').prefetch_related('items__variant','items__product__variants').first()
        if not order:
            return Response({'detail': 'No encontrado'}, status=404)
        new_status = request.data.get('new_status')
        reason = request.data.get('reason') or ''
        allowed = {'AWAITING_DISPATCH','DELIVERED','CANCELED','REFUNDED','PAID'}
        if new_status not in allowed:
            return Response({'detail': 'Estado inválido'}, status=400)

        old_status = order.status
        if old_status == new_status:
            return Response(SalesOrderSerializer(order, context={'request': request}).data)

        # If moving to AWAITING_DISPATCH or PAID and stock not yet deducted, deduct now
        if new_status in ('AWAITING_DISPATCH','PAID') and not order.inventory_deducted:
            for it in order.items.select_related('variant','product').all():
                if it.variant:
                    it.variant.stock = max(0, it.variant.stock - it.quantity)
                    it.variant.save(update_fields=['stock'])
            for prod in Product.objects.filter(id__in=order.items.values_list('product_id', flat=True)).distinct():
                variants = list(prod.variants.all())
                if variants:
                    prod.stock = sum([v.stock for v in variants])
                else:
                    used_qty = sum([it.quantity for it in order.items.filter(product=prod)])
                    prod.stock = max(0, prod.stock - used_qty)
                prod.save(update_fields=['stock'])
            order.inventory_deducted = True

        # Restore stock if cancel/refund and was deducted and not restored yet
        if new_status in ('CANCELED','REFUNDED') and getattr(order, 'inventory_deducted', False) and not getattr(order, 'inventory_restored', False):
            # rebuild variant and product stock adding back quantities
            for it in order.items.select_related('variant','product').all():
                if it.variant:
                    it.variant.stock += it.quantity
                    it.variant.save(update_fields=['stock'])
            for prod in Product.objects.filter(id__in=order.items.values_list('product_id', flat=True)).distinct():
                variants = list(prod.variants.all())
                if variants:
                    prod.stock = sum([v.stock for v in variants])
                else:
                    restored_qty = sum([it.quantity for it in order.items.filter(product=prod)])
                    prod.stock += restored_qty
                prod.save(update_fields=['stock'])
            order.inventory_restored = True

        if new_status == 'PAID' and not order.paid_at:
            order.paid_at = timezone.now()
        if new_status == 'DELIVERED' and not order.paid_at:
            # If admin marks delivered, ensure paid_at is set (use now)
            order.paid_at = timezone.now()

        # Save status history and state
        OrderStatusHistory.objects.create(order=order, old_status=old_status, new_status=new_status, changed_by=request.user, reason=reason)
        order.status = new_status
        order.save(update_fields=['status','inventory_deducted','paid_at','inventory_restored'])
        return Response(SalesOrderSerializer(order, context={'request': request}).data)

    @action(detail=False, methods=['get'], url_path='users')
    def users(self, request):
        User = get_user_model()
        q = request.query_params.get('q')
        include_all = request.query_params.get('all') in ('1','true','True')
        users_qs = User.objects.all() if include_all else User.objects.filter(orders__isnull=False).distinct()
        if q:
            users_qs = users_qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )
        data = [
            {
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'name': f"{u.first_name} {u.last_name}".strip() or u.username
            }
            for u in users_qs.order_by('username')[:200]
        ]
        return Response(data)
