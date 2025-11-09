from rest_framework import status, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import (
    UserSerializer, 
    RegisterSerializer, 
    LoginSerializer,
    ChangePasswordSerializer,
    AdminUserUpdateSerializer,
    AdminSetPasswordSerializer,
)
from .views_rbac import OwnerRBACPermission

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """
    Vista para el registro de nuevos usuarios
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Generar tokens JWT
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'message': 'Usuario registrado exitosamente',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    Vista para el login de usuarios
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']
        
        # Intentar autenticar con username o email
        user = authenticate(username=username, password=password)
        
        if not user:
            # Intentar con email
            try:
                user_obj = User.objects.get(email=username)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass
        
        if user is None:
            return Response(
                {'error': 'Credenciales inválidas'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        if not user.is_active:
            return Response(
                {'error': 'Usuario suspendido. Contacte al administrador.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Generar tokens JWT
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'message': 'Login exitoso',
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Vista para el logout (blacklist del refresh token)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response(
                {'message': 'Logout exitoso'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': 'Token inválido o ya expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(generics.RetrieveUpdateAPIView):
    """
    Vista para obtener y actualizar el perfil del usuario autenticado
    """
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    Vista para cambiar la contraseña del usuario autenticado
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        
        # Verificar contraseña actual
        if not user.check_password(serializer.validated_data['old_password']):
            return Response(
                {'error': 'Contraseña actual incorrecta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Establecer nueva contraseña
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        
        return Response(
            {'message': 'Contraseña actualizada exitosamente'},
            status=status.HTTP_200_OK
        )


class UserListView(generics.ListCreateAPIView):
    """Lista paginada y creación de usuarios.
    GET: lista paginada (page size global).
    POST: crea nuevo usuario (solo admin/owner/superuser) usando RegisterSerializer
    con user_type por defecto (customer) salvo que se especifique.
    Otros tipos solo pueden ver su propio perfil en listado (no crear).
    """
    queryset = User.objects.all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return RegisterSerializer
        return UserSerializer

    def get_queryset(self):
        u = self.request.user
        if getattr(u, 'is_superuser', False) or u.user_type in ['admin', 'owner'] or u.is_staff:
            return self.queryset
        return self.queryset.filter(id=u.id)

    def create(self, request, *args, **kwargs):
        # Restringir creación a admin/owner/superuser
        u = request.user
        if not (getattr(u, 'is_superuser', False) or u.user_type in ['admin', 'owner'] or u.is_staff):
            return Response({'detail': 'No autorizado para crear usuarios.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)


class UserAdminDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated & OwnerRBACPermission]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return AdminUserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        # devolver vista completa del usuario
        return Response(UserSerializer(instance).data)


class AdminSetUserPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated & OwnerRBACPermission]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "Usuario no encontrado"}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminSetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({"message": "Contraseña actualizada"}, status=status.HTTP_200_OK)
