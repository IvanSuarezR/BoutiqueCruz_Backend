"""
Servicio de recomendación de productos usando Scikit-learn
"""
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from collections import defaultdict
import joblib
import os
from django.conf import settings
from django.db.models import Count, Sum, Q, F
from orders.models import Order, OrderItem
from products.models import Product
import logging

logger = logging.getLogger(__name__)


class ProductRecommendationService:
    """
    Servicio para recomendación de productos
    Usa collaborative filtering y content-based filtering
    """
    
    def __init__(self):
        self.model_path = os.path.join(settings.BASE_DIR, 'ml_predictions', 'ml_models', 'product_recommendation.pkl')
        self.similarity_matrix = None
        self.product_ids = []
        
    def train_model(self):
        """
        Entrena el modelo de recomendación basado en:
        1. Productos comprados juntos (collaborative filtering)
        2. Similitud de productos (content-based)
        """
        try:
            logger.info("Iniciando entrenamiento de modelo de recomendaciones...")
            
            # 1. COLLABORATIVE FILTERING - Productos comprados juntos
            co_purchase_matrix = self._build_co_purchase_matrix()
            
            # 2. CONTENT-BASED - Similitud por atributos
            content_similarity = self._build_content_similarity()
            
            # 3. Combinar ambas matrices (híbrido)
            if co_purchase_matrix is not None and content_similarity is not None:
                # Pesos: 70% collaborative, 30% content-based
                combined_similarity = 0.7 * co_purchase_matrix + 0.3 * content_similarity
            elif co_purchase_matrix is not None:
                combined_similarity = co_purchase_matrix
            elif content_similarity is not None:
                combined_similarity = content_similarity
            else:
                raise ValueError("No se pudo construir ninguna matriz de similitud")
            
            self.similarity_matrix = combined_similarity
            
            # Guardar modelo
            self.save_model()
            
            metrics = {
                'total_products': len(self.product_ids),
                'matrix_shape': self.similarity_matrix.shape,
                'avg_similarity': float(np.mean(self.similarity_matrix)),
                'method': 'hybrid' if co_purchase_matrix is not None and content_similarity is not None else 'single'
            }
            
            logger.info(f"Modelo de recomendaciones entrenado exitosamente: {metrics}")
            
            return {
                'success': True,
                'metrics': metrics
            }
            
        except Exception as e:
            logger.error(f"Error entrenando modelo de recomendaciones: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _build_co_purchase_matrix(self):
        """
        Construye matriz de co-compra (qué productos se compran juntos)
        """
        try:
            # Obtener todos los productos activos
            products = list(Product.objects.filter(status='active').values_list('id', flat=True))
            
            if len(products) < 2:
                logger.warning("Muy pocos productos para crear matriz de co-compra")
                return None
            
            self.product_ids = [str(p) for p in products]
            n_products = len(products)
            
            # Crear diccionario producto -> índice
            product_to_idx = {str(pid): idx for idx, pid in enumerate(products)}
            
            # Matriz de co-ocurrencia
            co_occurrence = np.zeros((n_products, n_products))
            
            # Obtener órdenes completadas
            orders = Order.objects.filter(
                status__in=['delivered', 'completed']
            ).prefetch_related('items__product')
            
            order_count = 0
            for order in orders:
                items = order.items.all()
                product_ids_in_order = [str(item.product_id) for item in items if str(item.product_id) in product_to_idx]
                
                # Incrementar co-ocurrencia para cada par de productos
                for i, pid1 in enumerate(product_ids_in_order):
                    for pid2 in product_ids_in_order[i:]:
                        idx1 = product_to_idx[pid1]
                        idx2 = product_to_idx[pid2]
                        co_occurrence[idx1][idx2] += 1
                        if idx1 != idx2:
                            co_occurrence[idx2][idx1] += 1
                
                order_count += 1
            
            if order_count == 0:
                logger.warning("No hay órdenes para construir matriz de co-compra")
                return None
            
            # Normalizar a similitud (cosine-like)
            # Evitar división por cero
            row_sums = co_occurrence.sum(axis=1, keepdims=True)
            row_sums[row_sums == 0] = 1
            similarity = co_occurrence / row_sums
            
            logger.info(f"Matriz de co-compra creada: {similarity.shape}, órdenes analizadas: {order_count}")
            return similarity
            
        except Exception as e:
            logger.error(f"Error construyendo matriz de co-compra: {str(e)}")
            return None
    
    def _build_content_similarity(self):
        """
        Construye matriz de similitud basada en atributos de productos
        """
        try:
            # Obtener productos con sus atributos
            products = Product.objects.filter(status='active').select_related('category', 'brand')
            
            if products.count() < 2:
                return None
            
            # Crear features para cada producto
            features_list = []
            product_ids_list = []
            
            for product in products:
                features = {
                    'price': float(product.price),
                    'category_id': str(product.category_id) if product.category_id else 'none',
                    'brand_id': str(product.brand_id) if product.brand_id else 'none',
                    'gender': product.target_gender or 'unisex',
                    'season': getattr(product.category, 'season', None) or 'all',
                }
                features_list.append(features)
                product_ids_list.append(str(product.id))
            
            # Convertir a DataFrame
            df = pd.DataFrame(features_list)
            
            # One-hot encoding para categorías
            df_encoded = pd.get_dummies(df, columns=['category_id', 'brand_id', 'gender', 'season'])
            
            # Normalizar precios
            scaler = StandardScaler()
            if 'price' in df_encoded.columns:
                df_encoded['price'] = scaler.fit_transform(df_encoded[['price']])
            
            # Calcular similitud coseno
            similarity = cosine_similarity(df_encoded)
            
            self.product_ids = product_ids_list
            
            logger.info(f"Matriz de similitud por contenido creada: {similarity.shape}")
            return similarity
            
        except Exception as e:
            logger.error(f"Error construyendo similitud por contenido: {str(e)}")
            return None
    
    def get_recommendations(self, product_id, top_n=10):
        """
        Obtiene recomendaciones para un producto específico
        """
        try:
            if self.similarity_matrix is None:
                self.load_model()
            
            if self.similarity_matrix is None:
                raise ValueError("No hay modelo entrenado. Por favor entrena el modelo primero.")
            
            product_id_str = str(product_id)
            
            if product_id_str not in self.product_ids:
                logger.warning(f"Producto {product_id} no encontrado en el modelo")
                return self._get_popular_products(top_n)
            
            # Obtener índice del producto
            idx = self.product_ids.index(product_id_str)
            
            # Obtener similitudes
            similarities = self.similarity_matrix[idx]
            
            # Ordenar por similitud (excluyendo el mismo producto)
            similar_indices = np.argsort(similarities)[::-1]
            similar_indices = [i for i in similar_indices if i != idx][:top_n]
            
            # Obtener productos recomendados
            recommendations = []
            for i, similar_idx in enumerate(similar_indices):
                rec_product_id = self.product_ids[similar_idx]
                similarity_score = float(similarities[similar_idx])
                
                try:
                    product = Product.objects.get(id=rec_product_id, status='active')
                    # Obtener primera imagen del campo JSONField
                    image_url = product.images[0] if product.images and len(product.images) > 0 else None
                    recommendations.append({
                        'product_id': rec_product_id,
                        'product_name': product.name,
                        'similarity_score': similarity_score,
                        'price': float(product.price),
                        'image_url': image_url,
                        'rank': i + 1
                    })
                except Product.DoesNotExist:
                    continue
            
            return {
                'success': True,
                'source_product_id': product_id_str,
                'recommendations': recommendations
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo recomendaciones: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _get_popular_products(self, top_n=10):
        """
        Retorna productos populares como fallback
        """
        try:
            popular = Product.objects.filter(status='active').annotate(
                order_count=Count('orderitem')
            ).order_by('-order_count')[:top_n]
            
            recommendations = []
            for i, product in enumerate(popular):
                # Obtener primera imagen del campo JSONField
                image_url = product.images[0] if product.images and len(product.images) > 0 else None
                recommendations.append({
                    'product_id': str(product.id),
                    'product_name': product.name,
                    'similarity_score': 0.5,  # Score neutro
                    'price': float(product.price),
                    'image_url': image_url,
                    'rank': i + 1,
                    'reason': 'popular_product'
                })
            
            return {
                'success': True,
                'recommendations': recommendations,
                'fallback': True
            }
        except Exception as e:
            logger.error(f"Error obteniendo productos populares: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_cross_sell_opportunities(self):
        """
        Identifica oportunidades de venta cruzada
        """
        try:
            if self.similarity_matrix is None:
                self.load_model()
            
            if self.similarity_matrix is None:
                raise ValueError("No hay modelo entrenado")
            
            opportunities = []
            
            # Para cada producto, encontrar los mejores complementos
            for idx, product_id in enumerate(self.product_ids):
                similarities = self.similarity_matrix[idx]
                top_complementary_idx = np.argsort(similarities)[::-1][1:4]  # Top 3, excluyendo él mismo
                
                for comp_idx in top_complementary_idx:
                    if similarities[comp_idx] > 0.3:  # Umbral de similitud
                        opportunities.append({
                            'product_a': product_id,
                            'product_b': self.product_ids[comp_idx],
                            'score': float(similarities[comp_idx])
                        })
            
            # Ordenar por score
            opportunities.sort(key=lambda x: x['score'], reverse=True)
            
            return {
                'success': True,
                'opportunities': opportunities[:50]  # Top 50
            }
            
        except Exception as e:
            logger.error(f"Error obteniendo oportunidades de cross-sell: {str(e)}")
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
            model_data = {
                'similarity_matrix': self.similarity_matrix,
                'product_ids': self.product_ids
            }
            joblib.dump(model_data, self.model_path)
            logger.info(f"Modelo de recomendaciones guardado en {self.model_path}")
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
                self.similarity_matrix = model_data['similarity_matrix']
                self.product_ids = model_data['product_ids']
                logger.info("Modelo de recomendaciones cargado exitosamente")
                return True
            else:
                logger.warning("No se encontró archivo de modelo de recomendaciones")
                return False
        except Exception as e:
            logger.error(f"Error cargando modelo: {str(e)}")
            return False
