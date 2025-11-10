# 🤖 Asistente IA - Componente de Chat

## 📋 Descripción

Componente de chat interactivo con Inteligencia Artificial integrado en el panel de administración. Permite a los administradores interactuar con un asistente virtual mediante texto o voz para obtener ayuda sobre el sistema.

## ✨ Características

### 🎤 Entrada de Voz
- Reconocimiento de voz mediante Web Speech API
- Transcripción en tiempo real (español)
- Indicador visual durante la grabación
- Manejo de errores de micrófono/permisos

### 💬 Chat por Texto
- Envío de mensajes mediante enter o botón
- Respuestas en tiempo real
- Historial de conversación
- Acciones sugeridas en respuestas del asistente

### 🎨 UI/UX
- Transición suave de deslizamiento desde la derecha
- Estado minimizado con botón de acceso rápido
- Diseño responsive (mobile-first)
- Tema monocromático acorde al sistema
- Indicadores de estado (escribiendo, escuchando)

### 🔄 Gestión de Conversaciones
- Historial de mensajes
- Nueva conversación
- Auto-scroll al último mensaje

## 📁 Estructura de Archivos

```
frontend/src/components/admin/AIAssistant/
├── AIAssistantChat.tsx       # Componente principal del chat
└── README.md                  # Este archivo
```

## 🔌 Integración

### En AdminNavbar

El botón del asistente se encuentra en la barra superior del navbar:

```tsx
// Botón para abrir el asistente
<button 
  onClick={() => {
    setIsChatOpen(true);
    setIsChatMinimized(false);
  }}
  className="..."
>
  <Sparkles size={20} />
</button>

// Componente del chat
<AIAssistantChat 
  isOpen={isChatOpen}
  onClose={() => {
    setIsChatOpen(false);
    setIsChatMinimized(false);
  }}
  onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
  isMinimized={isChatMinimized}
/>
```

## 🎯 Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `isOpen` | `boolean` | Controla si el chat está visible |
| `onClose` | `() => void` | Callback para cerrar completamente el chat |
| `onToggleMinimize` | `() => void` | Callback para alternar minimizado |
| `isMinimized` | `boolean` | Estado de minimización del chat |

## 🔧 Servicios Utilizados

### assistantService

```typescript
// Enviar mensaje
await assistantService.sendMessage(message, conversationId);

// Obtener conversaciones
await assistantService.getConversations();

// Obtener conversación específica
await assistantService.getConversation(conversationId);

// Eliminar conversación
await assistantService.deleteConversation(conversationId);

// Enviar feedback
await assistantService.sendFeedback(messageId, rating, comment);

// Obtener acciones rápidas
await assistantService.getQuickActions();

// Obtener sugerencias
await assistantService.getSuggestions();
```

## 🎨 Estados Visuales

### Estado Completo (Expandido)
- Ancho: 450px en desktop, 100% en mobile
- Header con degradado negro
- Área de mensajes con scroll
- Input de texto y botones de voz/envío
- Botones de minimizar y cerrar

### Estado Minimizado
- Ancho: 64px (barra delgada)
- Botón para reabrir el chat
- Botón para cerrar completamente
- Icono de mensaje flotante

## 🗣️ Reconocimiento de Voz

### Configuración

```typescript
recognitionRef.current.continuous = false;
recognitionRef.current.interimResults = true;
recognitionRef.current.lang = "es-ES";
```

### Manejo de Errores

| Error | Mensaje al Usuario |
|-------|-------------------|
| `not-allowed` | "Permite el acceso al micrófono en tu navegador." |
| `audio-capture` | "No se encontró un micrófono disponible." |
| `no-speech` | "No se detectó audio. Habla más cerca del micrófono." |
| `network` | "Error de conexión. Verifica tu internet." |

## 📱 Responsive Design

- **Mobile (< 768px)**: Chat ocupa 100% del ancho
- **Desktop (≥ 768px)**: Chat con ancho fijo de 450px
- Layout adaptativo con Tailwind CSS

## 🎨 Clases de Estilo Principales

```css
/* Contenedor del chat */
.fixed.right-0.top-0.h-full.bg-white.shadow-2xl.z-50

/* Transición de apertura */
.transition-all.duration-300.ease-in-out

/* Estado minimizado */
.w-16

/* Estado expandido */
.w-full.md:w-[450px]

/* Mensaje del usuario */
.bg-black.text-white.rounded-br-sm

/* Mensaje del asistente */
.bg-white.text-gray-800.border.border-gray-200.rounded-bl-sm
```

## 🔐 Autenticación

El componente utiliza el contexto de autenticación para:
- Obtener información del usuario actual
- Personalizar el saludo en el header
- Incluir el token en las peticiones al backend

```tsx
const { user } = useAuth();
```

## 🚀 Funcionalidades Futuras

- [ ] Historial de conversaciones persistente
- [ ] Búsqueda en conversaciones anteriores
- [ ] Adjuntar archivos/imágenes
- [ ] Compartir conversaciones
- [ ] Configuración de idioma del reconocimiento de voz
- [ ] Temas personalizables (claro/oscuro)
- [ ] Atajos de teclado

## 🐛 Debugging

Para activar logs de debug en el servicio:

```typescript
// En assistantService.ts
console.log('Sending message:', message);
console.log('Response:', response.data);
```

## 📚 Referencias

- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [React Hooks](https://react.dev/reference/react)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

## ✅ Checklist de Implementación

- [x] Componente base del chat
- [x] Integración con backend
- [x] Reconocimiento de voz
- [x] Estados de minimizado/expandido
- [x] Transiciones suaves
- [x] Diseño responsive
- [x] Manejo de errores
- [x] Auto-scroll de mensajes
- [x] Indicadores de carga
- [x] Integración con AdminNavbar

---

**Autor:** Sistema E-commerce Sportswear  
**Versión:** 1.0.0  
**Última actualización:** Noviembre 2025
