from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    UserProfileView,
    ChangePasswordView,
    UserListView,
    UserAdminDetailView,
    AdminSetUserPasswordView,
)
from .views_rbac import RoleViewSet, AppPermissionViewSet, CurrentUserAuthView

app_name = 'accounts'

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='role')
router.register(r'permissions', AppPermissionViewSet, basename='app-permission')
router.register(r'me', CurrentUserAuthView, basename='current-auth')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserAdminDetailView.as_view(), name='user-detail'),
    path('users/<int:pk>/set-password/', AdminSetUserPasswordView.as_view(), name='user-set-password'),
    path('', include(router.urls)),
]
