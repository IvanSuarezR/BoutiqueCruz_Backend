from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import AddressViewSet, ShippingMethodViewSet, PaymentMethodViewSet, OrderViewSet, CartViewSet, PreferencesViewSet

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')
router.register(r'shipping-methods', ShippingMethodViewSet, basename='shipping-method')
router.register(r'payment-methods', PaymentMethodViewSet, basename='payment-method')
router.register(r'orders', OrderViewSet, basename='order')
router.register(r'cart', CartViewSet, basename='cart')
router.register(r'preferences', PreferencesViewSet, basename='preferences')

urlpatterns = [
    path('', include(router.urls)),
]
