"""
Servicio de segmentación de clientes usando Scikit-learn
"""
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from datetime import datetime, timedelta
import joblib
import os
from django.conf import settings
from django.db.models import Sum, Count, Avg, F, Max
from django.contrib.auth import get_user_model
from orders.models import Order
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class CustomerSegmentationService:
    """
    Servicio para segmentación de clientes usando K-Means
    Segmenta clientes en: VIP, Frecuente, Ocasional, En Riesgo, Nuevo, Inactivo
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.model_path = os.path.join(settings.BASE_DIR, 'ml_predictions', 'ml_models', 'customer_segmentation.pkl')
        
    def prepare_customer_features(self):
        """
        Prepara features de clientes para clustering (RFM + adicionales)
        """
        try:
            from django.utils import timezone
            
            # Obtener clientes con al menos una compra
            customers = User.objects.filter(
                role='customer',
                orders__status__in=['delivered', 'completed']
            ).annotate(
                total_orders=Count('orders'),
                total_spent=Sum('orders__total_amount'),
                avg_order_value=Avg('orders__total_amount'),
                last_order_date=Max('orders__created_at')
            ).filter(total_orders__gt=0)
            
            if customers.count() < 5:
                logger.warning("Muy pocos clientes para segmentación")
                return None
            
            features_list = []
            customer_ids = []
            
            today = timezone.now()
            
            for customer in customers:
                # Calcular Recency (días desde última compra)
                recency = (today - customer.last_order_date).days if customer.last_order_date else 999
                
                # Calcular Frequency (número de compras)
                frequency = customer.total_orders
                
                # Calcular Monetary (total gastado)
                monetary = float(customer.total_spent or 0)
                
                # Features adicionales
                avg_order = float(customer.avg_order_value or 0)
                
                # Días desde registro
                days_since_registration = (today - customer.date_joined).days if customer.date_joined else 0
                
                # Purchase frequency (compras por mes activo)
                months_active = max(1, days_since_registration / 30)
                purchase_frequency = frequency / months_active
                
                features = {
                    'recency': recency,
                    'frequency': frequency,
                    'monetary': monetary,
                    'avg_order_value': avg_order,
                    'days_since_registration': days_since_registration,
                    'purchase_frequency_monthly': purchase_frequency
                }
                
                features_list.append(features)
                customer_ids.append(str(customer.id))
            
            df = pd.DataFrame(features_list)
            
            logger.info(f"Features preparados para {len(df)} clientes")
            
            return df, customer_ids
            
        except Exception as e:
            logger.error(f"Error preparando features de clientes: {str(e)}")
            return None, None
    
    def train_model(self, n_clusters=6):
        """
        Entrena el modelo de segmentación con K-Means
        """
        try:
            df, customer_ids = self.prepare_customer_features()
            
            if df is None or len(df) < n_clusters:
                raise ValueError(f"Datos insuficientes para {n_clusters} clusters")
            
            # Escalar features
            X_scaled = self.scaler.fit_transform(df)
            
            # Entrenar K-Means
            self.model = KMeans(
                n_clusters=n_clusters,
                init='k-means++',
                n_init=10,
                max_iter=300,
                random_state=42
            )
            
            logger.info(f"Entrenando K-Means con {n_clusters} clusters...")
            clusters = self.model.fit_predict(X_scaled)
            
            # Agregar clusters al DataFrame
            df['cluster'] = clusters
            
            # Analizar características de cada cluster
            cluster_profiles = self._analyze_clusters(df)
            
            # Asignar nombres descriptivos a clusters
            cluster_names = self._assign_cluster_names(cluster_profiles)
            
            # Calcular métricas
            inertia = self.model.inertia_
            silhouette_score = self._calculate_silhouette_score(X_scaled, clusters)
            
            metrics = {
                'n_clusters': n_clusters,
                'n_customers': len(df),
                'inertia': float(inertia),
                'silhouette_score': float(silhouette_score),
                'cluster_sizes': {str(k): int(v) for k, v in df['cluster'].value_counts().to_dict().items()},
                'cluster_profiles': cluster_profiles,
                'cluster_names': cluster_names
            }
            
            # Guardar modelo
            self.save_model()
            
            logger.info(f"Modelo de segmentación entrenado: {metrics}")
            
            return {
                'success': True,
                'metrics': metrics,
                'customer_ids': customer_ids,
                'clusters': clusters.tolist()
            }
            
        except Exception as e:
            logger.error(f"Error entrenando modelo de segmentación: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _analyze_clusters(self, df):
        """
        Analiza características promedio de cada cluster
        """
        profiles = {}
        for cluster_id in df['cluster'].unique():
            cluster_data = df[df['cluster'] == cluster_id]
            
            profiles[int(cluster_id)] = {
                'size': len(cluster_data),
                'avg_recency': float(cluster_data['recency'].mean()),
                'avg_frequency': float(cluster_data['frequency'].mean()),
                'avg_monetary': float(cluster_data['monetary'].mean()),
                'avg_order_value': float(cluster_data['avg_order_value'].mean()),
                'avg_purchase_frequency': float(cluster_data['purchase_frequency_monthly'].mean())
            }
        
        return profiles
    
    def _assign_cluster_names(self, profiles):
        """
        Asigna nombres descriptivos a cada cluster basado en RFM
        """
        cluster_names = {}
        
        for cluster_id, profile in profiles.items():
            recency = profile['avg_recency']
            frequency = profile['avg_frequency']
            monetary = profile['avg_monetary']
            
            # Lógica de clasificación
            if monetary > 1000 and frequency > 5 and recency < 30:
                name = 'vip'
            elif frequency > 3 and recency < 60:
                name = 'frequent'
            elif frequency <= 2 and recency < 90:
                name = 'occasional'
            elif recency > 180:
                name = 'inactive'
            elif frequency <= 2 and recency > 60 and recency < 180:
                name = 'at_risk'
            else:
                name = 'new'
            
            cluster_names[cluster_id] = name
        
        return cluster_names
    
    def _calculate_silhouette_score(self, X, labels):
        """
        Calcula el Silhouette Score (métrica de calidad del clustering)
        """
        try:
            from sklearn.metrics import silhouette_score
            return silhouette_score(X, labels)
        except:
            return 0.0
    
    def predict_customer_segment(self, customer_id):
        """
        Predice el segmento de un cliente específico
        """
        try:
            if self.model is None:
                self.load_model()
            
            if self.model is None:
                raise ValueError("No hay modelo entrenado")
            
            # Obtener features del cliente
            customer = User.objects.filter(id=customer_id).annotate(
                total_orders=Count('orders', filter=Q(orders__status__in=['delivered', 'completed'])),
                total_spent=Sum('orders__total_amount', filter=Q(orders__status__in=['delivered', 'completed'])),
                avg_order_value=Avg('orders__total_amount', filter=Q(orders__status__in=['delivered', 'completed'])),
                last_order_date=Max('orders__created_at', filter=Q(orders__status__in=['delivered', 'completed']))
            ).first()
            
            if not customer:
                raise ValueError(f"Cliente {customer_id} no encontrado")
            
            today = datetime.now()
            recency = (today - customer.last_order_date).days if customer.last_order_date else 999
            frequency = customer.total_orders or 0
            monetary = float(customer.total_spent or 0)
            avg_order = float(customer.avg_order_value or 0)
            days_since_reg = (today - customer.date_joined).days if customer.date_joined else 0
            months_active = max(1, days_since_reg / 30)
            purchase_freq = frequency / months_active
            
            features = [[recency, frequency, monetary, avg_order, days_since_reg, purchase_freq]]
            
            # Escalar y predecir
            X_scaled = self.scaler.transform(features)
            cluster = self.model.predict(X_scaled)[0]
            
            # Determinar tipo de segmento
            segment_type = self._determine_segment_type(recency, frequency, monetary)
            
            # Generar recomendaciones
            recommendations = self._generate_recommendations(segment_type, recency, frequency, monetary)
            
            # Estimar Lifetime Value
            ltv = self._estimate_lifetime_value(frequency, monetary, days_since_reg)
            
            result = {
                'success': True,
                'customer_id': str(customer_id),
                'cluster': int(cluster),
                'segment_type': segment_type,
                'confidence_score': 0.85,  # Placeholder
                'characteristics': {
                    'recency_days': recency,
                    'total_orders': frequency,
                    'total_spent': monetary,
                    'avg_order_value': avg_order,
                    'purchase_frequency_monthly': purchase_freq
                },
                'lifetime_value_prediction': ltv,
                'recommendations': recommendations
            }
            
            return result
            
        except Exception as e:
            logger.error(f"Error prediciendo segmento de cliente: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _determine_segment_type(self, recency, frequency, monetary):
        """
        Determina el tipo de segmento basado en RFM
        """
        if monetary > 1000 and frequency > 5 and recency < 30:
            return 'vip'
        elif frequency > 3 and recency < 60:
            return 'frequent'
        elif frequency <= 2 and recency < 90:
            return 'occasional'
        elif recency > 180:
            return 'inactive'
        elif frequency <= 2 and recency > 60 and recency < 180:
            return 'at_risk'
        else:
            return 'new'
    
    def _generate_recommendations(self, segment_type, recency, frequency, monetary):
        """
        Genera recomendaciones de marketing según el segmento
        """
        recommendations = {
            'vip': [
                "Ofrecer descuentos exclusivos VIP",
                "Acceso anticipado a nuevas colecciones",
                "Programa de lealtad premium",
                "Eventos exclusivos"
            ],
            'frequent': [
                "Programa de puntos de fidelidad",
                "Descuentos por compra frecuente",
                "Notificaciones de nuevos productos",
                "Encuestas de satisfacción"
            ],
            'occasional': [
                "Campañas de reactivación",
                "Descuentos especiales para próxima compra",
                "Recordatorios de productos vistos",
                "Newsletter con novedades"
            ],
            'at_risk': [
                "Campaña urgente de recuperación",
                "Descuento significativo",
                "Contacto personalizado",
                "Encuesta para entender abandono"
            ],
            'new': [
                "Bienvenida personalizada",
                "Guía de productos",
                "Descuento en segunda compra",
                "Seguimiento post-primera compra"
            ],
            'inactive': [
                "Campaña de reconquista agresiva",
                "Oferta especial de regreso",
                "Recordar beneficios de la tienda",
                "Actualizar preferencias"
            ]
        }
        
        return recommendations.get(segment_type, ["Realizar seguimiento general"])
    
    def _estimate_lifetime_value(self, frequency, monetary, days_active):
        """
        Estima el Customer Lifetime Value
        """
        if frequency == 0 or days_active == 0:
            return 0.0
        
        # CLV simple = (Average Order Value) × (Purchase Frequency) × (Customer Lifespan)
        avg_order = monetary / frequency if frequency > 0 else 0
        purchases_per_month = frequency / (days_active / 30) if days_active > 0 else 0
        estimated_lifespan_months = 24  # Asumir 2 años
        
        clv = avg_order * purchases_per_month * estimated_lifespan_months
        return float(clv)
    
    def segment_all_customers(self):
        """
        Segmenta todos los clientes activos
        """
        try:
            if self.model is None:
                self.load_model()
            
            if self.model is None:
                raise ValueError("No hay modelo entrenado")
            
            df, customer_ids = self.prepare_customer_features()
            
            if df is None:
                raise ValueError("No se pudieron preparar features")
            
            X_scaled = self.scaler.transform(df)
            clusters = self.model.predict(X_scaled)
            
            results = []
            for i, customer_id in enumerate(customer_ids):
                segment_type = self._determine_segment_type(
                    df.iloc[i]['recency'],
                    df.iloc[i]['frequency'],
                    df.iloc[i]['monetary']
                )
                
                results.append({
                    'customer_id': customer_id,
                    'cluster': int(clusters[i]),
                    'segment_type': segment_type,
                    'characteristics': df.iloc[i].to_dict()
                })
            
            return {
                'success': True,
                'total_customers': len(results),
                'segments': results
            }
            
        except Exception as e:
            logger.error(f"Error segmentando todos los clientes: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def save_model(self):
        """
        Guarda el modelo y el scaler
        """
        try:
            os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
            model_data = {
                'model': self.model,
                'scaler': self.scaler
            }
            joblib.dump(model_data, self.model_path)
            logger.info(f"Modelo de segmentación guardado en {self.model_path}")
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
                model_data = joblib.load(self.model_path)
                self.model = model_data['model']
                self.scaler = model_data['scaler']
                logger.info("Modelo de segmentación cargado exitosamente")
                return True
            else:
                logger.warning("No se encontró archivo de modelo de segmentación")
                return False
        except Exception as e:
            logger.error(f"Error cargando modelo: {str(e)}")
            return False


from django.db.models import Q
