from rest_framework import serializers
from decimal import Decimal
from inventory.models import Product, ProductVariant
from .models import Address, ShippingMethod, PaymentMethod, Order, OrderItem, Cart, CartItem, UserPreferences


class AddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = Address
        fields = ['id','label','full_name','phone','line1','line2','city','state','postal_code','country','latitude','longitude','place_id','formatted_address','is_default','created_at','updated_at']
        read_only_fields = ['id','created_at','updated_at']


class ShippingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingMethod
        fields = ['id','code','name','description','base_cost','transit_days_min','transit_days_max','is_active','supports_cod','requires_pickup_point']
        read_only_fields = ['id']


class PaymentMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentMethod
        fields = ['id','code','name','type','instructions','gateway_provider','is_active','fee_percent','fee_fixed','supports_refund']
        read_only_fields = ['id']


class OrderItemInputSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    size_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField(read_only=True)
    shipping_method_name = serializers.CharField(source='shipping_method.name', read_only=True)
    payment_method_name = serializers.CharField(source='payment_method.name', read_only=True)
    status_label = serializers.SerializerMethodField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_first_name = serializers.CharField(source='user.first_name', read_only=True)
    user_last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id','status','currency','total_items','subtotal','shipping_cost','payment_fee','tax_total','grand_total',
            'shipping_method','shipping_method_name','payment_method','payment_method_name','shipping_address','shipping_address_snapshot',
            'placed_at','paid_at','canceled_at','external_payment_id','external_payment_status','notes','customer_note','created_at','updated_at',
            'items','status_label','inventory_deducted','inventory_restored',
            'user_username','user_email','user_first_name','user_last_name'
        ]
        read_only_fields = ['id','status','total_items','subtotal','shipping_cost','payment_fee','tax_total','grand_total','placed_at','paid_at','canceled_at','external_payment_id','external_payment_status','created_at','updated_at','items']

    def get_items(self, obj):
        results = []
        for it in obj.items.select_related('variant','product').all():
            results.append({
                'id': it.id,
                'product_id': it.product_id,
                'variant_id': it.variant_id,
                'variant_size': (it.variant.size if it.variant else None),
                'sku': it.sku_cache,
                'name': it.product_name_cache,
                'unit_price': it.unit_price,
                'quantity': it.quantity,
                'line_subtotal': it.line_subtotal,
            })
        return results

    def get_status_label(self, obj):
        mapping = {
            'DRAFT': 'Borrador',
            'PENDING_PAYMENT': 'Pendiente de pago',
            'PAID': 'Pagado',
            'AWAITING_DISPATCH': 'En preparación',
            'SHIPPED': 'Enviada',
            'CANCELED': 'Cancelado',
            'DELIVERED': 'Entregado',
            'REFUNDED': 'Reembolsado',
        }
        return mapping.get(getattr(obj, 'status', None), getattr(obj, 'status', ''))


class StartOrderSerializer(serializers.Serializer):
    items = OrderItemInputSerializer(many=True)

    def validate(self, attrs):
        # quick sanity: verify products exist
        items = attrs.get('items') or []
        if not items:
            raise serializers.ValidationError('El carrito está vacío')
        return attrs


class SetAddressSerializer(serializers.Serializer):
    address_id = serializers.IntegerField()


class SetShippingSerializer(serializers.Serializer):
    shipping_method_id = serializers.IntegerField()


class SetPaymentSerializer(serializers.Serializer):
    payment_method_id = serializers.IntegerField()


class ConfirmOrderSerializer(serializers.Serializer):
    confirm = serializers.BooleanField()
    # For gateway payments like Stripe, the client can provide the PaymentIntent id
    payment_intent_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    # Or, when using Stripe Checkout, the Checkout Session id
    checkout_session_id = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class CartItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_price = serializers.DecimalField(source='product.price', max_digits=12, decimal_places=2, read_only=True)
    variant_size = serializers.CharField(source='variant.size', read_only=True)
    availability = serializers.SerializerMethodField(read_only=True)
    product_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CartItem
        fields = ['id','product','product_name','product_price','variant','variant_size','size_label','quantity','availability','product_image_url']
        read_only_fields = ['id']

    def get_availability(self, obj):
        # Determine stock availability
        available = 0
        if obj.variant:
            available = obj.variant.stock
        else:
            available = obj.product.stock
        status = 'ok'
        if available <= 0:
            status = 'out'
        elif available < obj.quantity:
            status = 'partial'
        return {
            'status': status,
            'available': available,
            'requested': obj.quantity,
            'can_purchase': available >= obj.quantity
        }

    def get_product_image_url(self, obj):
        url = None
        try:
            if obj.product.image:
                url = obj.product.image.url
            else:
                primary = obj.product.images.filter(is_primary=True).first()
                if primary and primary.image:
                    url = primary.image.url
                else:
                    first = obj.product.images.order_by('sort_order', '-created_at').first()
                    if first and first.image:
                        url = first.image.url
        except Exception:
            url = None
        request = self.context.get('request') if hasattr(self, 'context') else None
        if url and request:
            try:
                return request.build_absolute_uri(url)
            except Exception:
                return url
        return url


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)

    class Meta:
        model = Cart
        fields = ['id','user','items','created_at','updated_at']
        read_only_fields = ['id','user','created_at','updated_at','items']


class CartAddItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    variant_id = serializers.IntegerField(required=False, allow_null=True)
    size_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    quantity = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        pid = attrs.get('product_id')
        vid = attrs.get('variant_id')
        from inventory.models import Product, ProductVariant
        product = Product.objects.filter(id=pid, is_active=True).first()
        if not product:
            raise serializers.ValidationError('Producto inválido')
        variant = None
        if vid:
            variant = ProductVariant.objects.filter(id=vid, product=product).first()
            if not variant:
                raise serializers.ValidationError('Variante inválida')
        attrs['product'] = product
        attrs['variant'] = variant
        return attrs


class CartMergeSerializer(serializers.Serializer):
    items = CartAddItemSerializer(many=True)


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ['default_address','default_shipping_method','default_payment_method']
        read_only_fields = []
