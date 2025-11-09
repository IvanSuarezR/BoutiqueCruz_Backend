from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Role, AppPermission


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Configuración del admin para el modelo CustomUser
    """
    model = CustomUser
    list_display = [
        'username', 'email', 'identification_number', 
        'user_type', 'is_active', 'is_staff', 'created_at'
    ]
    list_filter = ['user_type', 'is_active', 'is_staff', 'gender', 'created_at']
    search_fields = ['username', 'email', 'identification_number', 'first_name', 'last_name']
    ordering = ['-created_at']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Información Adicional', {
            'fields': (
                'identification_number', 'phone', 'gender', 
                'address', 'user_type'
            )
        }),
    )
    
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Información Adicional', {
            'fields': (
                'email', 'first_name', 'last_name',
                'identification_number', 'phone', 'gender', 
                'address', 'user_type', 'roles', 'app_permissions'
            )
        }),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['permissions']


@admin.register(AppPermission)
class AppPermissionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active']
    list_filter = ['is_active']
    search_fields = ['code', 'name', 'description']
