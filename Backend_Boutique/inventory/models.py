from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True, null=True)
    GENDER_CHOICES = [
        ('M', 'Hombre'),
        ('F', 'Mujer'),
        ('U', 'Unisex'),
    ]
    KIND_CHOICES = [
        ('V', 'Vestir'),
        ('Z', 'Calzado'),
    ]
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True, db_index=True)
    kind = models.CharField(max_length=1, choices=KIND_CHOICES, blank=True, null=True, db_index=True)
    sizes = models.JSONField(default=list, blank=True, help_text="Lista de tallas sugeridas para la categoría, ej: ['S','M','L']")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["gender"]),
            models.Index(fields=["kind"]),
        ]

    def __str__(self) -> str:
        return self.name


class Product(models.Model):
    sku = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    gender = models.CharField(
        max_length=1,
        choices=Category.GENDER_CHOICES,
        blank=True,
        null=True,
        help_text="Género del producto (si no se define, se asume el de la categoría)"
    )
    price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    stock = models.IntegerField(default=0)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=32, blank=True, null=True, help_text="Color principal de la prenda (legacy)")
    colors = models.JSONField(default=list, blank=True, help_text="Lista de colores, ej: ['Negro','Azul']")
    sizes = models.JSONField(default=list, blank=True, help_text="Lista de tallas disponibles, ej: ['S','M','L']")
    image = models.ImageField(upload_to='products/%Y/%m/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["name"]), models.Index(fields=["sku"])]

    def __str__(self) -> str:
        return f"{self.sku} - {self.name}"


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='products/%Y/%m/')
    alt_text = models.CharField(max_length=255, blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', '-created_at']

    def __str__(self) -> str:
        return f"Imagen de {self.product.name}"


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    size = models.CharField(max_length=16, db_index=True)
    stock = models.IntegerField(default=0)
    sku = models.CharField(max_length=80, blank=True, null=True, help_text="SKU de la variante (opcional)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("product", "size")
        ordering = ["size"]

    def __str__(self) -> str:
        return f"{self.product.sku}-{self.size} ({self.stock})"

class StockMovement(models.Model):
    IN = 'IN'
    OUT = 'OUT'
    ADJUST = 'ADJ'
    TYPE_CHOICES = [
        (IN, 'Ingreso'),
        (OUT, 'Salida'),
        (ADJUST, 'Ajuste'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='movements')
    movement_type = models.CharField(max_length=3, choices=TYPE_CHOICES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=255, blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"{self.get_movement_type_display()} {self.quantity} {self.product}"


class SiteConfiguration(models.Model):
    """
    Modelo Singleton para configuraciones globales del sitio, como el banner.
    """
    banner_url = models.URLField(max_length=500, blank=True, null=True, help_text="URL del banner principal del sitio")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configuración del Sitio"
        verbose_name_plural = "Configuración del Sitio"

    def save(self, *args, **kwargs):
        # Asegurar que solo exista una instancia
        if not self.pk and SiteConfiguration.objects.exists():
            # Si ya existe uno, actualizar el existente en lugar de crear uno nuevo
            existing = SiteConfiguration.objects.first()
            existing.banner_url = self.banner_url
            return existing.save()
        return super(SiteConfiguration, self).save(*args, **kwargs)

    def __str__(self):
        return "Configuración Global"
