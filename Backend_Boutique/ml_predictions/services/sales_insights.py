"""
Servicio de análisis de ventas con ML
Proporciona insights avanzados para el dueño del negocio
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg, F, Q
from django.db.models.functions import TruncDate, TruncWeek, TruncMonth
from orders.models import Order, OrderItem
from inventory.models import Product, Category
from accounts.models import CustomUser
import logging

logger = logging.getLogger(__name__)


class SalesInsightsService:
    """
    Servicio para generar insights de ventas para el dueño del negocio
    """
    
    def __init__(self):
        self.valid_statuses = ['PAID', 'AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED']
    
    def get_top_selling_products(self, days=30, limit=10):
        """
        Productos más vendidos en el período
        """
        try:
            start_date = timezone.now() - timedelta(days=days)
            
            top_products = OrderItem.objects.filter(
                order__created_at__gte=start_date,
                order__status__in=self.valid_statuses
            ).values(
                'product__id',
                'product__name',
                'product__sku',
                'product__category__name'
            ).annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('line_subtotal'),
                num_orders=Count('order__id', distinct=True)
            ).order_by('-total_quantity')[:limit]
            
            return {
                'success': True,
                'top_products': list(top_products),
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error obteniendo top productos: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_category_performance(self, days=30):
        """
        Rendimiento de ventas por categoría
        """
        try:
            start_date = timezone.now() - timedelta(days=days)
            
            category_stats = OrderItem.objects.filter(
                order__created_at__gte=start_date,
                order__status__in=self.valid_statuses,
                product__category__isnull=False
            ).values(
                'product__category__id',
                'product__category__name',
                'product__category__gender',
                'product__category__kind'
            ).annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('line_subtotal'),
                num_orders=Count('order__id', distinct=True),
                avg_price=Avg('unit_price'),
                num_products=Count('product__id', distinct=True)
            ).order_by('-total_revenue')
            
            return {
                'success': True,
                'categories': list(category_stats),
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error obteniendo rendimiento de categorías: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_sales_by_day_of_week(self, days=90):
        """
        Análisis de ventas por día de la semana
        """
        try:
            start_date = timezone.now() - timedelta(days=days)
            
            orders = Order.objects.filter(
                created_at__gte=start_date,
                status__in=self.valid_statuses
            ).annotate(
                date=TruncDate('created_at')
            )
            
            # Crear DataFrame para análisis
            orders_data = list(orders.values('date', 'grand_total', 'total_items'))
            if not orders_data:
                return {'success': False, 'error': 'No hay datos suficientes'}
            
            df = pd.DataFrame(orders_data)
            df['date'] = pd.to_datetime(df['date'])
            df['day_of_week'] = df['date'].dt.dayofweek
            df['day_name'] = df['date'].dt.day_name()
            
            # Agrupar por día de semana
            dow_stats = df.groupby(['day_of_week', 'day_name']).agg({
                'grand_total': ['sum', 'mean', 'count'],
                'total_items': 'sum'
            }).reset_index()
            
            dow_stats.columns = ['day_of_week', 'day_name', 'total_revenue', 'avg_order_value', 'num_orders', 'total_items']
            dow_stats = dow_stats.sort_values('day_of_week')
            
            # Traducir nombres al español
            day_names_es = {
                'Monday': 'Lunes',
                'Tuesday': 'Martes',
                'Wednesday': 'Miércoles',
                'Thursday': 'Jueves',
                'Friday': 'Viernes',
                'Saturday': 'Sábado',
                'Sunday': 'Domingo'
            }
            dow_stats['day_name'] = dow_stats['day_name'].map(day_names_es)
            
            return {
                'success': True,
                'day_of_week_stats': dow_stats.to_dict('records'),
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error analizando ventas por día: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_monthly_trends(self, months=6):
        """
        Tendencias mensuales de ventas
        """
        try:
            start_date = timezone.now() - timedelta(days=months * 30)
            
            monthly_stats = Order.objects.filter(
                created_at__gte=start_date,
                status__in=self.valid_statuses
            ).annotate(
                month=TruncMonth('created_at')
            ).values('month').annotate(
                total_revenue=Sum('grand_total'),
                num_orders=Count('id'),
                avg_order_value=Avg('grand_total'),
                total_items=Sum('total_items')
            ).order_by('month')
            
            monthly_data = list(monthly_stats)
            
            # Calcular crecimiento mes a mes
            for i in range(1, len(monthly_data)):
                prev_revenue = float(monthly_data[i-1]['total_revenue'])
                curr_revenue = float(monthly_data[i]['total_revenue'])
                if prev_revenue > 0:
                    growth = ((curr_revenue - prev_revenue) / prev_revenue) * 100
                    monthly_data[i]['growth_percent'] = round(growth, 2)
                else:
                    monthly_data[i]['growth_percent'] = 0
            
            if len(monthly_data) > 0:
                monthly_data[0]['growth_percent'] = 0
            
            return {
                'success': True,
                'monthly_trends': monthly_data,
                'period_months': months
            }
        except Exception as e:
            logger.error(f"Error obteniendo tendencias mensuales: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_customer_insights(self, days=90):
        """
        Insights sobre clientes y comportamiento de compra
        """
        try:
            start_date = timezone.now() - timedelta(days=days)
            
            # Clientes más frecuentes
            top_customers = Order.objects.filter(
                created_at__gte=start_date,
                status__in=self.valid_statuses
            ).values(
                'user__id',
                'user__first_name',
                'user__last_name',
                'user__email'
            ).annotate(
                num_orders=Count('id'),
                total_spent=Sum('grand_total'),
                avg_order_value=Avg('grand_total'),
                total_items=Sum('total_items')
            ).order_by('-total_spent')[:10]
            
            # Estadísticas generales
            total_customers = Order.objects.filter(
                created_at__gte=start_date,
                status__in=self.valid_statuses
            ).values('user').distinct().count()
            
            # Clientes nuevos vs recurrentes
            new_customers = CustomUser.objects.filter(
                date_joined__gte=start_date,
                user_type='customer'
            ).count()
            
            return {
                'success': True,
                'top_customers': list(top_customers),
                'total_customers': total_customers,
                'new_customers': new_customers,
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error obteniendo insights de clientes: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_low_stock_alerts(self, threshold=10):
        """
        Productos con stock bajo que necesitan reabastecimiento
        """
        try:
            low_stock_products = Product.objects.filter(
                is_active=True,
                stock__lte=threshold
            ).values(
                'id',
                'name',
                'sku',
                'stock',
                'category__name',
                'price'
            ).order_by('stock')[:20]
            
            return {
                'success': True,
                'low_stock_products': list(low_stock_products),
                'threshold': threshold
            }
        except Exception as e:
            logger.error(f"Error obteniendo alertas de stock: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_revenue_by_payment_method(self, days=30):
        """
        Ingresos por método de pago
        """
        try:
            start_date = timezone.now() - timedelta(days=days)
            
            payment_stats = Order.objects.filter(
                created_at__gte=start_date,
                status__in=self.valid_statuses,
                payment_method__isnull=False
            ).values(
                'payment_method__name',
                'payment_method__type'
            ).annotate(
                total_revenue=Sum('grand_total'),
                num_orders=Count('id'),
                avg_order_value=Avg('grand_total')
            ).order_by('-total_revenue')
            
            return {
                'success': True,
                'payment_method_stats': list(payment_stats),
                'period_days': days
            }
        except Exception as e:
            logger.error(f"Error obteniendo stats por método de pago: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_comprehensive_dashboard(self):
        """
        Dashboard completo con todos los insights clave
        """
        try:
            return {
                'success': True,
                'top_products_30d': self.get_top_selling_products(days=30, limit=5),
                'category_performance': self.get_category_performance(days=30),
                'sales_by_day': self.get_sales_by_day_of_week(days=90),
                'monthly_trends': self.get_monthly_trends(months=6),
                'customer_insights': self.get_customer_insights(days=90),
                'low_stock_alerts': self.get_low_stock_alerts(threshold=10),
                'payment_methods': self.get_revenue_by_payment_method(days=30)
            }
        except Exception as e:
            logger.error(f"Error generando dashboard completo: {str(e)}")
            return {'success': False, 'error': str(e)}
