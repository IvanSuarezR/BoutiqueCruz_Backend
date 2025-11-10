from django.urls import path
from .views import SalesOrderViewSet

sales_order_list = SalesOrderViewSet.as_view({'get': 'list'})
sales_order_detail = SalesOrderViewSet.as_view({'get': 'retrieve'})
sales_order_transition = SalesOrderViewSet.as_view({'post': 'transition'})
sales_order_users = SalesOrderViewSet.as_view({'get': 'users'})

urlpatterns = [
    path('orders/', sales_order_list, name='sales-orders'),
    path('orders/<int:pk>/', sales_order_detail, name='sales-order-detail'),
    path('orders/<int:pk>/transition/', sales_order_transition, name='sales-order-transition'),
    path('orders/users/', sales_order_users, name='sales-order-users'),
]
