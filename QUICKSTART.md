# 🚀 Guía Rápida de Inicio - Boutique Cruz

## ⚡ Inicio Rápido (5 minutos)

### 1. Clonar y Configurar Backend

```powershell
# Clonar repositorio
git clone https://github.com/IvanSuarezR/BoutiqueCruz_Backend.git
cd BoutiqueCruz_Backend/Backend_Boutique

# Crear entorno virtual
python -m venv venv
.\venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt

# Configurar .env
copy .env.example .env
# Edita .env si necesitas cambiar configuraciones

# Aplicar migraciones
python manage.py migrate

# Crear superusuario
python manage.py createsuperuser

# Inicializar roles y permisos
python manage.py seed_rbac

# Poblar datos de ventas (180 días)
python manage.py seed_sales_data

# Ejecutar servidor
python manage.py runserver
```

### 2. Configurar Frontend

```powershell
# En otra terminal
cd Frontend
npm install
npm run dev
```

### 3. Acceder

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **Admin Django**: http://localhost:8000/admin

---

## 📊 Entrenar Modelo ML

### Opción 1: Desde Postman/Insomnia

```
POST http://localhost:8000/api/ml/train-sales-forecast/
Headers: 
  Authorization: Bearer <tu_access_token>
  Content-Type: application/json
Body:
{
  "model_type": "random_forest"
}
```

### Opción 2: Desde el Frontend

1. Login con usuario admin/owner
2. Ve a **Dashboard** → **ML Predictions**
3. Click en **"Entrenar Modelo"**
4. Espera 5-10 segundos
5. ¡Listo! Ahora puedes generar predicciones

---

## 🔑 Credenciales de Prueba

### Superusuario (Desarrollador)
- **Username**: admin
- **Password**: admin123
- **Acceso**: Admin Django completo

### Usuario Owner (Dueño)
Después de `seed_rbac`, crea manualmente o usa:
```python
# python manage.py shell
from accounts.models import CustomUser
user = CustomUser.objects.create_user(
    username='owner',
    email='owner@boutique.com',
    password='owner123',
    first_name='Juan',
    last_name='Pérez',
    user_type='owner',
    identification_number='12345678'
)
```

---

## 🛠️ Comandos Útiles

### Backend
```bash
# Ver todas las URLs
python manage.py show_urls

# Limpiar y repoblar datos
python manage.py seed_sales_data --days 90

# Abrir shell
python manage.py shell

# Crear migración
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate
```

### Frontend
```bash
# Desarrollo
npm run dev

# Build
npm run build

# Preview
npm run preview
```

---

## 📝 Endpoints Principales

### Autenticación
```
POST /api/auth/login/           - Login
POST /api/auth/register/        - Registro
GET  /api/auth/me/              - Usuario actual
```

### ML Predictions
```
POST /api/ml/train-sales-forecast/  - Entrenar modelo
POST /api/ml/predict-sales/         - Generar predicciones
GET  /api/ml/sales-analytics/       - Analytics
GET  /api/ml/insights/comprehensive/ - Dashboard completo
```

### Inventario
```
GET  /api/inventory/products/       - Listar productos
POST /api/inventory/products/       - Crear producto
GET  /api/inventory/categories/     - Listar categorías
```

---

## 🐛 Problemas Comunes

### Error: No module named 'X'
```bash
pip install -r requirements.txt
```

### Puerto 8000 ocupado
```bash
# Cambiar puerto
python manage.py runserver 8001
```

### CORS Error
Verifica que `FRONTEND_URL=http://localhost:5173` esté en tu `.env`

### Datos insuficientes para ML
```bash
python manage.py seed_sales_data
```

---

## 📚 Más Información

Ver [README.md](README.md) completo para documentación detallada.

---

**¡Listo para empezar! 🎉**
