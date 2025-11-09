from rest_framework import serializers
from .models import Role, AppPermission
from django.contrib.auth import get_user_model

User = get_user_model()


class AppPermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppPermission
        fields = ['id', 'code', 'name', 'description', 'actions', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class RoleSerializer(serializers.ModelSerializer):
    permissions = AppPermissionSerializer(many=True, read_only=True)
    permission_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=AppPermission.objects.all(), required=False, source='permissions'
    )

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'is_active', 'permissions', 'permission_ids', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AssignUsersToRoleSerializer(serializers.Serializer):
    user_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all())


class GrantPermissionsToRoleSerializer(serializers.Serializer):
    permission_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=AppPermission.objects.all())


class GrantPermissionsToUserSerializer(serializers.Serializer):
    permission_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=AppPermission.objects.all())
