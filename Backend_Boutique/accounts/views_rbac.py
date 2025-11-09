from rest_framework import viewsets, status, permissions, decorators
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Role, AppPermission, user_has_permission, user_roles
from .serializers_rbac import (
    RoleSerializer,
    AppPermissionSerializer,
    AssignUsersToRoleSerializer,
    GrantPermissionsToRoleSerializer,
    GrantPermissionsToUserSerializer,
)

User = get_user_model()


class OwnerRBACPermission(permissions.BasePermission):
    """
    Dueños (user_type='admin') o superusuarios (desarrolladores) pueden gestionar RBAC.
    Los superusuarios tienen acceso total al panel también.
    """
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        # Permitir si es superusuario (desarrollador) o dueño (admin)
        if getattr(user, 'is_superuser', False):
            return True
        return getattr(user, 'user_type', '') == 'admin'


class AppPermissionViewSet(viewsets.ModelViewSet):
    queryset = AppPermission.objects.all().order_by('code')
    serializer_class = AppPermissionSerializer
    permission_classes = [permissions.IsAuthenticated & OwnerRBACPermission]


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all().order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [permissions.IsAuthenticated & OwnerRBACPermission]

    @decorators.action(detail=True, methods=['post'], url_path='assign-users')
    def assign_users(self, request, pk=None):
        role = self.get_object()
        serializer = AssignUsersToRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        users = serializer.validated_data['user_ids']
        for u in users:
            u.roles.add(role)
        return Response({"message": "Usuarios asignados al rol"})

    @decorators.action(detail=True, methods=['post'], url_path='revoke-users')
    def revoke_users(self, request, pk=None):
        role = self.get_object()
        serializer = AssignUsersToRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        users = serializer.validated_data['user_ids']
        for u in users:
            u.roles.remove(role)
        return Response({"message": "Usuarios removidos del rol"})

    @decorators.action(detail=True, methods=['post'], url_path='grant-permissions')
    def grant_permissions(self, request, pk=None):
        role = self.get_object()
        serializer = GrantPermissionsToRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        perms = serializer.validated_data['permission_ids']
        role.permissions.add(*perms)
        return Response({"message": "Permisos asignados al rol"})

    @decorators.action(detail=True, methods=['post'], url_path='revoke-permissions')
    def revoke_permissions(self, request, pk=None):
        role = self.get_object()
        serializer = GrantPermissionsToRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        perms = serializer.validated_data['permission_ids']
        role.permissions.remove(*perms)
        return Response({"message": "Permisos revocados del rol"})


class CurrentUserAuthView(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        # Permisos directos + por rol
        direct = list(user.app_permissions.values_list('code', flat=True))
        via_roles = list(AppPermission.objects.filter(roles__users=user).values_list('code', flat=True))
        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "user_type": getattr(user, 'user_type', None),
                "is_superuser": getattr(user, 'is_superuser', False),
            },
            "roles": user_roles(user),
            "permissions": sorted(set([*direct, *via_roles])),
        })
