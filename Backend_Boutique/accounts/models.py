from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """
    Modelo de usuario personalizado que extiende el modelo AbstractUser de Django.
    Incluye campos adicionales para la gestión de la boutique.
    """
    GENDER_CHOICES = [
        ('M', 'Masculino'),
        ('F', 'Femenino'),
        ('O', 'Otro'),
    ]
    
    USER_TYPE_CHOICES = [
        ('admin', 'Administrador'),
        ('seller', 'Vendedor'),
        ('customer', 'Cliente'),
        ('supplier', 'Proveedor'),
    ]
    
    # Campos adicionales
    identification_number = models.CharField(
        max_length=50, 
        unique=True, 
        verbose_name='Número de Identificación'
    )
    phone = models.CharField(
        max_length=20, 
        blank=True, 
        null=True, 
        verbose_name='Teléfono'
    )
    gender = models.CharField(
        max_length=1, 
        choices=GENDER_CHOICES, 
        blank=True, 
        null=True, 
        verbose_name='Sexo'
    )
    address = models.TextField(
        blank=True, 
        null=True, 
        verbose_name='Domicilio'
    )
    user_type = models.CharField(
        max_length=20,
        choices=USER_TYPE_CHOICES,
        default='customer',
        verbose_name='Tipo de Usuario'
    )
    is_active = models.BooleanField(
        default=True, 
        verbose_name='Estado Activo'
    )
    created_at = models.DateTimeField(
        auto_now_add=True, 
        verbose_name='Fecha de Creación'
    )
    updated_at = models.DateTimeField(
        auto_now=True, 
        verbose_name='Última Actualización'
    )
    
    class Meta:
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.username} - {self.get_full_name()}"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username


class AppPermission(models.Model):
    """
    Permiso de la aplicación (no confundir con auth.Permission de Django).
    Se identifica por un código único (ej: users.view, sales.create).
    """
    code = models.CharField(max_length=100, unique=True, verbose_name='Código')
    name = models.CharField(max_length=150, verbose_name='Nombre')
    description = models.TextField(blank=True, null=True, verbose_name='Descripción')
    actions = models.JSONField(default=list, blank=True, verbose_name='Acciones permitidas')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Permiso'
        verbose_name_plural = 'Permisos'
        ordering = ['code']

    def __str__(self) -> str:
        return f"{self.code}"


class Role(models.Model):
    """
    Rol de usuario con un conjunto de permisos asignados.
    """
    name = models.CharField(max_length=100, unique=True, verbose_name='Nombre del Rol')
    description = models.TextField(blank=True, null=True, verbose_name='Descripción')
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(AppPermission, blank=True, related_name='roles')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Rol'
        verbose_name_plural = 'Roles'
        ordering = ['name']

    def __str__(self) -> str:
        return self.name


# Relaciones del usuario con roles y permisos de app
CustomUser.add_to_class('roles', models.ManyToManyField(Role, blank=True, related_name='users'))
CustomUser.add_to_class('app_permissions', models.ManyToManyField(AppPermission, blank=True, related_name='users'))


def user_has_permission(user: 'CustomUser', code: str) -> bool:
    """Verifica si el usuario posee el permiso por asignación directa o vía rol."""
    if not user.is_authenticated:
        return False
    # Superuser o staff siempre permitido para simplificar (puedes ajustar)
    if getattr(user, 'is_superuser', False):
        return True
    # Directos
    if user.app_permissions.filter(code=code, is_active=True).exists():
        return True
    # Por roles
    return AppPermission.objects.filter(roles__users=user, code=code, is_active=True).exists()


def user_roles(user: 'CustomUser'):
    return list(user.roles.filter(is_active=True).values_list('name', flat=True))
