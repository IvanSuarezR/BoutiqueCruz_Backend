"""
Servicio de predicción de ventas adaptado al sistema de Boutique Cruz
Usa los modelos Order y OrderItem para analizar historial de ventas
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from datetime import datetime, timedelta
import joblib
import os
from django.conf import settings
from django.db.models import Sum, Count, Avg, F
from django.db.models.functions import TruncDate
from orders.models import Order, OrderItem
from inventory.models import Product, Category
import logging

logger = logging.getLogger(__name__)


class SalesForecastService:
    """
    Servicio para predicción de ventas basado en el historial de órdenes
    """
    
    def __init__(self):
        self.model = None
        self.model_path = os.path.join(settings.BASE_DIR, 'ml_predictions', 'ml_models', 'sales_forecast.pkl')
        self.scaler_path = os.path.join(settings.BASE_DIR, 'ml_predictions', 'ml_models', 'sales_scaler.pkl')
        
    def prepare_training_data(self, months_back=12):
        """
        Prepara datos de entrenamiento desde la base de datos de órdenes
        Analiza órdenes completadas (DELIVERED, PAID, AWAITING_DISPATCH)
        """
        try:
            from django.utils import timezone
            
            end_date = timezone.now()
            start_date = end_date - timedelta(days=months_back * 30)
            
            # Obtener ventas históricas agregadas por día
            # Solo órdenes que representan ventas reales (no borradores ni canceladas)
            valid_statuses = ['PAID', 'AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED']
            
            orders = Order.objects.filter(
                created_at__gte=start_date,
                status__in=valid_statuses
            ).annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                total_sales=Sum('grand_total'),
                total_quantity=Sum('total_items'),
                num_orders=Count('id'),
                avg_order_value=Avg('grand_total')
            ).order_by('date')
            
            orders_list = list(orders)
            
            if len(orders_list) < 7:
                logger.warning(f"Datos insuficientes: solo {len(orders_list)} días con ventas")
                return None
            
            # Convertir a DataFrame
            df = pd.DataFrame(orders_list)
            
            # Convertir columnas Decimal a float para evitar errores de tipo
            df['total_sales'] = pd.to_numeric(df['total_sales'], errors='coerce').fillna(0).astype(float)
            df['total_quantity'] = pd.to_numeric(df['total_quantity'], errors='coerce').fillna(0).astype(float)
            df['num_orders'] = pd.to_numeric(df['num_orders'], errors='coerce').fillna(0).astype(float)
            df['avg_order_value'] = pd.to_numeric(df['avg_order_value'], errors='coerce').fillna(0).astype(float)
            
            # Ingeniería de características temporales
            df['date'] = pd.to_datetime(df['date'])
            df['year'] = df['date'].dt.year
            df['month'] = df['date'].dt.month
            df['day'] = df['date'].dt.day
            df['day_of_week'] = df['date'].dt.dayofweek  # 0=Monday, 6=Sunday
            df['day_of_year'] = df['date'].dt.dayofyear
            df['week_of_year'] = df['date'].dt.isocalendar().week.astype(int)
            df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
            df['quarter'] = df['date'].dt.quarter
            
            # Características de tendencia (rolling averages)
            df = df.sort_values('date')
            df['sales_7d_avg'] = df['total_sales'].rolling(window=7, min_periods=1).mean()
            df['sales_30d_avg'] = df['total_sales'].rolling(window=30, min_periods=1).mean()
            df['sales_7d_std'] = df['total_sales'].rolling(window=7, min_periods=1).std().fillna(0)
            
            # Características lag (ventas días anteriores)
            df['sales_lag_1'] = df['total_sales'].shift(1).fillna(0)
            df['sales_lag_7'] = df['total_sales'].shift(7).fillna(0)
            df['sales_lag_30'] = df['total_sales'].shift(30).fillna(0)
            
            # Características de momentum (cambio porcentual)
            df['sales_pct_change_1d'] = df['total_sales'].pct_change(1).fillna(0).replace([np.inf, -np.inf], 0)
            df['sales_pct_change_7d'] = df['total_sales'].pct_change(7).fillna(0).replace([np.inf, -np.inf], 0)
            
            # Rellenar cualquier NaN restante
            df = df.fillna(0)
            
            logger.info(f"Datos preparados: {len(df)} registros desde {df['date'].min()} hasta {df['date'].max()}")
            logger.info(f"Total ventas en período: Bs. {df['total_sales'].sum():.2f}")
            logger.info(f"Promedio ventas diarias: Bs. {df['total_sales'].mean():.2f}")
            
            return df
            
        except Exception as e:
            logger.error(f"Error preparando datos de entrenamiento: {str(e)}")
            return None
    
    def train_model(self, df=None, model_type='random_forest'):
        """
        Entrena el modelo de predicción de ventas
        """
        try:
            if df is None:
                df = self.prepare_training_data()
            
            if df is None or len(df) < 7:
                raise ValueError("Datos insuficientes para entrenar el modelo (mínimo 7 registros)")
            
            # Seleccionar características
            feature_columns = [
                'month', 'day', 'day_of_week', 'day_of_year', 'week_of_year',
                'is_weekend', 'quarter', 'num_orders', 'avg_order_value',
                'sales_7d_avg', 'sales_30d_avg', 'sales_7d_std',
                'sales_lag_1', 'sales_lag_7', 'sales_lag_30',
                'sales_pct_change_1d', 'sales_pct_change_7d'
            ]
            
            X = df[feature_columns]
            y = df['total_sales']
            
            # Split datos (80/20, sin shuffle para mantener orden temporal)
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )
            
            # Seleccionar modelo
            if model_type == 'random_forest':
                self.model = RandomForestRegressor(
                    n_estimators=100,
                    max_depth=10,
                    min_samples_split=5,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1
                )
            elif model_type == 'gradient_boosting':
                self.model = GradientBoostingRegressor(
                    n_estimators=100,
                    max_depth=5,
                    learning_rate=0.1,
                    random_state=42
                )
            else:
                self.model = LinearRegression()
            
            # Entrenar
            logger.info(f"Entrenando modelo {model_type} con {len(X_train)} registros...")
            self.model.fit(X_train, y_train)
            
            # Evaluar
            y_pred_train = self.model.predict(X_train)
            y_pred_test = self.model.predict(X_test)
            
            train_r2 = r2_score(y_train, y_pred_train)
            test_r2 = r2_score(y_test, y_pred_test)
            train_rmse = np.sqrt(mean_squared_error(y_train, y_pred_train))
            test_rmse = np.sqrt(mean_squared_error(y_test, y_pred_test))
            train_mae = mean_absolute_error(y_train, y_pred_train)
            test_mae = mean_absolute_error(y_test, y_pred_test)
            
            # Cross-validation
            cv_scores = cross_val_score(self.model, X, y, cv=min(5, len(X)//10), scoring='r2')
            
            metrics = {
                'train_r2': float(train_r2),
                'test_r2': float(test_r2),
                'train_rmse': float(train_rmse),
                'test_rmse': float(test_rmse),
                'train_mae': float(train_mae),
                'test_mae': float(test_mae),
                'cv_r2_mean': float(cv_scores.mean()),
                'cv_r2_std': float(cv_scores.std()),
                'training_samples': len(X_train),
                'test_samples': len(X_test),
                'feature_importances': {}
            }
            
            # Feature importances (solo para modelos basados en árboles)
            if hasattr(self.model, 'feature_importances_'):
                importances = dict(zip(feature_columns, self.model.feature_importances_))
                sorted_importances = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:10]
                metrics['feature_importances'] = {k: float(v) for k, v in sorted_importances}
            
            logger.info(f"✓ Modelo entrenado - R²: {test_r2:.4f}, RMSE: {test_rmse:.2f} Bs.")
            
            # Guardar modelo
            self.save_model()
            
            return {
                'success': True,
                'model_type': model_type,
                'metrics': metrics,
                'training_data_size': len(df)
            }
            
        except Exception as e:
            logger.error(f"Error entrenando modelo: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def save_model(self):
        """Guarda el modelo entrenado en disco"""
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(self.model, self.model_path)
            logger.info(f"Modelo guardado en {self.model_path}")
        except Exception as e:
            logger.error(f"Error guardando modelo: {str(e)}")
    
    def load_model(self):
        """Carga el modelo desde disco"""
        try:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
                logger.info("Modelo cargado exitosamente")
                return True
            else:
                logger.warning("No se encontró modelo entrenado")
                return False
        except Exception as e:
            logger.error(f"Error cargando modelo: {str(e)}")
            return False
    
    def predict_future_sales(self, days_ahead=30):
        """
        Predice ventas futuras
        """
        print("---------------------------------------------------")
        print(f"model_path: {self.model_path}   ")
        print("---------------------------------------------------")
        try:
            if self.model is None:
                if not self.load_model():
                    raise ValueError("No hay modelo entrenado disponible")
            print("---------------------------------------------------")
            print("Modelo cargado para predicción")
            print("---------------------------------------------------")
            # Obtener últimos datos para generar características
            recent_data = self.prepare_training_data(months_back=3)
            if recent_data is None or len(recent_data) == 0:
                raise ValueError("No hay datos recientes para generar predicciones")
            
            # Generar fechas futuras
            from django.utils import timezone
            last_date = recent_data['date'].max()
            # Convertir a datetime si es pandas Timestamp
            if hasattr(last_date, 'to_pydatetime'):
                last_date = last_date.to_pydatetime()
            future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=days_ahead, freq='D')
            
            predictions = []
            
            # Para cada día futuro, generar características y predecir
            for future_date in future_dates:
                features = {
                    'month': future_date.month,
                    'day': future_date.day,
                    'day_of_week': future_date.dayofweek,
                    'day_of_year': future_date.dayofyear,
                    'week_of_year': future_date.isocalendar().week,
                    'is_weekend': 1 if future_date.dayofweek >= 5 else 0,
                    'quarter': (future_date.month - 1) // 3 + 1,
                    'num_orders': recent_data['num_orders'].iloc[-7:].mean(),
                    'avg_order_value': recent_data['avg_order_value'].iloc[-7:].mean(),
                    'sales_7d_avg': recent_data['total_sales'].iloc[-7:].mean(),
                    'sales_30d_avg': recent_data['total_sales'].iloc[-30:].mean(),
                    'sales_7d_std': recent_data['total_sales'].iloc[-7:].std(),
                    'sales_lag_1': recent_data['total_sales'].iloc[-1],
                    'sales_lag_7': recent_data['total_sales'].iloc[-7] if len(recent_data) >= 7 else recent_data['total_sales'].iloc[0],
                    'sales_lag_30': recent_data['total_sales'].iloc[-30] if len(recent_data) >= 30 else recent_data['total_sales'].iloc[0],
                    'sales_pct_change_1d': 0,
                    'sales_pct_change_7d': 0
                }
                
                X_pred = pd.DataFrame([features])
                pred_value = self.model.predict(X_pred)[0]
                
                # Asegurar que la predicción sea positiva
                pred_value = max(0, pred_value)
                
                avg_order_value = float(recent_data['avg_order_value'].mean())
                predictions.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'predicted_sales': float(pred_value),
                    'predicted_quantity': int(float(pred_value) / avg_order_value) if avg_order_value > 0 else 0
                })
            
            logger.info(f"Predicciones generadas para {days_ahead} días")
            return {
                'success': True,
                'predictions': predictions,
                'summary': {
                    'total_predicted_sales': float(sum(float(p['predicted_sales']) for p in predictions)),
                    'avg_daily_sales': float(sum(float(p['predicted_sales']) for p in predictions)) / len(predictions),
                    'days_predicted': len(predictions)
                }
            }
            
        except Exception as e:
            logger.error(f"Error generando predicciones: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_sales_analytics(self):
        """
        Obtiene analytics básicos de ventas históricas
        """
        try:
            from django.utils import timezone
            
            now = timezone.now()
            thirty_days_ago = now - timedelta(days=30)
            seven_days_ago = now - timedelta(days=7)
            
            valid_statuses = ['PAID', 'AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED']
            
            # Ventas últimos 30 días
            sales_30d = Order.objects.filter(
                created_at__gte=thirty_days_ago,
                status__in=valid_statuses
            ).aggregate(
                total=Sum('grand_total'),
                count=Count('id'),
                avg=Avg('grand_total')
            )
            
            # Ventas últimos 7 días
            sales_7d = Order.objects.filter(
                created_at__gte=seven_days_ago,
                status__in=valid_statuses
            ).aggregate(
                total=Sum('grand_total'),
                count=Count('id'),
                avg=Avg('grand_total')
            )
            
            # Top productos vendidos (últimos 30 días)
            top_products = OrderItem.objects.filter(
                order__created_at__gte=thirty_days_ago,
                order__status__in=valid_statuses
            ).values('product__name', 'product__id').annotate(
                total_quantity=Sum('quantity'),
                total_revenue=Sum('line_subtotal')
            ).order_by('-total_quantity')[:10]
            
            return {
                'success': True,
                'sales_30d': {
                    'total': float(sales_30d['total'] or 0),
                    'count': sales_30d['count'] or 0,
                    'avg': float(sales_30d['avg'] or 0)
                },
                'sales_7d': {
                    'total': float(sales_7d['total'] or 0),
                    'count': sales_7d['count'] or 0,
                    'avg': float(sales_7d['avg'] or 0)
                },
                'top_products': list(top_products)
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo analytics: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
