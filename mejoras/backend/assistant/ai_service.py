"""
Servicio de IA para el chatbot asistente
Usa Groq (Llama 3.3) para responder consultas contextuales
"""

import json
from typing import Dict, List, Any, Optional
from groq import Groq
from django.conf import settings


class AssistantAIService:
    """
    Servicio de IA para el chatbot del sistema
    Maneja diferentes niveles de permisos según el rol del usuario
    """
    
    _client = None
    
    def __init__(self):
        self.model = "llama-3.3-70b-versatile"
    
    @property
    def client(self):
        """Lazy loading del cliente Groq"""
        if self._client is None:
            try:
                self._client = Groq(api_key=settings.GROQ_API_KEY)
            except Exception as e:
                raise RuntimeError(f"Error al inicializar cliente Groq: {e}")
        return self._client
        
    def _get_system_context(self, user_role: str) -> str:
        """
        Genera el contexto del sistema según el rol del usuario
        """
        base_context = """
        Eres un asistente virtual inteligente para un sistema de e-commerce de boutique de ropa.
        
        **INFORMACIÓN DEL SISTEMA:**
        
        El sistema tiene los siguientes módulos:
        - **Productos**: Gestión de catálogo, categorías, marcas, variantes (tallas/colores), inventario
        - **Ventas/Órdenes**: Procesamiento de pedidos online y en tienda física
        - **Clientes**: Gestión de clientes y sus compras
        - **Empleados**: Gestión de personal y roles
        - **Reportes**: Generación de reportes con IA usando lenguaje natural
        - **Pagos**: Gestión de métodos de pago y facturas
        - **Carrito**: Sistema de compras online
        
        **ESTRUCTURA DE DATOS:**
        - Productos con variantes (talla + color)
        - Categorías: Camisas, Pantalones, Vestidos, Chaquetas, Accesorios, etc.
        - Marcas: Nike, Adidas, Zara, H&M, etc.
        - Tallas: XS, S, M, L, XL, XXL (ropa), 36-45 (calzado)
        - Colores: Rojo, Azul, Negro, Blanco, etc.
        - Tipos de orden: online, in_store, phone
        - Estados de orden: pending, confirmed, processing, shipped, delivered, cancelled, refunded
        
        **CARACTERÍSTICAS DEL SISTEMA:**
        - Autenticación JWT
        - Sistema de permisos granular
        - Reportes con IA (pregunta en lenguaje natural)
        - Exportación a PDF y Excel
        - Multi-rol: Admin, Gerente, Cajero, Cliente
        """
        
        # Contexto específico por rol
        role_contexts = {
            'admin': """
            **TU ROL ACTUAL: ADMINISTRADOR (Acceso Total)**
            
            Como administrador, tienes acceso completo al sistema. Puedes ayudar con:
            
            ✅ **Gestión de Productos:**
            - Crear, editar, eliminar productos
            - Gestionar variantes (tallas/colores)
            - Control de inventario
            - Activar/desactivar productos
            - Productos destacados
            
            ✅ **Gestión de Ventas:**
            - Procesar pedidos online y presenciales
            - Cambiar estados de órdenes
            - Ver historial de ventas
            - Devoluciones y reembolsos
            
            ✅ **Gestión de Usuarios:**
            - Crear empleados (cajeros, gerentes)
            - Asignar permisos y roles
            - Ver y gestionar clientes
            - Activar/desactivar usuarios
            
            ✅ **Reportes Avanzados:**
            - Generar cualquier reporte con IA
            - Exportar a PDF/Excel
            - Análisis de ventas, inventario, clientes
            - Métricas financieras
            
            ✅ **Configuración:**
            - Métodos de pago
            - Categorías y marcas
            - Parámetros del sistema
            
            **ENLACES ÚTILES:**
            - Dashboard: /dashboard
            - Productos: /products
            - Ventas: /orders
            - Clientes: /customers
            - Empleados: /employees
            - Reportes IA: /reports
            - Configuración: /settings
            
            **INSTRUCCIONES IMPORTANTES:**
            1. Siempre proporciona enlaces directos a las secciones relevantes
            2. Si el usuario quiere hacer algo, guíalo paso a paso
            3. Ofrece ejemplos concretos con datos del sistema
            4. Si pregunta por reportes, menciona que puede usar lenguaje natural
            5. Mantén un tono profesional pero amigable
            """,
            
            'employee': """
            **TU ROL ACTUAL: CAJERO (Acceso Limitado)**
            
            Como cajero, tienes permisos limitados. Puedes ayudar con:
            
            ✅ **PERMITIDO:**
            - Ver inventario de productos
            - Buscar productos por SKU, nombre, categoría
            - Procesar ventas en tienda física
            - Ver stock disponible
            - Registrar pagos (efectivo, tarjeta, QR)
            - Crear facturas
            - Ver historial de tus ventas
            - Registrar nuevos clientes
            
            ❌ **NO PERMITIDO:**
            - Crear o editar productos
            - Cambiar precios
            - Gestionar inventario (agregar stock)
            - Ver reportes financieros detallados
            - Acceder a configuración del sistema
            - Gestionar empleados
            - Modificar métodos de pago
            
            **ENLACES ÚTILES:**
            - Ver Productos: /products
            - Nueva Venta: /pos
            - Mis Ventas: /orders?employee=me
            - Buscar Cliente: /customers
            
            **IMPORTANTE:**
            Si necesitas realizar algo que no está en tu lista de permisos, contacta al administrador:
            📧 admin@boutique.com
            
            **INSTRUCCIONES:**
            1. Si preguntan algo fuera de tus permisos, indica amablemente que debe contactar al admin
            2. Proporciona enlaces directos cuando sea posible
            3. Ayuda con el proceso de ventas paso a paso
            4. Si hay dudas sobre productos, ayuda a buscarlos
            """,
            
            'manager': """
            **TU ROL ACTUAL: GERENTE (Acceso Supervisión)**
            
            Como gerente, tienes acceso de supervisión. Puedes ayudar con:
            
            ✅ **Gestión de Productos:**
            - Crear y editar productos
            - Gestionar inventario
            - Control de stock
            
            ✅ **Supervisión de Ventas:**
            - Ver todas las ventas
            - Reportes de rendimiento
            - Control de devoluciones
            
            ✅ **Gestión de Personal:**
            - Ver empleados
            - Revisar desempeño de cajeros
            
            ✅ **Reportes:**
            - Reportes de ventas
            - Análisis de inventario
            - Métricas de clientes
            
            ❌ **NO PERMITIDO:**
            - Crear/eliminar empleados
            - Modificar configuración del sistema
            - Acceso a reportes financieros sensibles
            
            **ENLACES ÚTILES:**
            - Dashboard: /dashboard
            - Productos: /products
            - Ventas: /orders
            - Reportes: /reports
            - Empleados: /employees/view
            """
        }
        
        user_context = role_contexts.get(user_role, role_contexts['employee'])
        return base_context + "\n\n" + user_context
    
    def _generate_quick_actions(self, user_role: str, user_message: str) -> List[Dict[str, str]]:
        """
        Genera acciones rápidas (enlaces) basadas en la consulta del usuario
        """
        message_lower = user_message.lower()
        actions = []
        
        # Mapeo de palabras clave a acciones
        keyword_actions = {
            'producto': {'label': '📦 Ver Productos', 'url': '/products', 'type': 'navigation'},
            'inventario': {'label': '📊 Ver Inventario', 'url': '/inventory', 'type': 'navigation'},
            'venta': {'label': '💰 Nueva Venta', 'url': '/pos', 'type': 'navigation'},
            'orden': {'label': '📋 Ver Órdenes', 'url': '/orders', 'type': 'navigation'},
            'pedido': {'label': '📋 Ver Órdenes', 'url': '/orders', 'type': 'navigation'},
            'cliente': {'label': '👥 Ver Clientes', 'url': '/customers', 'type': 'navigation'},
            'reporte': {'label': '📈 Generar Reporte', 'url': '/reports', 'type': 'navigation'},
            'factura': {'label': '🧾 Ver Facturas', 'url': '/invoices', 'type': 'navigation'},
            'pago': {'label': '💳 Gestionar Pagos', 'url': '/payments', 'type': 'navigation'},
        }
        
        # Acciones específicas por rol
        if user_role == 'admin':
            keyword_actions.update({
                'empleado': {'label': '👨‍💼 Gestionar Empleados', 'url': '/employees', 'type': 'navigation'},
                'usuario': {'label': '👤 Gestionar Usuarios', 'url': '/users', 'type': 'navigation'},
                'configuración': {'label': '⚙️ Configuración', 'url': '/settings', 'type': 'navigation'},
                'permiso': {'label': '🔐 Gestionar Permisos', 'url': '/permissions', 'type': 'navigation'},
            })
        
        # Buscar keywords en el mensaje
        for keyword, action in keyword_actions.items():
            if keyword in message_lower and action not in actions:
                actions.append(action)
        
        # Si no hay acciones específicas, agregar dashboard
        if not actions:
            actions.append({'label': '🏠 Ir al Dashboard', 'url': '/dashboard', 'type': 'navigation'})
        
        return actions[:3]  # Máximo 3 acciones
    
    def _generate_related_resources(self, user_role: str, user_message: str) -> List[Dict[str, str]]:
        """
        Genera recursos relacionados (documentación, ayuda)
        """
        resources = []
        message_lower = user_message.lower()
        
        # Recursos por tema
        if any(word in message_lower for word in ['reporte', 'analisis', 'estadistica']):
            resources.append({
                'title': '📚 Guía de Reportes con IA',
                'description': 'Aprende a generar reportes usando lenguaje natural',
                'url': '/docs/reports',
                'type': 'documentation'
            })
        
        if any(word in message_lower for word in ['producto', 'inventario', 'stock']):
            resources.append({
                'title': '📦 Guía de Gestión de Productos',
                'description': 'Cómo crear y gestionar productos y variantes',
                'url': '/docs/products',
                'type': 'documentation'
            })
        
        if any(word in message_lower for word in ['venta', 'orden', 'pedido']):
            resources.append({
                'title': '💰 Guía de Procesamiento de Ventas',
                'description': 'Proceso completo de ventas en tienda y online',
                'url': '/docs/sales',
                'type': 'documentation'
            })
        
        # Para cajeros, siempre incluir contacto de admin
        if user_role == 'employee':
            resources.append({
                'title': '📞 Contactar Administrador',
                'description': 'Para solicitudes fuera de tus permisos',
                'url': 'mailto:admin@boutique.com',
                'type': 'contact'
            })
        
        return resources
    
    def chat(
        self, 
        user_message: str, 
        user_role: str,
        user_name: str = None,
        conversation_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Procesa un mensaje del usuario y genera una respuesta contextual
        
        Args:
            user_message: Mensaje del usuario
            user_role: Rol del usuario (admin, employee, manager, customer)
            user_name: Nombre del usuario para personalización
            conversation_history: Historial de mensajes previos
            
        Returns:
            Dict con respuesta, acciones sugeridas y recursos
        """
        try:
            # Preparar el contexto del sistema con personalización
            system_context = self._get_system_context(user_role)
            
            # Agregar nombre del usuario al contexto si está disponible
            if user_name:
                system_context += f"""
                
                **IMPORTANTE - PERSONALIZACIÓN:**
                El usuario con quien estás conversando se llama **{user_name}**.
                - SIEMPRE dirígete a él/ella por su nombre de manera amigable y cálida
                - Usa su nombre al inicio de tus respuestas: "¡Hola {user_name}! 👋" o "{user_name}, con gusto te ayudo..."
                - Mantén un tono profesional pero cercano y amigable
                - Si es un saludo inicial, preséntate y menciona su nombre
                - Personaliza las respuestas según el contexto de su pregunta
                
                Ejemplo de respuesta ideal:
                "¡Hola {user_name}! 👋 Con gusto te ayudo con [tema]. [respuesta detallada]..."
                """
            
            # Preparar historial de conversación
            messages = [
                {
                    "role": "system",
                    "content": system_context
                }
            ]
            
            # Agregar historial si existe
            if conversation_history:
                messages.extend(conversation_history)
            
            # Agregar mensaje actual
            messages.append({
                "role": "user",
                "content": user_message
            })
            
            # Llamar a la IA
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            
            ai_response = response.choices[0].message.content
            
            # Generar acciones y recursos
            quick_actions = self._generate_quick_actions(user_role, user_message)
            related_resources = self._generate_related_resources(user_role, user_message)
            
            return {
                'success': True,
                'response': ai_response,
                'suggested_actions': quick_actions,
                'related_resources': related_resources,
                'role_context': user_role
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'response': 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta nuevamente.',
                'suggested_actions': [
                    {'label': '🔄 Intentar de nuevo', 'url': '#', 'type': 'retry'},
                    {'label': '🏠 Ir al Dashboard', 'url': '/dashboard', 'type': 'navigation'}
                ],
                'related_resources': []
            }
