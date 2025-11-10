"""
Servicio de predicción de ventas usando Scikit-learn
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import LabelEncoder
from datetime import datetime, timedelta
import joblib
import os
from django.conf import settings
from django.db.models import Sum, Count, Avg, F
from orders.models import Order, OrderItem
from products.models import Product, Category
import logging

logger = logging.getLogger(__name__)


class SalesForecastService:
    """
    Servicio para predicción de ventas
    """
    
    def __init__(self):
        self.model = None
        self.model_path = os.path.join(settings.BASE_DIR, 'ml_predictions', 'ml_models', 'sales_forecast.pkl')
        self.encoder = LabelEncoder()
        
    def prepare_training_data(self, months_back=24):
        """
        Prepara datos de entrenamiento desde la base de datos
        """
        try:
            # Obtener fecha límite
            from django.utils import timezone
            from django.db.models.functions import TruncDate
            
            end_date = timezone.now()
            start_date = end_date - timedelta(days=months_back * 30)
            
            # Obtener ventas históricas agregadas por día
            orders = Order.objects.filter(
                created_at__gte=start_date,
                status__in=['delivered', 'completed']
            ).annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                total_sales=Sum('total_amount'),
                total_quantity=Sum('items__quantity'),
                num_orders=Count('id'),
                avg_order_value=Avg('total_amount')
            ).order_by('date')
            
            orders_list = list(orders)
            
            if len(orders_list) < 30:
                logger.warning(f"Datos insuficientes: solo {len(orders_list)} días con ventas")
                return None
            
            # Convertir a DataFrame
            df = pd.DataFrame(orders_list)
            
            # Ingeniería de características
            df['date'] = pd.to_datetime(df['date'])
            df['year'] = df['date'].dt.year
            df['month'] = df['date'].dt.month
            df['day'] = df['date'].dt.day
            df['day_of_week'] = df['date'].dt.dayofweek
            df['day_of_year'] = df['date'].dt.dayofyear
            df['week_of_year'] = df['date'].dt.isocalendar().week
            df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
            df['quarter'] = df['date'].dt.quarter
            
            # Características de tendencia (rolling averages)
            df['sales_7d_avg'] = df['total_sales'].rolling(window=7, min_periods=1).mean()
            df['sales_30d_avg'] = df['total_sales'].rolling(window=30, min_periods=1).mean()
            df['sales_7d_std'] = df['total_sales'].rolling(window=7, min_periods=1).std().fillna(0)
            
            # Características lag (ventas días anteriores)
            df['sales_lag_1'] = df['total_sales'].shift(1).fillna(0)
            df['sales_lag_7'] = df['total_sales'].shift(7).fillna(0)
            df['sales_lag_30'] = df['total_sales'].shift(30).fillna(0)
            
            # Rellenar NaN
            df = df.fillna(0)
            
            logger.info(f"Datos preparados: {len(df)} registros")
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
            
            if df is None or len(df) < 30:
                raise ValueError("Datos insuficientes para entrenar el modelo (mínimo 30 registros)")
            
            # Seleccionar características
            feature_columns = [
                'month', 'day', 'day_of_week', 'day_of_year', 'week_of_year',
                'is_weekend', 'quarter', 'num_orders', 'avg_order_value',
                'sales_7d_avg', 'sales_30d_avg', 'sales_7d_std',
                'sales_lag_1', 'sales_lag_7', 'sales_lag_30'
            ]
            
            X = df[feature_columns]
            y = df['total_sales']
            
            # Split datos
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, shuffle=False
            )
            
            # Seleccionar modelo
            if model_type == 'random_forest':
                self.model = RandomForestRegressor(
                    n_estimators=100,
                    max_depth=10,
                    min_samples_split=5,
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
            logger.info(f"Entrenando modelo {model_type}...")
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
            cv_scores = cross_val_score(self.model, X, y, cv=5, scoring='r2')
            
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
                # Top 10 características más importantes
                sorted_importances = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:10]
                metrics['feature_importances'] = {k: float(v) for k, v in sorted_importances}
            
            logger.info(f"Modelo entrenado - R2: {test_r2:.4f}, RMSE: {test_rmse:.2f}")
            
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
    
    def predict_future_sales(self, days_ahead=30):
        """
        Predice ventas futuras para los próximos N días
        """
        try:
            from django.utils import timezone
            from django.db.models.functions import TruncDate
            
            if self.model is None:
                self.load_model()
            
            if self.model is None:
                raise ValueError("No hay modelo entrenado. Por favor entrena el modelo primero.")
            
            # Obtener datos históricos recientes para crear lag features
            sixty_days_ago = timezone.now() - timedelta(days=60)
            
            recent_sales = Order.objects.filter(
                status__in=['delivered', 'completed'],
                created_at__gte=sixty_days_ago
            ).annotate(
                date=TruncDate('created_at')
            ).values('date').annotate(
                total_sales=Sum('total_amount'),
                num_orders=Count('id'),
                avg_order_value=Avg('total_amount')
            ).order_by('date')
            
            recent_df = pd.DataFrame(list(recent_sales))
            
            predictions = []
            start_date = timezone.now().date()
            
            for i in range(days_ahead):
                pred_date = start_date + timedelta(days=i)
                
                # Calcular características para el día a predecir
                features = {
                    'month': pred_date.month,
                    'day': pred_date.day,
                    'day_of_week': pred_date.weekday(),
                    'day_of_year': pred_date.timetuple().tm_yday,
                    'week_of_year': pred_date.isocalendar()[1],
                    'is_weekend': 1 if pred_date.weekday() >= 5 else 0,
                    'quarter': (pred_date.month - 1) // 3 + 1,
                }
                
                # Características basadas en histórico
                if len(recent_df) > 0:
                    features['num_orders'] = float(recent_df['num_orders'].mean())
                    features['avg_order_value'] = float(recent_df['avg_order_value'].mean())
                    # Convertir Decimal a float para evitar errores
                    total_sales_series = recent_df['total_sales'].astype(float)
                    features['sales_7d_avg'] = float(total_sales_series.tail(7).mean())
                    features['sales_30d_avg'] = float(total_sales_series.mean())
                    features['sales_7d_std'] = float(total_sales_series.tail(7).std() or 0)
                    features['sales_lag_1'] = float(total_sales_series.iloc[-1] if len(recent_df) >= 1 else 0)
                    features['sales_lag_7'] = float(total_sales_series.iloc[-7] if len(recent_df) >= 7 else 0)
                    features['sales_lag_30'] = float(total_sales_series.iloc[-30] if len(recent_df) >= 30 else 0)
                else:
                    # Valores por defecto si no hay histórico
                    features.update({
                        'num_orders': 5,
                        'avg_order_value': 100.0,
                        'sales_7d_avg': 500.0,
                        'sales_30d_avg': 500.0,
                        'sales_7d_std': 50.0,
                        'sales_lag_1': 500.0,
                        'sales_lag_7': 500.0,
                        'sales_lag_30': 500.0
                    })
                
                # Predecir
                X_pred = pd.DataFrame([features])
                predicted_sales = self.model.predict(X_pred)[0]
                
                # Asegurar que la predicción no sea negativa
                predicted_sales = max(0, predicted_sales)
                
                # Estimar cantidad (basado en avg_order_value)
                predicted_quantity = int(predicted_sales / features['avg_order_value']) if features['avg_order_value'] > 0 else 0
                
                # Calcular intervalos de confianza (aproximado)
                confidence_margin = predicted_sales * 0.15  # 15% de margen
                
                predictions.append({
                    'date': pred_date.isoformat(),
                    'predicted_sales': float(predicted_sales),
                    'predicted_quantity': predicted_quantity,
                    'confidence_lower': float(max(0, predicted_sales - confidence_margin)),
                    'confidence_upper': float(predicted_sales + confidence_margin),
                    'features': features
                })
            
            logger.info(f"Predicciones generadas para {days_ahead} días")
            
            return {
                'success': True,
                'predictions': predictions,
                'summary': {
                    'total_predicted_sales': sum(p['predicted_sales'] for p in predictions),
                    'avg_daily_sales': sum(p['predicted_sales'] for p in predictions) / days_ahead,
                    'total_predicted_quantity': sum(p['predicted_quantity'] for p in predictions)
                }
            }
            
        except Exception as e:
            logger.error(f"Error prediciendo ventas futuras: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def save_model(self):
        """
        Guarda el modelo entrenado
        """
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            joblib.dump(self.model, self.model_path)
            logger.info(f"Modelo guardado en {self.model_path}")
            return True
        except Exception as e:
            logger.error(f"Error guardando modelo: {str(e)}")
            return False
    
    def load_model(self):
        """
        Carga el modelo desde archivo
        """
        try:
            if os.path.exists(self.model_path):
                self.model = joblib.load(self.model_path)
                logger.info("Modelo cargado exitosamente")
                return True
            else:
                logger.warning("No se encontró archivo de modelo")
                return False
        except Exception as e:
            logger.error(f"Error cargando modelo: {str(e)}")
            return False
