from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from decimal import Decimal
from django.db import transaction

from .models import Address, ShippingMethod, PaymentMethod, Order, OrderItem, OrderStatusHistory, Cart, CartItem, UserPreferences
from django.conf import settings
import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY or None
from .serializers import (
    AddressSerializer, ShippingMethodSerializer, PaymentMethodSerializer, OrderSerializer,
    StartOrderSerializer, SetAddressSerializer, SetShippingSerializer, SetPaymentSerializer, ConfirmOrderSerializer,
    CartSerializer, CartItemSerializer, CartAddItemSerializer, CartMergeSerializer, PreferencesSerializer
)
from inventory.models import Product, ProductVariant


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    def get_queryset(self):
        return Address.objects.filter(user=self.request.user).order_by('-is_default','-updated_at')

    def perform_create(self, serializer):
        addr = serializer.save(user=self.request.user)
        if addr.is_default:
            Address.objects.filter(user=self.request.user).exclude(id=addr.id).update(is_default=False)

    def perform_update(self, serializer):
        addr = serializer.save()
        if addr.is_default:
            Address.objects.filter(user=self.request.user).exclude(id=addr.id).update(is_default=False)

class ShippingMethodViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ShippingMethodSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return ShippingMethod.objects.filter(is_active=True).order_by('name')

class PaymentMethodViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentMethodSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        return PaymentMethod.objects.filter(is_active=True).order_by('name')

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Panel users (admin/owner/seller/staff) pueden ver todas las órdenes
        user = self.request.user
        ut = getattr(user, 'user_type', 'customer')
        if ut in ('admin','owner','seller') or getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False):
            return Order.objects.all().order_by('-created_at')
        return Order.objects.filter(user=user).order_by('-created_at')

    def perform_create(self, serializer):
        raise NotImplementedError('Use /orders/start para iniciar una orden')

    @action(detail=False, methods=['post'])
    def start(self, request):
        ser = StartOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        with transaction.atomic():
            order = Order.objects.create(user=request.user, status='DRAFT')
            items_data = data['items']
            for item in items_data:
                product = Product.objects.filter(id=item['product_id'], is_active=True).first()
                if not product:
                    transaction.set_rollback(True)
                    return Response({'detail': f"Producto {item['product_id']} no encontrado"}, status=400)
                variant = None
                vid = item.get('variant_id')
                size_label = item.get('size_label')
                if vid:
                    variant = ProductVariant.objects.filter(id=vid, product=product).first()
                    if not variant:
                        transaction.set_rollback(True)
                        return Response({'detail': f"Variante {vid} inválida"}, status=400)
                elif size_label:
                    variant = ProductVariant.objects.filter(product=product, size=size_label).first()
                    # No error si no existe: queda sin variante y se tratará como producto base
                quantity = item['quantity']
                unit_price = product.price
                line_subtotal = unit_price * quantity
                sku_cache = variant.sku if variant and variant.sku else (f"{product.sku}-{variant.size}" if variant else product.sku)
                size_cache = variant.size if variant else (size_label if size_label else None)
                OrderItem.objects.create(
                    order=order,
                    product=product,
                    variant=variant,
                    product_name_cache=product.name,
                    sku_cache=sku_cache,
                    size_cache=size_cache,
                    unit_price=unit_price,
                    quantity=quantity,
                    line_subtotal=line_subtotal,
                )
            self._recalculate_totals(order)
            return Response(OrderSerializer(order, context={'request':request}).data, status=201)

    def _recalculate_totals(self, order: Order):
        subtotal = sum([it.line_subtotal for it in order.items.all()])
        order.subtotal = subtotal
        order.shipping_cost = order.shipping_method.base_cost if order.shipping_method else Decimal('0')
        if order.payment_method:
            p = order.payment_method
            fee = (subtotal * (p.fee_percent / Decimal('100'))) + p.fee_fixed
        else:
            fee = Decimal('0')
        order.payment_fee = fee
        order.tax_total = Decimal('0')
        order.grand_total = subtotal + order.shipping_cost + order.payment_fee + order.tax_total
        order.total_items = sum([it.quantity for it in order.items.all()])
        order.save(update_fields=['subtotal','shipping_cost','payment_fee','tax_total','grand_total','total_items'])

    def _add_status_history(self, order: Order, new_status: str, reason: str = None):
        OrderStatusHistory.objects.create(order=order, old_status=order.status, new_status=new_status, changed_by=self.request.user, reason=reason or '')
        order.status = new_status
        order.save(update_fields=['status'])

    @action(detail=True, methods=['patch'])
    def set_address(self, request, pk=None):
        order = self.get_object()
        ser = SetAddressSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        addr_id = ser.validated_data['address_id']
        addr = Address.objects.filter(id=addr_id, user=request.user).first()
        if not addr:
            return Response({'detail':'Dirección inválida'}, status=400)
        order.shipping_address = addr
        # snapshot
        order.shipping_address_snapshot = {
            'full_name': addr.full_name,
            'phone': addr.phone,
            'line1': addr.line1,
            'line2': addr.line2,
            'city': addr.city,
            'state': addr.state,
            'postal_code': addr.postal_code,
            'country': addr.country,
        }
        order.save(update_fields=['shipping_address','shipping_address_snapshot'])
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=True, methods=['patch'])
    def set_shipping_method(self, request, pk=None):
        order = self.get_object()
        ser = SetShippingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        sm_id = ser.validated_data['shipping_method_id']
        sm = ShippingMethod.objects.filter(id=sm_id, is_active=True).first()
        if not sm:
            return Response({'detail':'Método de envío inválido'}, status=400)
        order.shipping_method = sm
        order.save(update_fields=['shipping_method'])
        self._recalculate_totals(order)
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=True, methods=['patch'])
    def set_payment_method(self, request, pk=None):
        order = self.get_object()
        ser = SetPaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        pm_id = ser.validated_data['payment_method_id']
        pm = PaymentMethod.objects.filter(id=pm_id, is_active=True).first()
        if not pm:
            return Response({'detail':'Método de pago inválido'}, status=400)
        order.payment_method = pm
        order.save(update_fields=['payment_method'])
        self._recalculate_totals(order)
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        order = self.get_object()
        ser = ConfirmOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if order.status != 'DRAFT':
            return Response({'detail':'La orden no está en borrador'}, status=400)
        if not order.shipping_method or not order.payment_method:
            return Response({'detail':'Falta envío o pago'}, status=400)
        # If shipping is delivery (not pickup), require address
        if order.shipping_method and not order.shipping_method.requires_pickup_point:
            if not order.shipping_address:
                return Response({'detail':'Falta dirección para entrega a domicilio'}, status=400)

        # Determine final status first (Stripe intent, COD, offline)
        ptype = order.payment_method.type if order.payment_method else 'OFFLINE'
        payment_intent_id = ser.validated_data.get('payment_intent_id')
        checkout_session_id = ser.validated_data.get('checkout_session_id')

        new_status = 'PENDING_PAYMENT'
        if ptype == 'GATEWAY':
            if stripe.api_key and (payment_intent_id or checkout_session_id):
                try:
                    if checkout_session_id:
                        session = stripe.checkout.Session.retrieve(checkout_session_id, expand=['payment_intent'])
                        intent = session.payment_intent
                    else:
                        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
                    order.external_payment_id = intent.id
                    order.external_payment_status = intent.status
                    if intent.status == 'succeeded':
                        order.paid_at = timezone.now()
                        new_status = 'PAID'
                    order.save(update_fields=['external_payment_id','external_payment_status','paid_at'])
                except Exception as ex:
                    order.external_payment_status = f"error:{ex.__class__.__name__}"
                    order.save(update_fields=['external_payment_status'])
        elif ptype in ('COD','OFFLINE'):
            # Pago pendiente (se confirmará manualmente vía transición a PAID)
            new_status = 'PENDING_PAYMENT'
        else:
            new_status = 'PENDING_PAYMENT'

        # Validate stock before placing the order
        insufficient = []
        for it in order.items.all():
            if it.variant:
                if it.variant.stock < it.quantity:
                    insufficient.append({'sku': it.sku_cache, 'requested': it.quantity, 'available': it.variant.stock})
            else:
                if it.product.stock < it.quantity:
                    insufficient.append({'sku': it.sku_cache, 'requested': it.quantity, 'available': it.product.stock})
        if insufficient:
            return Response({'detail':'Stock insuficiente', 'errors': insufficient}, status=400)

        # Descontar stock cuando la orden queda comprometida (pendiente de pago, pagada o en preparación)
        # Incluimos PENDING_PAYMENT para reservar inventario apenas se confirma el borrador con métodos válidos.
        if new_status in ('PENDING_PAYMENT','PAID','AWAITING_DISPATCH') and not getattr(order, 'inventory_deducted', False):
            for it in order.items.select_related('variant','product').all():
                if it.variant:
                    it.variant.stock = max(0, it.variant.stock - it.quantity)
                    it.variant.save(update_fields=['stock'])
            # Recalcular stock del producto (si no tiene variantes se descuenta directo)
            for prod in Product.objects.filter(id__in=order.items.values_list('product_id', flat=True)).distinct():
                variants = list(prod.variants.all())
                if variants:
                    prod.stock = sum([v.stock for v in variants])
                else:
                    used_qty = sum([it.quantity for it in order.items.filter(product=prod)])
                    prod.stock = max(0, prod.stock - used_qty)
                prod.save(update_fields=['stock'])
            order.inventory_deducted = True
            order.save(update_fields=['inventory_deducted'])

        # Mark placed and add history
        order.placed_at = timezone.now()
        self._add_status_history(order, new_status)
        order.save(update_fields=['placed_at'])
        self._recalculate_totals(order)
        # Clear user's cart after successful order placement (best-effort)
        try:
            cart = Cart.objects.filter(user=request.user).first()
            if cart:
                cart.items.all().delete()
        except Exception:
            pass
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=True, methods=['post'])
    def create_intent(self, request, pk=None):
        """Create a Stripe PaymentIntent for this draft order if gateway payment selected."""
        order = self.get_object()
        if order.status != 'DRAFT':
            return Response({'detail':'Orden no está en borrador'}, status=400)
        if not order.payment_method or order.payment_method.type != 'GATEWAY' or order.payment_method.code != 'STRIPE':
            return Response({'detail':'Método de pago no es Stripe'}, status=400)
        if not stripe.api_key:
            return Response({'detail':'Stripe no configurado'}, status=500)
        # Recalculate to ensure totals up to date
        self._recalculate_totals(order)
        # Amount in cents (assumes STRIPE_CURRENCY is zero-decimal? usd -> cents)
        currency = (settings.STRIPE_CURRENCY or 'usd').lower()
        try:
            amount_decimal = order.grand_total
            # Convert Decimal to integer minor units
            # For currencies with cents (like usd) multiply by 100
            multiplier = 100
            amount = int(amount_decimal * multiplier)
            # Explicitly restrict to card to avoid showing Link or other automatic payment methods.
            intent = stripe.PaymentIntent.create(
                amount=amount,
                currency=currency,
                payment_method_types=['card'],
                metadata={'order_id': order.id, 'user_id': order.user_id},
            )
            order.external_payment_id = intent.id
            order.external_payment_status = intent.status
            order.save(update_fields=['external_payment_id','external_payment_status'])
            return Response({'client_secret': intent.client_secret, 'payment_intent_id': intent.id})
        except Exception as ex:
            return Response({'detail': 'Error creando intent', 'error': str(ex)}, status=500)

    @action(detail=True, methods=['post'])
    def create_checkout_session(self, request, pk=None):
        """Create a Stripe Checkout Session (hosted) and return its URL for redirect."""
        order = self.get_object()
        if order.status != 'DRAFT':
            return Response({'detail': 'Orden no está en borrador'}, status=400)
        if not order.payment_method or order.payment_method.type != 'GATEWAY' or order.payment_method.code != 'STRIPE':
            return Response({'detail': 'Método de pago no es Stripe'}, status=400)
        if not stripe.api_key:
            return Response({'detail': 'Stripe no configurado'}, status=500)

        # Ensure totals
        self._recalculate_totals(order)

        currency = (settings.STRIPE_CURRENCY or 'usd').lower()
        multiplier = 100

        line_items = []
        for it in order.items.all():
            try:
                unit_amount = int(it.unit_price * multiplier)
            except Exception:
                unit_amount = 0
            if unit_amount < 0:
                unit_amount = 0
            line_items.append({
                'quantity': it.quantity,
                'price_data': {
                    'currency': currency,
                    'unit_amount': unit_amount,
                    'product_data': {
                        'name': it.product_name_cache or f"Producto {it.product_id}",
                    }
                }
            })

        if order.shipping_cost and order.shipping_cost > 0:
            line_items.append({
                'quantity': 1,
                'price_data': {
                    'currency': currency,
                    'unit_amount': int(order.shipping_cost * multiplier),
                    'product_data': { 'name': 'Envío' }
                }
            })
        if order.payment_fee and order.payment_fee > 0:
            line_items.append({
                'quantity': 1,
                'price_data': {
                    'currency': currency,
                    'unit_amount': int(order.payment_fee * multiplier),
                    'product_data': { 'name': 'Comisión de pago' }
                }
            })

        origin = request.data.get('return_url') or request.META.get('HTTP_ORIGIN')
        if not origin:
            origin = 'http://localhost:5173/checkout'
        success_url = f"{origin}?order_id={order.id}&success=1&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin}?order_id={order.id}&canceled=1"

        try:
            session = stripe.checkout.Session.create(
                mode='payment',
                payment_method_types=['card'],
                line_items=line_items,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata={'order_id': order.id, 'user_id': order.user_id},
            )
            order.external_payment_id = session.id
            order.external_payment_status = session.status
            order.save(update_fields=['external_payment_id','external_payment_status'])
            return Response({'id': session.id, 'url': session.url})
        except Exception as ex:
            return Response({'detail': 'Error creando checkout', 'error': str(ex)}, status=500)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in ('CANCELED','DELIVERED','REFUNDED'):
            return Response({'detail':'No se puede cancelar este estado'}, status=400)
        
        # Restaurar inventario si ya se había descontado
        if order.inventory_deducted and not order.inventory_restored:
            for it in order.items.select_related('variant','product').all():
                if it.variant:
                    it.variant.stock += it.quantity
                    it.variant.save(update_fields=['stock'])
            # Recalcular stock del producto
            for prod in Product.objects.filter(id__in=order.items.values_list('product_id', flat=True)).distinct():
                variants = list(prod.variants.all())
                if variants:
                    prod.stock = sum([v.stock for v in variants])
                else:
                    # Si no tiene variantes, restaurar directamente
                    used_qty = sum([it.quantity for it in order.items.filter(product=prod)])
                    prod.stock += used_qty
                prod.save(update_fields=['stock'])
            order.inventory_restored = True
        
        order.status = 'CANCELED'
        order.canceled_at = timezone.now()
        self._add_status_history(order, 'CANCELED')
        order.save(update_fields=['status', 'canceled_at', 'inventory_restored'])
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=True, methods=['patch'], url_path='set_customer')
    def set_customer(self, request, pk=None):
        """Permite asignar un usuario diferente a la orden (solo si está en DRAFT/PENDING_PAYMENT/AWAITING_DISPATCH)."""
        order = self.get_object()
        if order.status not in ('DRAFT','PENDING_PAYMENT','PAID','AWAITING_DISPATCH'):
            return Response({'detail':'No se puede reasignar cliente en este estado'}, status=400)
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail':'user_id requerido'}, status=400)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        new_user = User.objects.filter(id=user_id).first()
        if not new_user:
            return Response({'detail':'Usuario no encontrado'}, status=404)
        order.user = new_user
        order.save(update_fields=['user'])
        return Response(OrderSerializer(order, context={'request':request}).data)

    @action(detail=False, methods=['get'], url_path='draft-latest')
    def draft_latest(self, request):
        draft = Order.objects.filter(user=request.user, status='DRAFT').order_by('-created_at').first()
        if not draft:
            return Response({}, status=204)
        return Response(OrderSerializer(draft, context={'request': request}).data)


class CartViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_or_create_cart(self, user):
        cart, _ = Cart.objects.get_or_create(user=user)
        return cart

    def list(self, request):
        cart = self._get_or_create_cart(request.user)
        ser = CartSerializer(cart, context={'request': request})
        return Response(ser.data)

    def create(self, request):
        # Add item
        ser = CartAddItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = self._get_or_create_cart(request.user)
        product = ser.validated_data['product']
        variant = ser.validated_data.get('variant')
        size_label = ser.validated_data.get('size_label')
        qty = ser.validated_data['quantity']
        # Merge by product+variant+size
        item = CartItem.objects.filter(cart=cart, product=product, variant=variant, size_label=size_label).first()
        if item:
            item.quantity += qty
            item.save(update_fields=['quantity'])
        else:
            item = CartItem.objects.create(cart=cart, product=product, variant=variant, size_label=size_label, quantity=qty)
        return Response(CartItemSerializer(item, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        cart = self._get_or_create_cart(request.user)
        item = CartItem.objects.filter(cart=cart, id=pk).first()
        if not item:
            return Response({'detail': 'Item no encontrado'}, status=404)
        qty = request.data.get('quantity')
        try:
            qty = int(qty)
        except Exception:
            return Response({'detail':'Cantidad inválida'}, status=400)
        if qty <= 0:
            item.delete()
            return Response(status=204)
        item.quantity = qty
        item.save(update_fields=['quantity'])
        return Response(CartItemSerializer(item, context={'request': request}).data)

    def destroy(self, request, pk=None):
        cart = self._get_or_create_cart(request.user)
        item = CartItem.objects.filter(cart=cart, id=pk).first()
        if not item:
            return Response({'detail': 'Item no encontrado'}, status=404)
        item.delete()
        return Response(status=204)

    @action(detail=False, methods=['post'])
    def merge(self, request):
        ser = CartMergeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cart = self._get_or_create_cart(request.user)
        merged = []
        for it in ser.validated_data['items']:
            product = it['product']
            variant = it.get('variant')
            # Try to infer variant by size_label if not provided
            size_label = it.get('size_label')
            if not variant and size_label:
                variant = ProductVariant.objects.filter(product=product, size=size_label).first()
            qty = it['quantity']
            item = CartItem.objects.filter(cart=cart, product=product, variant=variant, size_label=size_label).first()
            if item:
                item.quantity += qty
                item.save(update_fields=['quantity'])
            else:
                item = CartItem.objects.create(cart=cart, product=product, variant=variant, size_label=size_label, quantity=qty)
            merged.append(item)
        return Response({'ok': True, 'count': len(merged)})


class PreferencesViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def retrieve(self, request, pk=None):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        ser = PreferencesSerializer(prefs)
        return Response(ser.data)

    def update(self, request, pk=None):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        ser = PreferencesSerializer(instance=prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    @action(detail=False, methods=['get','patch'])
    def mine(self, request):
        prefs, _ = UserPreferences.objects.get_or_create(user=request.user)
        if request.method == 'GET':
            ser = PreferencesSerializer(prefs)
            return Response(ser.data)
        # PATCH
        ser = PreferencesSerializer(instance=prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
