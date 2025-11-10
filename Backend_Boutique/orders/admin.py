from django.contrib import admin
from .models import Address, ShippingMethod, PaymentMethod, Order, OrderItem, OrderStatusHistory

@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('id','user','full_name','city','country','is_default')
    list_filter = ('country','is_default')
    search_fields = ('full_name','city','line1','phone')

@admin.register(ShippingMethod)
class ShippingMethodAdmin(admin.ModelAdmin):
    list_display = ('id','code','name','base_cost','is_active','transit_days_min','transit_days_max')
    list_filter = ('is_active',)
    search_fields = ('code','name')

@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ('id','code','name','type','is_active','fee_percent','fee_fixed')
    list_filter = ('is_active','type')
    search_fields = ('code','name')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id','user','status','grand_total','created_at','placed_at','paid_at')
    list_filter = ('status','currency','created_at')
    search_fields = ('id','user__email','user__username')
    inlines = [OrderItemInline]

@admin.register(OrderStatusHistory)
class OrderStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ('order','old_status','new_status','changed_at','changed_by')
    list_filter = ('old_status','new_status','changed_at')
    search_fields = ('order__id','changed_by__email')
