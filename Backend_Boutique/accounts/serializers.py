from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer para el modelo de usuario completo
    """
    roles = serializers.SerializerMethodField(read_only=True)
    role_ids = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'identification_number', 'phone', 'gender', 'address',
            'user_type', 'is_active', 'created_at', 'updated_at',
            'roles', 'role_ids'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_roles(self, obj):
        # Lista de nombres de roles activos del usuario
        try:
            return list(obj.roles.filter(is_active=True).values_list('name', flat=True))
        except Exception:
            return []

    def get_role_ids(self, obj):
        try:
            return list(obj.roles.filter(is_active=True).values_list('id', flat=True))
        except Exception:
            return []


class RegisterSerializer(serializers.ModelSerializer):
    """
    Serializer para el registro de nuevos usuarios
    """
    password = serializers.CharField(
        write_only=True, 
        required=True, 
        validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password2',
            'first_name', 'last_name', 'identification_number',
            'phone', 'gender', 'address', 'user_type'
        ]
        extra_kwargs = {
            # Hacemos opcionales nombre, apellido y cédula para permitir registro corto
            'first_name': {'required': False, 'allow_blank': True, 'default': ''},
            'last_name': {'required': False, 'allow_blank': True, 'default': ''},
            'email': {'required': True},
            'identification_number': {'required': False, 'allow_blank': True},
            'phone': {'required': False, 'allow_blank': True},
            'gender': {'required': False, 'allow_blank': True},
            'address': {'required': False, 'allow_blank': True},
            'user_type': {'required': False},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError(
                {"password": "Las contraseñas no coinciden."}
            )
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este correo electrónico ya está registrado.")
        return value
    
    def validate_identification_number(self, value):
        # Validamos sólo si viene provisto; si no, se generará automáticamente en create
        if value and User.objects.filter(identification_number=value).exists():
            raise serializers.ValidationError("Este número de identificación ya está registrado.")
        return value
    
    def create(self, validated_data):
        from uuid import uuid4
        from .models import Role, set_user_type_from_roles

        # Retiramos campos de solo escritura
        validated_data.pop('password2')
        password = validated_data.pop('password')
        # Forzar que no se asigne user_type arbitrario desde el registro
        validated_data.pop('user_type', None)

        # Defaults para nombre y apellido si no se enviaron
        validated_data['first_name'] = (validated_data.get('first_name') or '').strip()
        validated_data['last_name'] = (validated_data.get('last_name') or '').strip()

        # Generamos identificación si no fue provista
        idn = (validated_data.get('identification_number') or '').strip()
        if not idn:
            # Intentamos generar un identificador único y corto
            for _ in range(5):
                candidate = uuid4().hex[:12].upper()
                if not User.objects.filter(identification_number=candidate).exists():
                    idn = candidate
                    break
            if not idn:
                idn = uuid4().hex.upper()
            validated_data['identification_number'] = idn

        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()
        # Asignar rol "Cliente" por defecto
        try:
            role = Role.objects.filter(name__iexact='Cliente').first()
            if not role:
                role = Role.objects.create(name='Cliente', description='Rol por defecto para clientes', is_active=True)
            user.roles.add(role)
        except Exception:
            pass
        # Derivar y guardar user_type desde roles (admin>owner>seller>supplier>customer)
        try:
            set_user_type_from_roles(user)
            user.save(update_fields=['user_type'])
        except Exception:
            pass
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializer para el login de usuarios
    """
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    """
    Serializer para cambio de contraseña
    """
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True, 
        write_only=True, 
        validators=[validate_password]
    )
    new_password2 = serializers.CharField(required=True, write_only=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError(
                {"new_password": "Las contraseñas no coinciden."}
            )
        return attrs


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Serializer de actualización de usuario para administradores/owners.
    No permite modificar user_type (derivado por roles) ni roles aquí.
    Valida unicidad de email e identificación.
    """
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'identification_number', 'phone', 'gender', 'address',
            'is_active'
        ]

    def validate_email(self, value):
        if not value:
            return value
        qs = User.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Este correo electrónico ya está registrado.")
        return value

    def validate_identification_number(self, value):
        if not value:
            return value
        qs = User.objects.filter(identification_number=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Este número de identificación ya está registrado.")
        return value


class AdminSetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Las contraseñas no coinciden."})
        return attrs
