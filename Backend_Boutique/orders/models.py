from django.db import models
from django.conf import settings
from inventory.models import Product, ProductVariant


class Address(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='addresses')
    full_name = models.CharField(max_length=120, blank=True, null=True)
    label = models.CharField(max_length=120, blank=True, null=True, help_text="Nombre para identificar esta ubicación (ej: Casa, Trabajo)")
    phone = models.CharField(max_length=32)
    line1 = models.CharField(max_length=200)
    line2 = models.CharField(max_length=200, blank=True, null=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=2, default='BO')
    # Geolocation fields (optional)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True, help_text="Latitud en formato decimal (-90 a 90)")
    longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True, help_text="Longitud en formato decimal (-180 a 180)")
    place_id = models.CharField(max_length=128, blank=True, null=True, help_text="Google Place ID si se seleccionó desde el mapa")
    formatted_address = models.TextField(blank=True, null=True, help_text="Dirección formateada retornada por la API de mapas")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-updated_at']

    def __str__(self):
        return f"{self.full_name} - {self.city}"


class ShippingMethod(models.Model):
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, null=True)
    base_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transit_days_min = models.IntegerField(default=1)
    transit_days_max = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    supports_cod = models.BooleanField(default=True)
    requires_pickup_point = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class PaymentMethod(models.Model):
    TYPE_CHOICES = [
        ('OFFLINE', 'Offline'),
        ('GATEWAY', 'Gateway'),
        ('COD', 'Contra Entrega'),
    ]
    code = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default='OFFLINE')
    instructions = models.TextField(blank=True, null=True)
    gateway_provider = models.CharField(max_length=64, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    fee_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    fee_fixed = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    supports_refund = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Order(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Borrador'),
        ('PENDING_PAYMENT', 'Pendiente de pago'),
        ('PAID', 'Pagada'),
        ('AWAITING_DISPATCH', 'Lista para enviar'),
        ('SHIPPED', 'Enviada'),
        ('DELIVERED', 'Entregada'),
        ('CANCELED', 'Cancelada'),
        ('REFUNDED', 'Reembolsada'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', db_index=True)
    currency = models.CharField(max_length=3, default='BOB')

    total_items = models.IntegerField(default=0)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shipping_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    shipping_method = models.ForeignKey(ShippingMethod, on_delete=models.SET_NULL, null=True, blank=True)
    payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True)
    shipping_address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, blank=True)

    shipping_address_snapshot = models.JSONField(blank=True, null=True)

    placed_at = models.DateTimeField(blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    canceled_at = models.DateTimeField(blank=True, null=True)

    external_payment_id = models.CharField(max_length=128, blank=True, null=True)
    external_payment_status = models.CharField(max_length=64, blank=True, null=True)

    notes = models.TextField(blank=True, null=True)
    customer_note = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Control de inventario
    inventory_deducted = models.BooleanField(default=False, help_text="Si ya se descontó inventario para esta orden")
    inventory_restored = models.BooleanField(default=False, help_text="Si ya se restauró inventario por cancelación/reembolso")

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Venta'
        verbose_name_plural = 'Ventas'

    def __str__(self):
        return f"Order #{self.pk} - {self.user} - {self.status}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, blank=True, null=True)
    product_name_cache = models.CharField(max_length=200)
    sku_cache = models.CharField(max_length=80)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.IntegerField(default=1)
    line_subtotal = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.sku_cache} x{self.quantity}"


class OrderStatusHistory(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='status_history')
    old_status = models.CharField(max_length=20)
    new_status = models.CharField(max_length=20)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.old_status} -> {self.new_status}"


# --- Cart models ---

class Cart(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart of {self.user}"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True)
    size_label = models.CharField(max_length=16, blank=True, null=True)
    quantity = models.IntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-added_at']
        indexes = [
            models.Index(fields=['cart','product']),
        ]

    def __str__(self):
        return f"{self.product} x{self.quantity}"


class UserPreferences(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='preferences')
    default_address = models.ForeignKey(Address, on_delete=models.SET_NULL, null=True, blank=True)
    default_shipping_method = models.ForeignKey(ShippingMethod, on_delete=models.SET_NULL, null=True, blank=True)
    default_payment_method = models.ForeignKey(PaymentMethod, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences of {self.user}"
