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
        
        ## TABLA: accounts_customuser (Usuarios del Sistema)
        - id (INTEGER) PK
        - username (VARCHAR) UNIQUE
        - email (VARCHAR) UNIQUE
        - first_name (VARCHAR)
        - last_name (VARCHAR)
        - identification_number (VARCHAR) UNIQUE - Número de Identificación (CI)
        - phone (VARCHAR)
        - gender (VARCHAR): 'M' (Masculino), 'F' (Femenino), 'O' (Otro)
        - address (TEXT)
        - user_type (VARCHAR): 'admin', 'seller', 'customer', 'supplier'
        - is_active (BOOLEAN)
        - is_staff (BOOLEAN)
        - is_superuser (BOOLEAN)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        
        ## TABLA: inventory_category (Categorías de Productos)
        - id (INTEGER) PK
        - name (VARCHAR) UNIQUE
        - description (TEXT)
        - gender (VARCHAR): 'M' (Hombre), 'F' (Mujer), 'U' (Unisex)
        - kind (VARCHAR): 'V' (Vestir), 'Z' (Calzado)
        - sizes (JSON) - Lista de tallas sugeridas
        - is_active (BOOLEAN)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        
        ## TABLA: inventory_product (Productos)
        - id (INTEGER) PK
        - sku (VARCHAR) UNIQUE - Código del producto
        - name (VARCHAR) - Nombre del producto
        - category_id (INTEGER) FK -> inventory_category
        - gender (VARCHAR): 'M', 'F', 'U' (si no está definido, usa el de la categoría)
        - price (DECIMAL) - Precio de venta
        - stock (INTEGER) - Stock total (agregado de variantes)
        - description (TEXT)
        - color (VARCHAR) - Color principal (campo legacy)
        - colors (JSON) - Lista de colores disponibles
        - sizes (JSON) - Lista de tallas disponibles
        - image (VARCHAR) - Ruta de imagen principal
        - is_active (BOOLEAN)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        
        ## TABLA: inventory_productimage (Imágenes de Productos)
        - id (INTEGER) PK
        - product_id (INTEGER) FK -> inventory_product
        - image (VARCHAR) - Ruta de la imagen
        - alt_text (VARCHAR)
        - is_primary (BOOLEAN) - Imagen principal
        - sort_order (INTEGER) - Orden de visualización
        - created_at (TIMESTAMP)
        
        ## TABLA: inventory_productvariant (Variantes de Producto por Talla)
        - id (INTEGER) PK
        - product_id (INTEGER) FK -> inventory_product
        - size (VARCHAR) - Talla (ej: 'S', 'M', 'L', '38', '40')
        - stock (INTEGER) - Stock de esta talla específica
        - sku (VARCHAR) - SKU de la variante (opcional)
        - created_at (TIMESTAMP)
        - updated_at (TIMESTAMP)
        - UNIQUE (product_id, size)
        
        ## TABLA: inventory_stockmovement (Movimientos de Inventario)
        - id (INTEGER) PK
        - product_id (INTEGER) FK -> inventory_product
        - created_by_id (INTEGER) FK -> accounts_customuser - Usuario que realizó el movimiento
        - movement_type (VARCHAR): 'IN' (Entrada), 'OUT' (Salida), 'ADJ' (Ajuste)
        - quantity (INTEGER) - Cantidad del movimiento
        - note (VARCHAR) - Nota del movimiento
        - created_at (TIMESTAMP)
        
        ## TABLA: orders_order (Órdenes de Compra)
        - id (INTEGER) PK
        - user_id (INTEGER) FK -> accounts_customuser - Cliente que realizó la orden
        - status (VARCHAR): 'DRAFT', 'PENDING_PAYMENT', 'PAID', 'AWAITING_DISPATCH', 'SHIPPED', 'DELIVERED', 'CANCELED', 'REFUNDED'
        - currency (VARCHAR) - Moneda (default 'BOB')
        - total_items (INTEGER) - Total de artículos
        - subtotal (DECIMAL) - Subtotal sin impuestos ni envío
        - shipping_cost (DECIMAL) - Costo de envío
        - payment_fee (DECIMAL) - Tarifa de procesamiento de pago
        - tax_total (DECIMAL) - Total de impuestos
        - grand_total (DECIMAL) - Total final de la orden
        - shipping_method_id (INTEGER) FK -> orders_shippingmethod
        - payment_method_id (INTEGER) FK -> orders_paymentmethod
        - shipping_address_id (INTEGER) FK -> orders_address
        - placed_at (TIMESTAMP) - Cuándo se confirmó la orden
        - paid_at (TIMESTAMP) - Cuándo se pagó
        - canceled_at (TIMESTAMP) - Cuándo se canceló
        - notes (TEXT) - Notas internas
        - customer_note (TEXT) - Nota del cliente
        - created_at (TIMESTAMP) - Cuándo se creó la orden (incluyendo borradores)
        - updated_at (TIMESTAMP)
        
        ## TABLA: orders_orderitem (Artículos de la Orden)
        - id (INTEGER) PK
        - order_id (INTEGER) FK -> orders_order
        - product_id (INTEGER) FK -> inventory_product
        - variant_id (INTEGER) FK -> inventory_productvariant (nullable)
        - quantity (INTEGER) - Cantidad pedida
        - unit_price (DECIMAL) - Precio unitario al momento de la compra
        - total_price (DECIMAL) - Precio total del ítem (quantity * unit_price)
        
        NOTAS IMPORTANTES:
        - Los productos tienen stock total (product.stock) y stock por talla (productvariant.stock)
        - Las categorías y productos tienen género: 'M'=Hombre, 'F'=Mujer, 'U'=Unisex
        - Los tipos de productos: 'V'=Vestir, 'Z'=Calzado
        - Los usuarios tienen tipos: 'admin', 'seller', 'customer', 'supplier'
        - Las tallas están en JSON y también en la tabla productvariant
        - ACTUALMENTE NO HAY MÓDULO DE VENTAS/ÓRDENES - Solo se pueden hacer reportes de inventario y productos
        - Para fechas usa DATE_TRUNC o intervalos como: created_at >= NOW() - INTERVAL '30 days'
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
    "report_type": "inventory|products|categories|users|stock",
    "sql_query": "SELECT ...",
    "parameters": {{}},
    "explanation": "Explicación clara de qué muestra el reporte",
    "suggested_chart_type": "bar|line|pie|table",
    "filters_applied": ["filtro1", "filtro2"]
}}

EJEMPLOS DE CONSULTAS CORRECTAS:

1. Prompt: "Productos con stock bajo"
Respuesta:
{{
    "report_type": "inventory",
    "sql_query": "SELECT p.name as producto, p.sku, p.stock, p.price, c.name as categoria FROM inventory_product p LEFT JOIN inventory_category c ON p.category_id = c.id WHERE p.stock < 10 AND p.is_active = true ORDER BY p.stock ASC LIMIT 20",
    "parameters": {{}},
    "explanation": "Productos activos con stock menor a 10 unidades",
    "suggested_chart_type": "table",
    "filters_applied": ["stock < 10", "productos activos"]
}}

2. Prompt: "Productos más caros por categoría"
Respuesta:
{{
    "report_type": "products",
    "sql_query": "SELECT c.name as categoria, p.name as producto, p.sku, p.price, p.stock FROM inventory_product p JOIN inventory_category c ON p.category_id = c.id WHERE p.is_active = true ORDER BY c.name, p.price DESC",
    "parameters": {{}},
    "explanation": "Listado de productos activos ordenados por categoría y precio (mayor a menor)",
    "suggested_chart_type": "table",
    "filters_applied": ["productos activos", "ordenado por precio"]
}}

3. Prompt: "Total de productos por categoría"
Respuesta:
{{
    "report_type": "categories",
    "sql_query": "SELECT c.name as categoria, COUNT(p.id) as total_productos, SUM(p.stock) as stock_total FROM inventory_category c LEFT JOIN inventory_product p ON c.id = p.category_id WHERE c.is_active = true GROUP BY c.id, c.name ORDER BY total_productos DESC",
    "parameters": {{}},
    "explanation": "Cantidad de productos y stock total por categoría activa",
    "suggested_chart_type": "bar",
    "filters_applied": ["categorías activas"]
}}

4. Prompt: "Movimientos de inventario de los últimos 7 días"
Respuesta:
{{
    "report_type": "stock",
    "sql_query": "SELECT DATE(sm.created_at) as fecha, sm.movement_type, p.name as producto, p.sku, sm.quantity, sm.reason, u.username as usuario FROM inventory_stockmovement sm JOIN inventory_product p ON sm.product_id = p.id JOIN accounts_customuser u ON sm.user_id = u.id WHERE sm.created_at >= NOW() - INTERVAL '7 days' ORDER BY sm.created_at DESC",
    "parameters": {{}},
    "explanation": "Historial de entradas, salidas y ajustes de inventario de la última semana",
    "suggested_chart_type": "table",
    "filters_applied": ["últimos 7 días"]
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
