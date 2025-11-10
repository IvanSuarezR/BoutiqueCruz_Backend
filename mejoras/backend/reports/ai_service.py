"""
Servicio de IA para generación dinámica de reportes
Usa Groq (Llama 3.3) para interpretación y generación de SQL
"""

import os
import json
from typing import Dict, Any, Optional, List
from groq import Groq
from django.conf import settings
import re


class AIReportService:
    """
    Servicio para generar reportes usando IA (Groq + Llama 3.3)
    """
    
    def __init__(self):
        # Inicialización compatible con Groq SDK moderno (sin argumentos obsoletos)
        self.client = Groq(api_key=settings.GROQ_API_KEY)
        # Modelo actualizado de Groq (LLaMA 3.3 70B es el más reciente y potente)
        self.model = "llama-3.3-70b-versatile"
        # Schema de la base de datos para contexto
        self.db_schema = self._load_db_schema()
    
    def _load_db_schema(self) -> str:
        """
        Carga el schema de la BD para que la IA entienda la estructura
        """
        return """
        SCHEMA DE LA BASE DE DATOS (PostgreSQL):
        
        ## TABLA: custom_auth_user (Usuarios/Clientes/Empleados)
        - id (UUID) PK
        - email (VARCHAR) UNIQUE
        - username (VARCHAR) UNIQUE
        - first_name (VARCHAR)
        - last_name (VARCHAR)
        - role (VARCHAR): 'customer', 'employee', 'admin', 'manager'
        - is_active (BOOLEAN)
        - is_staff (BOOLEAN)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        
        ## TABLA: products_product (Productos)
        - id (UUID) PK
        - name (VARCHAR)
        - description (TEXT)
        - sku (VARCHAR) UNIQUE
        - price (DECIMAL)
        - cost_price (DECIMAL)
        - category_id (UUID) FK -> products_category
        - brand_id (UUID) FK -> products_brand
        - target_gender (VARCHAR): 'men', 'women', 'unisex', 'kids'
        - status (VARCHAR): 'active', 'inactive', 'discontinued', 'out_of_stock'
        - is_featured (BOOLEAN)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        
        ## TABLA: products_productvariant (Variantes de Producto)
        - id (UUID) PK
        - product_id (UUID) FK -> products_product
        - size_id (UUID) FK -> products_size
        - color_id (UUID) FK -> products_color
        - sku_variant (VARCHAR) UNIQUE
        - stock_quantity (INTEGER)
        - is_active (BOOLEAN)
        - created_at (TIMESTAMP)
        
        ## TABLA: products_category (Categorías)
        - id (UUID) PK
        - name (VARCHAR)
        - slug (VARCHAR) UNIQUE
        - category_type (VARCHAR): 'clothing', 'footwear', 'accessories', 'underwear', 'sportswear'
        - is_active (BOOLEAN)
        
        ## TABLA: products_brand (Marcas)
        - id (UUID) PK
        - name (VARCHAR) UNIQUE
        - is_active (BOOLEAN)
        
        ## TABLA: products_color (Colores)
        - id (UUID) PK
        - name (VARCHAR) UNIQUE
        - hex_code (VARCHAR)
        
        ## TABLA: products_size (Tallas)
        - id (UUID) PK
        - name (VARCHAR)
        - size_type (VARCHAR): 'clothing', 'shoes', 'accessories'
        
        ## TABLA: orders_order (Órdenes/Ventas)
        - id (UUID) PK
        - order_number (VARCHAR) UNIQUE
        - customer_id (UUID) FK -> custom_auth_user
        - processed_by_id (UUID) FK -> custom_auth_user [Empleado]
        - order_type (VARCHAR): 'online', 'in_store', 'phone'
        - status (VARCHAR): 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
        - subtotal (DECIMAL)
        - tax_amount (DECIMAL)
        - discount_amount (DECIMAL)
        - shipping_cost (DECIMAL)
        - total_amount (DECIMAL)
        - created_at (TIMESTAMP)
        - confirmed_at (TIMESTAMP)
        - delivered_at (TIMESTAMP)
        
        ## TABLA: orders_orderitem (Items de Orden)
        - id (UUID) PK
        - order_id (UUID) FK -> orders_order
        - product_id (UUID) FK -> products_product
        - product_variant_id (UUID) FK -> products_productvariant
        - product_name (VARCHAR)
        - product_sku (VARCHAR)
        - quantity (INTEGER)
        - unit_price (DECIMAL)
        - total_price (DECIMAL)
        - created_at (TIMESTAMP)
        
        ## TABLA: orders_payment (Pagos)
        - id (UUID) PK
        - order_id (UUID) FK -> orders_order
        - payment_method_id (UUID) FK -> orders_paymentmethod
        - amount (DECIMAL)
        - status (VARCHAR): 'pending', 'completed', 'failed', 'cancelled', 'refunded'
        - processed_at (TIMESTAMP)
        - transaction_id (VARCHAR)
        - processed_by_id (UUID) FK -> custom_auth_user
        - created_at (TIMESTAMP)
        
        ## TABLA: orders_paymentmethod (Métodos de Pago)
        - id (UUID) PK
        - name (VARCHAR)
        - payment_type (VARCHAR): 'cash', 'credit_card', 'debit_card', 'bank_transfer', 'mobile_payment', 'store_credit'
        - is_active (BOOLEAN)
        
        ## TABLA: orders_invoice (Facturas)
        - id (UUID) PK
        - invoice_number (VARCHAR) UNIQUE
        - order_id (UUID) FK -> orders_order
        - customer_id (UUID) FK -> custom_auth_user
        - created_by_id (UUID) FK -> custom_auth_user [Empleado]
        - subtotal (DECIMAL)
        - tax_amount (DECIMAL)
        - total_amount (DECIMAL)
        - tax_rate (DECIMAL)
        - issue_date (DATE)
        - due_date (DATE)
        - status (VARCHAR): 'draft', 'sent', 'paid', 'overdue', 'cancelled'
        - created_at (TIMESTAMP)
        
        NOTAS IMPORTANTES:
        - Usa alias de tabla para claridad (ej: o para orders_order, u para custom_auth_user)
        - Para fechas usa DATE_TRUNC o intervalos como: created_at >= NOW() - INTERVAL '30 days'
        - Todos los campos monetarios son DECIMAL
        - Los JOIN deben usar los campos FK correctos
        - Usa LIMIT para limitar resultados grandes
        """
    
    def interpret_prompt(self, user_prompt: str) -> Dict[str, Any]:
        """
        Interpreta el prompt del usuario y genera SQL
        
        Returns:
            {
                'report_type': str,
                'sql_query': str,
                'parameters': dict,
                'explanation': str,
                'suggested_chart_type': str
            }
        """
        
        system_message = f"""Eres un experto analista de datos para una tienda de ropa (e-commerce + tienda física).

{self.db_schema}

Tu trabajo es interpretar solicitudes en lenguaje natural y convertirlas en consultas SQL DE SOLO LECTURA.

⚠️ REGLAS CRÍTICAS DE SEGURIDAD:
- SOLO puedes generar queries SELECT (lectura de datos)
- NUNCA uses: CREATE, INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT, REVOKE
- NO modifiques la base de datos de ninguna forma
- Si el usuario pide crear/modificar/eliminar algo, responde con un SELECT que muestre datos relacionados

REGLAS IMPORTANTES:
1. Usa SOLO las tablas mencionadas en el schema
2. Todos los queries deben empezar con SELECT
3. Incluye JOINs necesarios para obtener información completa
4. Usa funciones de agregación cuando sea apropiado (SUM, COUNT, AVG, MAX, MIN)
5. Incluye ORDER BY y LIMIT si es relevante
6. Usa aliases descriptivos para las columnas
7. Para fechas, usa NOW() - INTERVAL '30 days' (PostgreSQL)
8. Para contar registros usa COUNT(*) o COUNT(DISTINCT campo)
9. Responde SOLO en formato JSON válido

FORMATO DE RESPUESTA (JSON):
{{
    "report_type": "sales|inventory|customers|financial|products",
    "sql_query": "SELECT ...",
    "parameters": {{}},
    "explanation": "Explicación clara de qué muestra el reporte",
    "suggested_chart_type": "bar|line|pie|table",
    "filters_applied": ["filtro1", "filtro2"]
}}

EJEMPLOS DE CONSULTAS CORRECTAS:

1. Prompt: "Ventas del último mes"
Respuesta:
{{
    "report_type": "sales",
    "sql_query": "SELECT DATE(o.created_at) as fecha, COUNT(*) as total_ordenes, SUM(o.total_amount) as ventas_totales FROM orders_order o WHERE o.created_at >= NOW() - INTERVAL '30 days' AND o.status IN ('confirmed', 'delivered', 'shipped') GROUP BY DATE(o.created_at) ORDER BY fecha DESC",
    "parameters": {{}},
    "explanation": "Ventas diarias del último mes (órdenes confirmadas, enviadas y entregadas)",
    "suggested_chart_type": "line",
    "filters_applied": ["últimos 30 días", "órdenes completadas"]
}}

2. Prompt: "Top 10 productos más vendidos"
Respuesta:
{{
    "report_type": "products",
    "sql_query": "SELECT p.name as producto, p.sku, SUM(oi.quantity) as unidades_vendidas, SUM(oi.total_price) as ingresos_totales FROM orders_orderitem oi JOIN products_product p ON oi.product_id = p.id JOIN orders_order o ON oi.order_id = o.id WHERE o.status IN ('confirmed', 'delivered') GROUP BY p.id, p.name, p.sku ORDER BY unidades_vendidas DESC LIMIT 10",
    "parameters": {{}},
    "explanation": "Los 10 productos más vendidos (por unidades)",
    "suggested_chart_type": "bar",
    "filters_applied": ["top 10", "órdenes completadas"]
}}

3. Prompt: "Clientes con más compras"
Respuesta:
{{
    "report_type": "customers",
    "sql_query": "SELECT u.first_name || ' ' || u.last_name as cliente, u.email, COUNT(o.id) as total_compras, SUM(o.total_amount) as gasto_total FROM custom_auth_user u JOIN orders_order o ON u.id = o.customer_id WHERE o.status != 'cancelled' GROUP BY u.id, u.first_name, u.last_name, u.email ORDER BY total_compras DESC LIMIT 20",
    "parameters": {{}},
    "explanation": "Top 20 clientes por número de compras realizadas",
    "suggested_chart_type": "table",
    "filters_applied": ["top 20", "compras no canceladas"]
}}
"""
        
        user_message = f"""Genera la consulta SQL para este reporte:

"{user_prompt}"

Responde SOLO con el JSON, sin texto adicional."""
        
        try:
            # Llamada a Groq API
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                model=self.model,
                temperature=0.1,
                max_tokens=2000,
            )
            
            response_text = chat_completion.choices[0].message.content
            
            # DEBUG: Imprimir respuesta de la IA
            print("=" * 70)
            print("🤖 RESPUESTA DE LA IA:")
            print(response_text)
            print("=" * 70)
            
            # Extraer JSON de la respuesta
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                response_json = json.loads(json_match.group())
            else:
                response_json = json.loads(response_text)
            
            # DEBUG: Imprimir SQL generado
            print(f"📝 SQL GENERADO: {response_json.get('sql_query', 'N/A')}")
            print("=" * 70)
            
            # Agregar metadata
            response_json['tokens_used'] = chat_completion.usage.total_tokens
            
            return response_json
            
        except Exception as e:
            raise Exception(f"Error al interpretar prompt con IA: {str(e)}")
    
    def validate_sql_safety(self, sql_query: str) -> bool:
        """
        Validación de seguridad SQL
        Bloquea comandos peligrosos pero permite nombres de columnas como created_at
        """
        # Comandos SQL peligrosos (como palabras completas, no parte de nombres)
        dangerous_patterns = [
            r'\bDROP\b',
            r'\bDELETE\b', 
            r'\bTRUNCATE\b',
            r'\bINSERT\b',
            r'\bUPDATE\b',
            r'\bALTER\b',
            r'\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW)',  # Solo CREATE como comando, no created_at
            r'\bEXEC\b',
            r'\bEXECUTE\b',
            r'--',  # Comentarios SQL
            r';--', # Inyección SQL
        ]
        
        sql_upper = sql_query.upper()
        
        for pattern in dangerous_patterns:
            if re.search(pattern, sql_upper):
                raise ValueError(f"SQL contiene patrón prohibido: {pattern}")
        
        # Verificar que empiece con SELECT
        if not sql_upper.strip().startswith('SELECT'):
            raise ValueError("Solo se permiten consultas SELECT")
        
        return True
    
    def generate_report_summary(self, prompt: str, results: List[Dict]) -> str:
        """
        Genera un resumen narrativo del reporte usando IA
        """
        
        system_message = """Eres un analista de datos experto. 
        Genera un resumen ejecutivo corto (2-3 párrafos) basado en los resultados del reporte.
        Incluye insights clave y tendencias relevantes.
        Usa un tono profesional pero accesible."""
        
        results_preview = results[:10] if len(results) > 10 else results
        
        user_message = f"""Prompt original: "{prompt}"

Resultados (primeros {len(results_preview)} de {len(results)} total):
{json.dumps(results_preview, indent=2, default=str)}

Genera un resumen ejecutivo."""
        
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                model=self.model,
                temperature=0.3,
                max_tokens=500,
            )
            
            return chat_completion.choices[0].message.content
            
        except Exception as e:
            return f"Reporte generado con {len(results)} resultados."
