"""
Servicio de optimización de inventario usando ML
"""
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from django.db.models import Sum, Count, Avg, F, Q
from products.models import Product, ProductVariant
from orders.models import OrderItem
import logging

logger = logging.getLogger(__name__)


class InventoryOptimizationService:
    """
    Servicio para optimización de inventario
    - Detecta productos con bajo stock
    - Identifica productos de baja rotación
    - Predice demanda futura
    - Sugiere niveles óptimos de stock
    """
    
    def analyze_inventory(self):
        """
        Analiza el inventario completo y genera alertas
        """
        try:
            alerts = []
            
            # Obtener todos los productos activos
            products = Product.objects.filter(status='active')
            
            for product in products:
                alert = self._analyze_product_inventory(product)
                if alert:
                    alerts.append(alert)
            
            # Ordenar por urgencia
            alerts.sort(key=lambda x: x['urgency_level'], reverse=True)
            
            return {
                'success': True,
                'total_products_analyzed': products.count(),
                'alerts': alerts,
                'summary': self._generate_summary(alerts)
            }
            
        except Exception as e:
            logger.error(f"Error analizando inventario: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _analyze_product_inventory(self, product):
        """
        Analiza un producto individual
        """
        try:
            # Obtener stock total de todas las variantes
            current_stock = product.total_stock
            
            # Calcular demanda histórica (últimos 30 y 7 días)
            demand_30d = self._calculate_demand(product.id, days=30)
            demand_7d = self._calculate_demand(product.id, days=7)
            
            # Calcular tasa de venta diaria
            daily_sales_rate = demand_30d / 30 if demand_30d > 0 else 0
            
            # Predecir días hasta agotamiento
            days_until_stockout = (current_stock / daily_sales_rate) if daily_sales_rate > 0 else 999
            
            # Calcular stock recomendado (30 días de demanda + buffer 20%)
            recommended_stock = int((demand_30d / 30) * 30 * 1.2) if demand_30d > 0 else max(5, current_stock)
            
            # Calcular tasa de rotación
            rotation_rate = (demand_30d / current_stock) if current_stock > 0 else 0
            
            # Determinar tipo de alerta
            alert_type = None
            urgency_level = 0
            
            if days_until_stockout < 7 and current_stock > 0:
                alert_type = 'reorder_now'
                urgency_level = 5
            elif days_until_stockout < 14:
                alert_type = 'low_stock'
                urgency_level = 4
            elif rotation_rate < 0.1 and current_stock > 10:
                alert_type = 'slow_moving'
                urgency_level = 2
            elif current_stock > recommended_stock * 2:
                alert_type = 'overstock'
                urgency_level = 3
            elif demand_7d > demand_30d / 30 * 7 * 1.5:
                # Demanda reciente 50% mayor que promedio
                alert_type = 'high_demand'
                urgency_level = 4
            
            if alert_type:
                estimated_stockout_date = datetime.now().date() + timedelta(days=int(days_until_stockout))
                
                return {
                    'product_id': str(product.id),
                    'product_name': product.name,
                    'alert_type': alert_type,
                    'current_stock': current_stock,
                    'recommended_stock': recommended_stock,
                    'predicted_demand_7days': int(demand_7d),
                    'predicted_demand_30days': int(demand_30d),
                    'daily_sales_rate': round(daily_sales_rate, 2),
                    'days_until_stockout': int(days_until_stockout) if days_until_stockout < 999 else None,
                    'estimated_stockout_date': estimated_stockout_date.isoformat() if days_until_stockout < 999 else None,
                    'urgency_level': urgency_level,
                    'rotation_rate': round(rotation_rate, 3),
                    'price': float(product.price),
                    'category': product.category.name if product.category else None
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error analizando producto {product.id}: {str(e)}")
            return None
    
    def _calculate_demand(self, product_id, days=30):
        """
        Calcula la demanda histórica de un producto
        """
        try:
            start_date = datetime.now() - timedelta(days=days)
            
            demand = OrderItem.objects.filter(
                product_id=product_id,
                order__status__in=['delivered', 'completed'],
                order__created_at__gte=start_date
            ).aggregate(total_quantity=Sum('quantity'))['total_quantity']
            
            return demand or 0
            
        except Exception as e:
            logger.error(f"Error calculando demanda: {str(e)}")
            return 0
    
    def _generate_summary(self, alerts):
        """
        Genera resumen de las alertas
        """
        summary = {
            'total_alerts': len(alerts),
            'by_type': {},
            'by_urgency': {},
            'total_stock_value_at_risk': 0
        }
        
        for alert in alerts:
            # Contar por tipo
            alert_type = alert['alert_type']
            summary['by_type'][alert_type] = summary['by_type'].get(alert_type, 0) + 1
            
            # Contar por urgencia
            urgency = alert['urgency_level']
            summary['by_urgency'][urgency] = summary['by_urgency'].get(urgency, 0) + 1
            
            # Calcular valor en riesgo
            if alert_type in ['reorder_now', 'low_stock']:
                summary['total_stock_value_at_risk'] += alert['current_stock'] * alert['price']
        
        return summary
    
    def get_reorder_recommendations(self):
        """
        Obtiene recomendaciones específicas de reorden
        """
        try:
            recommendations = []
            
            products = Product.objects.filter(status='active')
            
            for product in products:
                current_stock = product.total_stock
                demand_30d = self._calculate_demand(product.id, days=30)
                
                # Lead time (días que toma reabastecer) - por ahora fijo
                lead_time_days = 7
                
                # Safety stock (stock de seguridad)
                daily_demand = demand_30d / 30 if demand_30d > 0 else 0
                safety_stock = daily_demand * lead_time_days * 0.5  # 50% extra
                
                # Reorder point
                reorder_point = (daily_demand * lead_time_days) + safety_stock
                
                # Economic Order Quantity (EOQ) - simplificado
                # EOQ = sqrt((2 * D * S) / H)
                # D = demanda anual, S = costo de orden, H = costo de mantenimiento
                annual_demand = demand_30d * 12
                order_cost = 50  # Costo fijo por orden
                holding_cost_rate = 0.2  # 20% del precio
                holding_cost = float(product.price) * holding_cost_rate
                
                if holding_cost > 0 and annual_demand > 0:
                    eoq = np.sqrt((2 * annual_demand * order_cost) / holding_cost)
                else:
                    eoq = daily_demand * 30  # 1 mes de inventario
                
                # Determinar si se debe reordenar
                should_reorder = current_stock <= reorder_point
                
                if should_reorder:
                    recommended_quantity = max(int(eoq), int(reorder_point - current_stock))
                    
                    recommendations.append({
                        'product_id': str(product.id),
                        'product_name': product.name,
                        'current_stock': current_stock,
                        'reorder_point': int(reorder_point),
                        'recommended_order_quantity': recommended_quantity,
                        'safety_stock': int(safety_stock),
                        'daily_demand': round(daily_demand, 2),
                        'lead_time_days': lead_time_days,
                        'estimated_cost': recommended_quantity * float(product.price) * 0.6,  # 60% costo
                        'priority': 'high' if current_stock < safety_stock else 'medium'
                    })
            
            # Ordenar por prioridad
            recommendations.sort(key=lambda x: (x['priority'] == 'high', x['current_stock']))
            
            return {
                'success': True,
                'recommendations': recommendations,
                'total_recommendations': len(recommendations),
                'estimated_total_cost': sum(r['estimated_cost'] for r in recommendations)
            }
            
        except Exception as e:
            logger.error(f"Error generando recomendaciones de reorden: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_slow_moving_products(self, threshold_days=60):
        """
        Identifica productos de baja rotación
        """
        try:
            from django.utils import timezone
            slow_products = []
            
            products = Product.objects.filter(status='active')
            
            for product in products:
                # Solo analizar si tiene stock
                if product.total_stock <= 0:
                    continue
                    
                demand_60d = self._calculate_demand(product.id, days=threshold_days)
                
                # Si no se ha vendido nada en los últimos 60 días
                if demand_60d == 0:
                    # Verificar último movimiento
                    last_sale = OrderItem.objects.filter(
                        product_id=product.id
                    ).order_by('-order__created_at').first()
                    
                    days_since_last_sale = 999
                    if last_sale:
                        days_since_last_sale = (timezone.now() - last_sale.order.created_at).days
                    
                    slow_products.append({
                        'product_id': str(product.id),
                        'product_name': product.name,
                        'current_stock': product.total_stock,
                        'days_since_last_sale': days_since_last_sale,
                        'stock_value': product.total_stock * float(product.price),
                        'category': product.category.name if product.category else None,
                        'recommendation': 'Considerar descuento o promoción'
                    })
            
            # Ordenar por días sin venta
            slow_products.sort(key=lambda x: x['days_since_last_sale'], reverse=True)
            
            return {
                'success': True,
                'slow_moving_products': slow_products,
                'total_products': len(slow_products),
                'total_stock_value': sum(p['stock_value'] for p in slow_products)
            }
            
        except Exception as e:
            logger.error(f"Error identificando productos de baja rotación: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_inventory_health_score(self):
        """
        Calcula un score general de salud del inventario
        """
        try:
            products = Product.objects.filter(status='active')
            total_products = products.count()
            
            if total_products == 0:
                return {'success': True, 'health_score': 100, 'status': 'healthy'}
            
            # Métricas
            low_stock_count = 0
            overstock_count = 0
            slow_moving_count = 0
            optimal_count = 0
            
            for product in products:
                analysis = self._analyze_product_inventory(product)
                if analysis:
                    if analysis['alert_type'] in ['low_stock', 'reorder_now']:
                        low_stock_count += 1
                    elif analysis['alert_type'] == 'overstock':
                        overstock_count += 1
                    elif analysis['alert_type'] == 'slow_moving':
                        slow_moving_count += 1
                else:
                    optimal_count += 1
            
            # Calcular score (0-100)
            # Penalizar problemas
            low_stock_penalty = (low_stock_count / total_products) * 30
            overstock_penalty = (overstock_count / total_products) * 20
            slow_moving_penalty = (slow_moving_count / total_products) * 25
            
            health_score = max(0, 100 - low_stock_penalty - overstock_penalty - slow_moving_penalty)
            
            # Determinar status
            if health_score >= 80:
                status = 'healthy'
            elif health_score >= 60:
                status = 'warning'
            else:
                status = 'critical'
            
            return {
                'success': True,
                'health_score': round(health_score, 1),
                'status': status,
                'metrics': {
                    'total_products': total_products,
                    'low_stock': low_stock_count,
                    'overstock': overstock_count,
                    'slow_moving': slow_moving_count,
                    'optimal': optimal_count
                },
                'recommendations': self._get_health_recommendations(status, {
                    'low_stock': low_stock_count,
                    'overstock': overstock_count,
                    'slow_moving': slow_moving_count
                })
            }
            
        except Exception as e:
            logger.error(f"Error calculando health score: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_health_recommendations(self, status, metrics):
        """
        Genera recomendaciones basadas en el estado del inventario
        """
        recommendations = []
        
        if status == 'critical':
            recommendations.append("URGENTE: Revisar inventario inmediatamente")
        
        if metrics['low_stock'] > 0:
            recommendations.append(f"Reabastecer {metrics['low_stock']} productos con stock bajo")
        
        if metrics['overstock'] > 0:
            recommendations.append(f"Considerar promociones para {metrics['overstock']} productos con sobrestock")
        
        if metrics['slow_moving'] > 0:
            recommendations.append(f"Aplicar estrategia de liquidación para {metrics['slow_moving']} productos de baja rotación")
        
        if not recommendations:
            recommendations.append("Inventario en buen estado. Continuar monitoreando.")
        
        return recommendations
