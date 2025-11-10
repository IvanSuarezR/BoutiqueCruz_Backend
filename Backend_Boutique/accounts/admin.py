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
                'address', 'user_type', 'roles', 'app_permissions'
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

    def save_model(self, request, obj, form, change):
        """Guardar usuario y ajustar user_type si aplica (para cambios directos)."""
        super().save_model(request, obj, form, change)
        try:
            from .models import set_user_type_from_roles
            # En save_model aún no están guardadas las M2M, pero si user_type fue modificado manualmente, respetarlo.
            # Si no, derivar provisionalmente (save_related hará el ajuste final tras M2M).
            prev = obj.user_type
            set_user_type_from_roles(obj)
            if obj.user_type != prev:
                obj.save(update_fields=['user_type'])
        except Exception:
            pass

    def save_related(self, request, form, formsets, change):
        """Tras guardar relaciones M2M (roles/permissions), derivar user_type por prioridad."""
        super().save_related(request, form, formsets, change)
        try:
            user = form.instance
            from .models import set_user_type_from_roles
            before = user.user_type
            set_user_type_from_roles(user)
            if user.user_type != before:
                user.save(update_fields=['user_type'])
        except Exception:
            pass


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
