
## ✨ Características

### Backend (Django REST Framework)
- ✅ **Autenticación JWT** con sistema de roles personalizado (RBAC)
- 📦 **Gestión de Inventario**: Productos, categorías, variantes, imágenes
- 🛒 **Sistema de Órdenes**: Carrito, checkout, historial de ventas
- 📊 **Predicciones ML**: RandomForest para pronóstico de ventas
- 📈 **Analytics de Ventas**: Insights, tendencias, top productos
- 📄 **Reportes con IA**: Generación dinámica de reportes usando LLM
- 🤖 **Chatbot Asistente**: Asistente virtual para usuarios
- 💳 **Métodos de Pago**: Efectivo, QR, transferencia, tarjeta
- 🚚 **Métodos de Envío**: Estándar, express, pickup

### Frontend (React + Vite)
- 🎨 **UI Moderna** con TailwindCSS
- 🔐 **Auth Context** con manejo de roles
- 📱 **Responsive Design**
- 📊 **Dashboards Interactivos** con Chart.js
- 🛍️ **Catálogo de Productos** con filtros
- 📦 **Panel de Administración** (inventario, ventas, usuarios)
- 🤖 **Predicciones ML** visualizadas en tiempo real
- 📊 **Reportes con IA** generados dinámicamente

---

## 🛠️ Tecnologías

### Backend
- Python 3.13+
- Django 5.2.7
- Django REST Framework
- PostgreSQL / SQLite
- JWT (djangorestframework-simplejwt)
- scikit-learn (Machine Learning)
- pandas, numpy (Análisis de datos)
- Pillow (Procesamiento de imágenes)

### Frontend
- React 19.2.0
- Vite
- React Router v7
- TailwindCSS
- Chart.js + react-chartjs-2
- Axios
- React Hot Toast

---

## 📦 Requisitos Previos

- **Python**: 3.13 o superior
- **Node.js**: 18.x o superior
- **npm**: 9.x o superior
- **PostgreSQL**: 14+ (opcional, usa SQLite por defecto)
- **Git**

---

## 🚀 Instalación

### 1️⃣ Clonar el Repositorio

```bash
git clone https://github.com/IvanSuarezR/BoutiqueCruz_Backend.git
cd BoutiqueCruz_Backend
```

### 2️⃣ Backend - Instalación

#### Crear Entorno Virtual (Windows)

```powershell
cd Backend_Boutique
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### Crear Entorno Virtual (Linux/Mac)

```bash
cd Backend_Boutique
python3 -m venv venv
source venv/bin/activate
```

#### Instalar Dependencias

```bash
pip install --upgrade pip
pip install django djangorestframework djangorestframework-simplejwt
pip install django-cors-headers pillow python-decouple
pip install scikit-learn pandas numpy joblib
pip install django-extensions
```

O desde `requirements.txt` (si existe):

```bash
pip install -r requirements.txt
```

### 3️⃣ Frontend - Instalación

```bash
cd ../Frontend
npm install
```

---

## ⚙️ Configuración

### Backend - Archivo `.env`

Crea un archivo `.env` en `Backend_Boutique/` con:

```env
# Django Settings
SECRET_KEY=tu-clave-secreta-muy-larga-y-segura
DEBUG=True

# Database (opcional - usa PostgreSQL)
USE_POSTGRES=False
DB_NAME=boutique_db
DB_USER=postgres
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

# CORS (Frontend URL)
FRONTEND_URL=http://localhost:5173
```

**Nota**: Por defecto usa SQLite. Para usar PostgreSQL, cambia `USE_POSTGRES=True`.

### Frontend - Configuración Axios

El frontend ya está configurado para conectarse a `http://localhost:8000/api`. Si cambias el puerto del backend, actualiza en `Frontend/src/services/axiosConfig.js`.

---

## 🗃️ Carga de Datos

### 1️⃣ Aplicar Migraciones

```bash
cd Backend_Boutique
python manage.py migrate
```

### 2️⃣ Crear Superusuario (Desarrollador)

```bash
python manage.py createsuperuser
# Username: admin
# Email: admin@boutique.com
# Password: admin123
```

### 3️⃣ Inicializar Sistema RBAC (Roles y Permisos)

```bash
python manage.py seed_rbac
```

Este comando crea:
- **Permisos**: `inventory.manage`, `sales.create`, `sales.view`, `users.manage`, etc.
- **Roles**: Owner, Seller, Inventory Manager, Viewer
- Asigna rol "Owner" a usuarios con `user_type='admin'` (opcional: `--assign-owners`)

### 4️⃣ Poblar Datos de Ventas (Para ML)

Este comando crea **180 días de historial de ventas** (6 meses) con datos realistas para entrenar modelos de ML:

```bash
python manage.py seed_sales_data
```

**Crea automáticamente:**
- 10 categorías de productos (Camisas, Pantalones, Vestidos, Zapatos, etc.)
- 40 productos activos con variantes y precios
- 197 clientes con direcciones
- 2,170+ órdenes distribuidas en 180 días (promedio 12 órdenes/día)
- 5 métodos de envío (estándar, express, pickup)
- 8 métodos de pago (efectivo, QR, transferencia, tarjeta)

**Opciones:**
```bash
# Personalizar días de historial
python manage.py seed_sales_data --days 90  # 3 meses
python manage.py seed_sales_data --days 365  # 1 año
```

### 5️⃣ (Opcional) Poblar Más Datos

Si necesitas más categorías, productos o clientes personalizados, usa el admin de Django:

```bash
python manage.py runserver
# Accede a http://localhost:8000/admin con el superusuario
```

---

## ▶️ Ejecución

### Backend

```bash
cd Backend_Boutique
python manage.py runserver
```

Accede a: **http://localhost:8000**

### Frontend

```bash
cd Frontend
npm run dev
```

Accede a: **http://localhost:5173**

### Verificar URLs Disponibles

```bash
python manage.py show_urls
```

---

## 📁 Estructura del Proyecto

```
BoutiqueCruz_Backend/
├── Backend_Boutique/
│   ├── accounts/              # Autenticación, usuarios, RBAC
│   ├── inventory/             # Productos, categorías, stock
│   ├── orders/                # Órdenes, carrito, checkout
│   ├── sales/                 # Gestión de ventas
│   ├── ml_predictions/        # Machine Learning (predicciones)
│   │   ├── services/
│   │   │   ├── sales_forecast.py    # Servicio de predicción
│   │   │   └── sales_insights.py    # Insights de ventas
│   │   └── management/commands/
│   │       └── seed_sales_data.py   # Población de datos
│   ├── reports/               # Reportes con IA
│   ├── assistant/             # Chatbot asistente
│   ├── boutique_Main/         # Configuración principal
│   ├── media/                 # Archivos subidos (productos)
│   ├── manage.py
│   └── db.sqlite3             # Base de datos SQLite
│
├── Frontend/
│   ├── src/
│   │   ├── components/        # Componentes reutilizables
│   │   ├── context/           # AuthContext, CartContext
│   │   ├── pages/             # Páginas de la app
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MLPredictions.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Browse.jsx
│   │   │   └── ...
│   │   ├── services/          # Axios config
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🔌 API Endpoints

### Autenticación
```
POST   /api/auth/login/           # Login (obtiene access y refresh tokens)
POST   /api/auth/register/        # Registro de usuarios
POST   /api/auth/logout/          # Logout (blacklist refresh token)
POST   /api/auth/token/refresh/   # Refrescar access token
GET    /api/auth/me/              # Obtener usuario actual
```

### Inventario
```
GET    /api/inventory/categories/         # Listar categorías
POST   /api/inventory/categories/         # Crear categoría
GET    /api/inventory/products/           # Listar productos
POST   /api/inventory/products/           # Crear producto
GET    /api/inventory/products/:id/       # Detalle de producto
PUT    /api/inventory/products/:id/       # Actualizar producto
DELETE /api/inventory/products/:id/       # Eliminar producto
```

### Órdenes
```
GET    /api/orders/                       # Listar órdenes
POST   /api/orders/                       # Crear orden
GET    /api/orders/:id/                   # Detalle de orden
GET    /api/cart/                         # Obtener carrito
POST   /api/cart/items/                   # Agregar item al carrito
```

### Machine Learning
```
POST   /api/ml/train-sales-forecast/     # Entrenar modelo de predicción
POST   /api/ml/predict-sales/            # Generar predicciones (días futuros)
GET    /api/ml/sales-analytics/          # Analytics de ventas históricas

# Insights de Ventas
GET    /api/ml/insights/top-products/         # Top productos vendidos
GET    /api/ml/insights/category-performance/ # Rendimiento por categoría
GET    /api/ml/insights/sales-by-day/         # Ventas por día de semana
GET    /api/ml/insights/monthly-trends/       # Tendencias mensuales
GET    /api/ml/insights/customers/            # Top clientes
GET    /api/ml/insights/low-stock/            # Alertas de stock bajo
GET    /api/ml/insights/payment-methods/      # Estadísticas de pagos
GET    /api/ml/insights/comprehensive/        # Dashboard completo
```

### Reportes
```
POST   /api/reports/generate/            # Generar reporte con IA
GET    /api/reports/logs/                # Historial de reportes
```

### Asistente (Chatbot)
```
POST   /api/assistant/chat/              # Enviar mensaje al chatbot
GET    /api/assistant/conversations/     # Listar conversaciones
```

---

## 🔐 Permisos y Roles

### Roles Disponibles
- **Owner** (Dueño): Acceso total
- **Seller** (Vendedor): Ventas, inventario (lectura), reportes
- **Inventory Manager**: Gestión completa de inventario
- **Viewer**: Solo lectura

### Permisos del Sistema
- `inventory.manage` - Gestionar inventario
- `sales.create` - Crear ventas
- `sales.view` - Ver ventas
- `users.manage` - Gestionar usuarios
- `reports.generate` - Generar reportes

### Usuarios de Prueba

Después de ejecutar `seed_rbac`, puedes crear usuarios manualmente o usar el admin de Django.

**Ejemplo de usuario Owner:**
```python
# En Django shell: python manage.py shell
from accounts.models import CustomUser
user = CustomUser.objects.create_user(
    username='owner1',
    email='owner@boutique.com',
    password='password123',
    first_name='Juan',
    last_name='Pérez',
    user_type='owner',
    identification_number='12345678'
)
# El comando seed_rbac ya asignó el rol Owner a users con user_type='admin'
```

---

## 🔧 Comandos Útiles

### Backend

```bash
# Ver todas las URLs del proyecto
python manage.py show_urls

# Crear migraciones
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate

# Abrir shell de Django
python manage.py shell

# Crear superusuario
python manage.py createsuperuser

# Inicializar RBAC (roles y permisos)
python manage.py seed_rbac

# Poblar datos de ventas para ML (180 días)
python manage.py seed_sales_data

# Poblar datos personalizados (90 días)
python manage.py seed_sales_data --days 90

# Ejecutar servidor
python manage.py runserver
```

### Frontend

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Build para producción
npm run build

# Preview del build
npm run preview
```

---

## 📊 Machine Learning - Uso

### 1. Entrenar Modelo

**Endpoint:** `POST /api/ml/train-sales-forecast/`

```json
{
  "model_type": "random_forest"  // Opciones: random_forest, gradient_boosting, linear
}
```

**Respuesta:**
```json
{
  "success": true,
  "model_id": "uuid",
  "metrics": {
    "test_r2": 0.85,
    "test_rmse": 123.45,
    "test_mae": 98.76
  },
  "duration_seconds": 5
}
```

### 2. Generar Predicciones

**Endpoint:** `POST /api/ml/predict-sales/`

```json
{
  "days_ahead": 30  // Días a predecir (1-365)
}
```

**Respuesta:**
```json
{
  "success": true,
  "predictions": [
    {
      "date": "2025-11-11",
      "predicted_sales": 1250.50,
      "predicted_quantity": 15
    },
    // ... 29 días más
  ],
  "summary": {
    "total_predicted_sales": 37515.00,
    "avg_daily_sales": 1250.50,
    "days_predicted": 30
  }
}
```

### 3. Ver Analytics

**Endpoint:** `GET /api/ml/sales-analytics/`

```json
{
  "success": true,
  "sales_30d": {
    "total": 45000.00,
    "count": 350,
    "avg": 128.57
  },
  "sales_7d": {
    "total": 8750.00,
    "count": 82,
    "avg": 106.71
  },
  "top_products": [
    {
      "product__name": "Camisa Formal Blanca",
      "total_quantity": 45,
      "total_revenue": 12600.00
    }
  ]
}
```

---

## 🐛 Solución de Problemas

### Error: `ModuleNotFoundError: No module named 'rest_framework'`
```bash
pip install djangorestframework
```

### Error: `No module named 'sklearn'`
```bash
pip install scikit-learn pandas numpy
```

### Error: `Datos insuficientes para entrenar el modelo`
```bash
# Ejecuta el comando de población de datos
python manage.py seed_sales_data
```

### Frontend no se conecta al Backend
- Verifica que el backend esté corriendo en `http://localhost:8000`
- Revisa `Frontend/src/services/axiosConfig.js` que apunte a la URL correcta

### CORS Errors
- Asegúrate de tener `django-cors-headers` instalado
- Verifica `CORS_ALLOWED_ORIGINS` en `settings.py` incluya `http://localhost:5173`

---

## 📝 Licencia

Este proyecto es privado. Todos los derechos reservados.

---

## 👥 Autores

- **Ivan Suarez R** - Desarrollo Full Stack
- **Boutique Cruz** - Cliente

---

## 📧 Contacto

Para preguntas o soporte:
- Email: contacto@boutiquecruz.com
- GitHub: [@IvanSuarezR](https://github.com/IvanSuarezR)

---

## 🎯 Próximas Mejoras

- [ ] Integración con pasarelas de pago reales (Stripe, PayPal)
- [ ] Notificaciones push para órdenes
- [ ] Dashboard de métricas en tiempo real
- [ ] Exportación de reportes a PDF/Excel
- [ ] Módulo de devoluciones y reembolsos
- [ ] Integración con servicios de envío (tracking)
- [ ] Mejoras en el chatbot con contexto de usuario
- [ ] Panel de control para dueño con KPIs

---

**¡Gracias por usar Boutique Cruz! 🛍️**
