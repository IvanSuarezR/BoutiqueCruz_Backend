from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import user_has_permission


class RequirePermission(BasePermission):
    """
    Permiso DRF que exige uno o varios códigos de permiso.
    Uso: permission_classes = [RequirePermission.with_perms('users.view')]
    """
    required_perms: tuple[str, ...] = ()

    def has_permission(self, request, view):
        if not self.required_perms:
            return True
        user = request.user
        for code in self.required_perms:
            if user_has_permission(user, code):
                return True
        return False

    @classmethod
    def with_perms(cls, *perms: str):
        class _RequirePermission(cls):
            required_perms = tuple(perms)
        return _RequirePermission


class ReadOnlyOrPermission(RequirePermission):
    """Permite lectura a todos, escritura solo si cumple permiso."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().has_permission(request, view)
