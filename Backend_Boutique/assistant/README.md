# 🤖 Sistema de Chatbot Asistente Inteligente

## 📋 Descripción

Sistema de chatbot contextual con IA (Groq/Llama 3.3) que asiste a los usuarios según su rol en el sistema. Proporciona ayuda dinámica, enlaces directos, guías paso a paso y restricciones de seguridad basadas en permisos.

---

## 🎯 Características Principales

### 🧠 Inteligencia Contextual
- **Respuestas basadas en rol**: Admin, Cajero, Gerente, Cliente
- **Memoria conversacional**: Recuerda el contexto de la conversación
- **Comprensión del sistema**: Conoce toda la estructura del proyecto

### 🔒 Sistema de Permisos
- **Admin**: Acceso total, guías avanzadas, todas las funcionalidades
- **Cajero**: Restricciones automáticas, sugerencias de contacto con admin
- **Gerente**: Acceso de supervisión con limitaciones específicas
- **Cliente**: Enfoque en compras y consultas de productos

### 🎨 Interfaz Dinámica
- **Enlaces directos**: Redirige a secciones específicas del sistema
- **Acciones rápidas**: Botones contextuales según la consulta
- **Recursos relacionados**: Links a documentación y ayuda
- **Sugerencias inteligentes**: Preguntas frecuentes por rol

### 📊 Auditoría y Mejora
- **Historial de conversaciones**: Todas las interacciones guardadas
- **Sistema de feedback**: Calificación de respuestas (1-5 estrellas)
- **Análisis de uso**: Métricas para mejorar el asistente

---

## 🚀 Endpoints API

### 1. **Enviar Mensaje al Chatbot**
```http
POST /api/assistant/chat/
```

**Body:**
```json
{
  "message": "¿Cómo registro una venta?",
  "conversation_id": "uuid-opcional"
}
```

**Response:**
```json
{
  "success": true,
  "conversation_id": "abc-123-def",
  "message": {
    "id": "msg-uuid",
    "role": "assistant",
    "content": "Para registrar una venta, sigue estos pasos...",
    "suggested_actions": [
      {
        "label": "💰 Nueva Venta",
        "url": "/pos",
        "type": "navigation"
      }
    ],
    "related_resources": [
      {
        "title": "📚 Guía de Ventas",
        "description": "Proceso completo paso a paso",
        "url": "/docs/sales",
        "type": "documentation"
      }
    ],
    "created_at": "2025-10-22T10:30:00Z"
  },
  "user_role": "employee"
}
```

---

### 2. **Listar Conversaciones**
```http
GET /api/assistant/conversations/
```

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv-uuid",
      "title": "¿Cómo registro una venta?",
      "started_at": "2025-10-22T10:00:00Z",
      "last_message_at": "2025-10-22T10:30:00Z",
      "is_active": true,
      "message_count": 8,
      "last_message_preview": {
        "role": "assistant",
        "content": "Para registrar una venta..."
      }
    }
  ]
}
```

---

### 3. **Ver Conversación Completa**
```http
GET /api/assistant/conversation/<uuid>/
```

**Response:**
```json
{
  "success": true,
  "conversation": {
    "id": "conv-uuid",
    "title": "¿Cómo registro una venta?",
    "started_at": "2025-10-22T10:00:00Z",
    "last_message_at": "2025-10-22T10:30:00Z",
    "is_active": true,
    "message_count": 8,
    "messages": [
      {
        "id": "msg-1",
        "role": "user",
        "content": "¿Cómo registro una venta?",
        "created_at": "2025-10-22T10:00:00Z"
      },
      {
        "id": "msg-2",
        "role": "assistant",
        "content": "Para registrar una venta...",
        "suggested_actions": [...],
        "related_resources": [...],
        "created_at": "2025-10-22T10:00:30Z"
      }
    ]
  }
}
```

---

### 4. **Eliminar Conversación**
```http
DELETE /api/assistant/conversation/<uuid>/
```

**Response:**
```json
{
  "success": true,
  "message": "Conversación eliminada correctamente"
}
```

---

### 5. **Enviar Feedback**
```http
POST /api/assistant/feedback/
```

**Body:**
```json
{
  "message": "msg-uuid",
  "rating": 5,
  "comment": "Muy útil y claro"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Gracias por tu feedback",
  "feedback": {
    "id": "feedback-uuid",
    "rating": 5,
    "comment": "Muy útil y claro",
    "created_at": "2025-10-22T10:35:00Z"
  }
}
```

---

### 6. **Acciones Rápidas por Rol**
```http
GET /api/assistant/quick-actions/
```

**Response (Admin):**
```json
{
  "success": true,
  "role": "admin",
  "quick_actions": [
    {"label": "📦 Ver Productos", "url": "/products", "icon": "package"},
    {"label": "💰 Nueva Venta", "url": "/pos", "icon": "shopping-cart"},
    {"label": "📊 Ver Inventario", "url": "/inventory", "icon": "bar-chart"},
    {"label": "👥 Gestionar Clientes", "url": "/customers", "icon": "users"},
    {"label": "👨‍💼 Gestionar Empleados", "url": "/employees", "icon": "user-check"},
    {"label": "📈 Generar Reporte", "url": "/reports", "icon": "trending-up"},
    {"label": "⚙️ Configuración", "url": "/settings", "icon": "settings"}
  ]
}
```

**Response (Cajero):**
```json
{
  "success": true,
  "role": "employee",
  "quick_actions": [
    {"label": "📦 Ver Productos", "url": "/products", "icon": "package"},
    {"label": "💰 Nueva Venta", "url": "/pos", "icon": "shopping-cart"},
    {"label": "📋 Mis Ventas", "url": "/orders?employee=me", "icon": "list"},
    {"label": "👥 Buscar Cliente", "url": "/customers", "icon": "search"}
  ]
}
```

---

### 7. **Sugerencias de Preguntas**
```http
GET /api/assistant/suggestions/
```

**Response (Admin):**
```json
{
  "success": true,
  "role": "admin",
  "suggestions": [
    "¿Cómo creo un nuevo producto?",
    "¿Cómo genero un reporte de ventas del mes?",
    "¿Cómo agrego un nuevo empleado?",
    "¿Cómo veo el inventario de productos con bajo stock?",
    "¿Cómo proceso una devolución?",
    "¿Cómo exporto datos a Excel?",
    "¿Cómo configuro los métodos de pago?",
    "¿Cómo veo las ventas por empleado?"
  ]
}
```

**Response (Cajero):**
```json
{
  "success": true,
  "role": "employee",
  "suggestions": [
    "¿Cómo registro una venta?",
    "¿Cómo busco un producto por SKU?",
    "¿Cómo veo el stock disponible de un producto?",
    "¿Cómo registro un nuevo cliente?",
    "¿Cómo proceso un pago con tarjeta?",
    "¿Cómo genero una factura?",
    "¿Cómo veo mis ventas del día?",
    "¿Qué hago si un producto no tiene stock?"
  ]
}
```

---

## 🎭 Comportamiento por Rol

### 👑 Administrador (Admin)
**Acceso Completo**

✅ **Puede hacer:**
- Cualquier consulta sobre el sistema
- Gestión de productos, inventario, usuarios
- Acceso a reportes avanzados
- Configuración del sistema
- Gestión de empleados y permisos

**Ejemplo de conversación:**
```
Usuario: "¿Cómo creo un nuevo empleado?"

Asistente:
"Para crear un nuevo empleado, sigue estos pasos:

1. Ve a Gestión de Empleados (👨‍💼)
2. Haz clic en 'Nuevo Empleado'
3. Completa los siguientes datos:
   - Email (debe ser único)
   - Nombre completo
   - Rol (Cajero, Gerente, etc.)
   - Permisos específicos
4. Guarda los cambios

El empleado recibirá un email con sus credenciales.

[Ver acciones recomendadas:]
- 👨‍💼 Gestionar Empleados
- 🔐 Configurar Permisos
- 📧 Ver Emails Enviados"
```

---

### 👤 Cajero (Employee)
**Acceso Restringido**

✅ **Puede hacer:**
- Consultas sobre ventas y productos
- Ver inventario (solo lectura)
- Procesar ventas en tienda física
- Registrar clientes

❌ **NO puede hacer:**
- Crear o editar productos
- Cambiar precios
- Gestionar inventario (agregar stock)
- Acceder a reportes financieros
- Gestionar usuarios

**Ejemplo de conversación (PERMITIDO):**
```
Usuario: "¿Cómo busco un producto por SKU?"

Asistente:
"Para buscar un producto por SKU:

1. Ve a la sección de Productos (📦)
2. Usa el buscador en la parte superior
3. Ingresa el código SKU
4. Presiona Enter

Verás el stock disponible, precio y variantes.

[Ver acciones recomendadas:]
- 📦 Ver Productos
- 💰 Nueva Venta"
```

**Ejemplo de conversación (NO PERMITIDO):**
```
Usuario: "¿Cómo cambio el precio de un producto?"

Asistente:
"⚠️ Restricción de Permisos

Como cajero, no tienes permiso para cambiar precios de productos.
Esta acción solo puede ser realizada por un Administrador.

📞 Contacta al administrador:
   Email: admin@boutique.com

Mientras tanto, puedes:
- Ver productos y stock disponible
- Procesar ventas
- Registrar clientes

[Acciones permitidas:]
- 📦 Ver Productos
- 💰 Nueva Venta
- 👥 Buscar Cliente"
```

---

### 👨‍💼 Gerente (Manager)
**Acceso de Supervisión**

✅ **Puede hacer:**
- Gestión de productos e inventario
- Supervisión de ventas
- Reportes de rendimiento
- Ver empleados (sin editarlos)

❌ **NO puede hacer:**
- Crear/eliminar empleados
- Modificar configuración del sistema
- Acceso a datos financieros sensibles

---

## 🎨 Características Dinámicas

### 1. **Enlaces Contextuales**
El chatbot detecta palabras clave y ofrece enlaces directos:

```
Usuario: "quiero ver el inventario"

Asistente genera automáticamente:
- 📊 Ver Inventario -> /inventory
- 📦 Ver Productos -> /products
- 📈 Reporte de Stock -> /reports
```

---

### 2. **Guías Paso a Paso**
Cuando el usuario pregunta "cómo hacer X", el asistente proporciona:
1. Instrucciones numeradas
2. Enlaces directos a cada paso
3. Capturas o referencias visuales
4. Acciones rápidas al final

---

### 3. **Recursos Relacionados**
Junto a cada respuesta, el asistente sugiere:
- 📚 Documentación relacionada
- 🎥 Tutoriales en video (si existen)
- 📞 Contacto de soporte
- ❓ Preguntas frecuentes relacionadas

---

## 📊 Modelos de Base de Datos

### ChatConversation
```python
{
  'id': UUID,
  'user': ForeignKey(User),
  'title': str,  # Auto-generado del primer mensaje
  'started_at': datetime,
  'last_message_at': datetime,
  'is_active': bool
}
```

### ChatMessage
```python
{
  'id': UUID,
  'conversation': ForeignKey(ChatConversation),
  'role': str,  # 'user' o 'assistant'
  'content': text,
  'suggested_actions': JSON,  # Enlaces y botones
  'related_resources': JSON,  # Documentación y ayuda
  'created_at': datetime
}
```

### AssistantFeedback
```python
{
  'id': UUID,
  'message': ForeignKey(ChatMessage),
  'user': ForeignKey(User),
  'rating': int,  # 1-5
  'comment': text,
  'created_at': datetime
}
```

---

## 🔧 Configuración

### 1. **Instalar Dependencias**
```bash
# Ya instaladas con el proyecto
pip install groq
```

### 2. **Configurar API Key**
```bash
# .env
GROQ_API_KEY=tu-api-key-aqui
```

### 3. **Migraciones**
```bash
cd backend_django
python manage.py makemigrations assistant
python manage.py migrate
```

### 4. **Iniciar Servidor**
```bash
python manage.py runserver
```

---

## 🧪 Pruebas

### Usando cURL

**1. Login primero:**
```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@boutique.com", "password": "admin123"}'
```

**2. Enviar mensaje al chatbot:**
```bash
curl -X POST http://localhost:8000/api/assistant/chat/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <tu-token-jwt>" \
  -d '{"message": "¿Cómo registro una venta?"}'
```

**3. Ver conversaciones:**
```bash
curl -X GET http://localhost:8000/api/assistant/conversations/ \
  -H "Authorization: Bearer <tu-token-jwt>"
```

---

### Usando Postman

1. **Colección de Postman**: Importar `assistant_api_collection.json` (próximamente)
2. **Variables de entorno**: Configurar `{{base_url}}` y `{{token}}`
3. **Ejecutar tests**: Flujo completo de conversación

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Admin - Crear Producto
```json
// Request
{
  "message": "¿Cómo creo un producto nuevo?"
}

// Response
{
  "success": true,
  "message": {
    "content": "Para crear un producto nuevo:\n\n1. Ve a Gestión de Productos...",
    "suggested_actions": [
      {"label": "📦 Ver Productos", "url": "/products"},
      {"label": "➕ Crear Producto", "url": "/products/new"}
    ],
    "related_resources": [
      {
        "title": "📚 Guía de Productos",
        "url": "/docs/products"
      }
    ]
  }
}
```

---

### Ejemplo 2: Cajero - Restricción
```json
// Request (Cajero intentando editar precios)
{
  "message": "¿Cómo cambio el precio de una camisa?"
}

// Response
{
  "success": true,
  "message": {
    "content": "⚠️ Como cajero, no puedes cambiar precios...\n\n📞 Contacta: admin@boutique.com",
    "suggested_actions": [
      {"label": "📦 Ver Productos", "url": "/products"},
      {"label": "📞 Contactar Admin", "url": "mailto:admin@boutique.com"}
    ]
  }
}
```

---

## 🚀 Integración Frontend

### React/Next.js (Recomendado)

```typescript
// hooks/useAssistant.ts
import { useState } from 'react';
import axios from 'axios';

export const useAssistant = () => {
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const sendMessage = async (message: string) => {
    setLoading(true);
    try {
      const response = await axios.post('/api/assistant/chat/', {
        message,
        conversation_id: conversationId
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      setConversationId(response.data.conversation_id);
      return response.data;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, conversationId };
};
```

```tsx
// components/ChatbotWidget.tsx
import { useState } from 'react';
import { useAssistant } from '@/hooks/useAssistant';

export const ChatbotWidget = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const { sendMessage, loading } = useAssistant();

  const handleSend = async () => {
    if (!input.trim()) return;

    // Agregar mensaje del usuario
    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');

    // Enviar a la API
    const response = await sendMessage(input);
    
    // Agregar respuesta del asistente
    setMessages(prev => [...prev, response.message]);
  };

  return (
    <div className="chatbot-widget">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <p>{msg.content}</p>
            
            {/* Acciones sugeridas */}
            {msg.suggested_actions && (
              <div className="actions">
                {msg.suggested_actions.map((action, i) => (
                  <a key={i} href={action.url} className="action-btn">
                    {action.label}
                  </a>
                ))}
              </div>
            )}
            
            {/* Recursos relacionados */}
            {msg.related_resources && (
              <div className="resources">
                {msg.related_resources.map((resource, i) => (
                  <a key={i} href={resource.url} className="resource-link">
                    {resource.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe tu pregunta..."
        />
        <button onClick={handleSend} disabled={loading}>
          {loading ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  );
};
```

---

## 📈 Métricas y Análisis

### Dashboard de Admin
El sistema guarda:
- Total de conversaciones por usuario
- Promedio de mensajes por conversación
- Rating promedio de respuestas
- Preguntas más frecuentes
- Usuarios más activos
- Tiempos de respuesta

### Reportes disponibles:
```python
# En el admin de Django o vía API personalizada
ChatConversation.objects.filter(user__role='employee').count()
AssistantFeedback.objects.aggregate(Avg('rating'))
# etc.
```

---

## 🔒 Seguridad

### ✅ Implementado:
- Autenticación JWT requerida
- Validación de permisos por rol
- Sanitización de inputs
- Rate limiting (próximamente)
- Logs de auditoría

### 🚫 Restricciones:
- Máximo 2000 caracteres por mensaje
- Máximo 10 mensajes en historial contextual
- Timeout de 30 segundos para respuestas de IA

---

## 💰 Costos

### Groq (Llama 3.3):
- **GRATIS**: 14,400 requests/día
- **Costo adicional**: $0 (no hay planes pagos aún)
- **Latencia**: ~1-2 segundos por respuesta

### Proyección de uso:
- **10 usuarios activos**: ~100 mensajes/día → $0/mes
- **50 usuarios activos**: ~500 mensajes/día → $0/mes
- **100 usuarios activos**: ~1000 mensajes/día → $0/mes

**Conclusión**: Completamente GRATIS para proyectos pequeños y medianos.

---

## 🎯 Roadmap Futuro

### Versión 1.1 (Próximas semanas)
- [ ] Soporte multiidioma (inglés/español)
- [ ] Integración con WhatsApp Business
- [ ] Voice input (Speech-to-Text)
- [ ] Exportar conversaciones a PDF

### Versión 1.2
- [ ] Chatbot proactivo (notificaciones automáticas)
- [ ] Integración con sistema de tickets
- [ ] Analytics dashboard completo
- [ ] Training personalizado por empresa

---

## 🤝 Soporte

### ¿Problemas?
1. Revisar logs de Django: `python manage.py runserver`
2. Verificar API key de Groq en `.env`
3. Comprobar migraciones: `python manage.py migrate`

### Contacto:
- Email: support@boutique.com
- Documentación completa: `/docs/assistant`

---

## 📝 Changelog

### v1.0.0 (22 Oct 2025)
- ✅ Sistema de chatbot completo
- ✅ Integración con Groq/Llama 3.3
- ✅ Restricciones por rol
- ✅ Enlaces dinámicos
- ✅ Sistema de feedback
- ✅ Historial de conversaciones

---

**🎉 ¡Sistema de Chatbot Listo para Usar!**

Costo: **$0/mes** | Tiempo de setup: **15 minutos** | Estado: **Producción Ready**
