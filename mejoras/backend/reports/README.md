# 🤖 Sistema de Reportes Dinámicos con IA

## 📋 Descripción

Sistema de generación de reportes dinámicos usando Inteligencia Artificial que permite a administradores y empleados generar reportes de ventas, inventario, clientes y finanzas mediante **lenguaje natural** (texto o voz).

## 🎯 Características Principales

✨ **Generación por Lenguaje Natural**: Escribe o habla tu consulta
🎙️ **Soporte de Audio**: Transcripción automática con Whisper
📊 **Múltiples Formatos**: Exporta a PDF o Excel
🔒 **Seguro**: Validación SQL anti-inyección
📈 **Gráficos Automáticos**: Visualizaciones inteligentes
📝 **Auditoría Completa**: Registro de todos los reportes generados

---

## 🚀 Configuración Inicial

### 1. Instalar Dependencias

```bash
cd backend_django
pip install -r requirements.txt
```

### 2. Configurar Variables de Entorno

Copia el archivo `.env.example` a `.env`:

```bash
copy .env.example .env
```

Edita `.env` y configura:

```env
# Groq API (GRATIS)
GROQ_API_KEY=tu_groq_api_key_aqui

# OpenAI API (solo para audio)
OPENAI_API_KEY=tu_openai_api_key_aqui
```

#### 🔑 Obtener API Keys:

**Groq (GRATIS - Recomendado)**
1. Ir a: https://console.groq.com/
2. Crear cuenta (gratis)
3. Ir a "API Keys"
4. Crear nueva key
5. Copiar y pegar en `.env`

**OpenAI (Solo si usarás audio)**
1. Ir a: https://platform.openai.com/api-keys
2. Crear cuenta
3. Agregar $5-10 USD de crédito
4. Crear API key
5. Copiar y pegar en `.env`

> 💡 **Nota**: Puedes usar solo Groq si no necesitas transcripción de audio

### 3. Aplicar Migraciones

```bash
python manage.py makemigrations reports
python manage.py migrate
```

### 4. Generar Datos de Prueba

```bash
python generate_test_data.py
```

Esto creará:
- 🔐 1 Admin + 1 Empleado + 8 Clientes
- 📦 18 Productos de ropa
- 🛒 ~500 órdenes de los últimos 3 meses
- 🧾 Facturas y pagos asociados

### 5. Iniciar Servidor

```bash
python manage.py runserver
```

---

## 📡 API Endpoints

### Base URL: `http://localhost:8000/api/reports/`

### 1. **Generar Reporte Completo**

**POST** `/api/reports/generate/`

Genera y descarga un reporte en PDF o Excel.

#### Request (Texto):
```json
{
  "prompt": "Ventas del último mes",
  "export_format": "pdf",
  "include_chart": true
}
```

#### Request (Audio):
```
Content-Type: multipart/form-data

audio: [archivo .mp3, .wav, .m4a, etc.]
export_format: pdf
include_chart: true
```

#### Response:
```
Status: 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="reporte_sales_20251017_143022.pdf"

[Archivo binario]
```

#### Headers de Respuesta:
```
X-Report-Id: uuid-del-reporte
X-Execution-Time: 2.34
X-Results-Count: 45
```

---

### 2. **Vista Previa (JSON)**

**POST** `/api/reports/preview/`

Genera el reporte pero devuelve solo JSON (sin exportar).

#### Request:
```json
{
  "prompt": "Top 5 productos más vendidos",
  "limit": 50
}
```

#### Response:
```json
{
  "success": true,
  "report_type": "sales",
  "explanation": "Top 5 productos más vendidos en los últimos 7 días",
  "sql_query": "SELECT p.name as producto, SUM(oi.quantity) as cantidad_vendida...",
  "results_count": 5,
  "results": [
    {
      "producto": "Jeans Skinny Negro",
      "cantidad_vendida": 45,
      "ingresos": 4045.50
    },
    ...
  ],
  "suggested_chart_type": "bar",
  "filters_applied": ["últimos 7 días", "top 5"]
}
```

---

### 3. **Historial de Reportes**

**GET** `/api/reports/history/`

Lista reportes generados.

#### Query Params:
- `type`: Filtrar por tipo (sales, inventory, etc.)
- `success_only`: Solo exitosos (true/false)
- `page`: Número de página
- `page_size`: Tamaño de página

#### Response:
```json
{
  "total": 127,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "id": "uuid",
      "user_email": "admin@tienda.com",
      "user_name": "Admin Principal",
      "report_type": "sales",
      "input_type": "text",
      "original_prompt": "Ventas del último mes",
      "results_count": 45,
      "export_format": "pdf",
      "execution_time": 2.34,
      "tokens_used": 856,
      "success": true,
      "created_at": "2025-10-17T14:30:22Z"
    },
    ...
  ]
}
```

---

### 4. **Sugerencias de Reportes**

**GET** `/api/reports/suggestions/`

Devuelve ejemplos de prompts comunes.

#### Response:
```json
{
  "suggestions": {
    "sales": [
      "Ventas del último mes",
      "Productos más vendidos esta semana",
      "Comparar ventas online vs tienda física"
    ],
    "inventory": [
      "Productos con stock bajo",
      "Productos sin ventas en el último mes"
    ],
    "financial": [
      "Ingresos totales del último mes",
      "Métodos de pago más usados"
    ],
    "customers": [
      "Nuevos clientes este mes",
      "Clientes con más pedidos"
    ]
  },
  "user_role": "admin"
}
```

---

## 💡 Ejemplos de Prompts

### Ventas
```
✅ "Ventas del último mes"
✅ "Productos más vendidos esta semana"
✅ "Comparar ventas online vs tienda física del último trimestre"
✅ "Top 5 clientes con mayor gasto este año"
✅ "Ventas por día de la semana del último mes"
✅ "Ingresos totales de octubre 2025"
```

### Inventario
```
✅ "Productos con stock menor a 10 unidades"
✅ "Productos sin ventas en el último mes"
✅ "Valor total del inventario actual"
✅ "Productos más populares por categoría"
```

### Clientes
```
✅ "Nuevos clientes este mes"
✅ "Clientes con más de 5 pedidos"
✅ "Clientes inactivos (sin compras en 3 meses)"
✅ "Compras del cliente maria.gonzalez@email.com"
```

### Financiero
```
✅ "Ingresos totales del último trimestre"
✅ "Comparar ingresos mes a mes del año 2025"
✅ "Métodos de pago más usados"
✅ "Facturas emitidas por el empleado Juan"
```

### Empleados
```
✅ "Ventas procesadas por empleado esta semana"
✅ "Total de facturas emitidas por cada empleado este mes"
```

---

## 🎙️ Uso con Audio

### Formatos Soportados
- MP3
- MP4
- MPEG
- MPGA
- M4A
- WAV
- WEBM

### Ejemplo con cURL
```bash
curl -X POST http://localhost:8000/api/reports/generate/ \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -F "audio=@mi_audio.mp3" \
  -F "export_format=pdf" \
  -F "include_chart=true" \
  --output reporte.pdf
```

---

## 🔒 Permisos

| Acción | Admin | Empleado | Cliente |
|--------|-------|----------|---------|
| Generar reportes | ✅ | ✅ | ❌ |
| Ver historial propio | ✅ | ✅ | ❌ |
| Ver historial de todos | ✅ | ❌ | ❌ |
| Reportes avanzados | ✅ | ⚠️ Limitado | ❌ |

---

## 💰 Costos Estimados

### Con Groq (Recomendado)
- **Generación de reportes**: **GRATIS**
- **Límite**: 14,400 requests/día
- **Costo mensual**: **$0 USD**

### Con OpenAI Whisper (Solo audio)
- **Transcripción**: $0.006 por minuto
- **Ejemplo**: 100 audios de 30 seg/día = ~$9/mes
- **Costo mensual**: **$9-15 USD**

### Total Estimado
- **Solo texto**: **$0/mes** (gratis con Groq)
- **Texto + audio**: **$9-15/mes**

---

## 🛠️ Arquitectura Técnica

```
┌─────────────────────────────────────────┐
│          FRONTEND (React/Next.js)       │
│  - Input de texto                       │
│  - Grabador de audio                    │
│  - Descarga PDF/Excel                   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│     BACKEND DJANGO (API REST)           │
│  ┌─────────────────────────────────┐   │
│  │  1. Whisper Service             │   │
│  │     (Transcripción audio → texto)│   │
│  └────────────┬────────────────────┘   │
│               ▼                         │
│  ┌─────────────────────────────────┐   │
│  │  2. AI Service (Groq/Llama 3.1) │   │
│  │     (Texto → SQL + Análisis)     │   │
│  └────────────┬────────────────────┘   │
│               ▼                         │
│  ┌─────────────────────────────────┐   │
│  │  3. Query Executor              │   │
│  │     (Ejecuta SQL seguro)         │   │
│  └────────────┬────────────────────┘   │
│               ▼                         │
│  ┌─────────────────────────────────┐   │
│  │  4. Export Service              │   │
│  │     (Genera PDF/Excel)           │   │
│  └─────────────────────────────────┘   │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│       BASE DE DATOS (PostgreSQL)        │
│  - Productos, Órdenes, Clientes         │
│  - Facturas, Pagos, Inventario          │
└─────────────────────────────────────────┘
```

---

## 📦 Estructura de Archivos

```
backend_django/
├── reports/
│   ├── __init__.py
│   ├── models.py              # ReportLog
│   ├── serializers.py
│   ├── views.py               # Endpoints principales
│   ├── urls.py
│   ├── admin.py
│   ├── ai_service.py          # Groq/Llama 3.1
│   ├── whisper_service.py     # OpenAI Whisper
│   ├── export_service.py      # PDF + Excel
│   └── migrations/
├── generate_test_data.py      # Script de datos de prueba
├── .env.example
└── requirements.txt
```

---

## 🧪 Testing

### Credenciales de Prueba

**Admin:**
- Email: `admin@tienda.com`
- Password: `admin123`

**Empleado:**
- Email: `empleado@tienda.com`
- Password: `empleado123`

**Clientes:**
- Email: `maria.gonzalez@email.com`
- Password: `customer123`

### Ejemplo de Prueba con Postman

1. **Login:**
```
POST http://localhost:8000/api/auth/login/
{
  "email": "admin@tienda.com",
  "password": "admin123"
}
```

2. **Generar Reporte:**
```
POST http://localhost:8000/api/reports/preview/
Authorization: Bearer {token_del_login}
{
  "prompt": "Ventas del último mes"
}
```

---

## 🐛 Troubleshooting

### Error: "GROQ_API_KEY not found"
- Verifica que creaste el archivo `.env`
- Confirma que la variable está bien escrita
- Reinicia el servidor Django

### Error: "Import groq could not be resolved"
- Ejecuta: `pip install -r requirements.txt`
- Verifica que estás en el entorno virtual correcto

### Error: SQL contiene palabra prohibida
- La IA generó SQL inseguro
- Reformula el prompt más claro
- Reporta el caso para mejorar validación

### Audio no se transcribe
- Verifica que `OPENAI_API_KEY` está configurado
- Confirma que el archivo es formato válido
- Revisa que tienes créditos en OpenAI

---

## 📈 Próximos Pasos

1. ✅ **Sistema básico de reportes** ← ESTAMOS AQUÍ
2. 🔄 Integrar frontend (React/Next.js)
3. 📊 Dashboard con gráficos en tiempo real
4. 🤖 Reportes programados automáticos
5. 📧 Envío por email
6. 🔔 Alertas inteligentes
7. 📱 App móvil

---

## 💬 Soporte

Para dudas o problemas:
1. Revisa este README
2. Verifica los logs de Django
3. Consulta la documentación de Groq: https://console.groq.com/docs

---

## 📄 Licencia

MIT License - Proyecto educativo

---

**¡Ahora estás listo para generar reportes con IA! 🚀**
