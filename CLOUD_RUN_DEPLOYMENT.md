# 🚀 Guía de Despliegue en Google Cloud Run

Esta guía te ayudará a desplegar tu aplicación **Boutique Cruz** (Backend Django + Frontend React) en Google Cloud Run.

## 📋 Requisitos Previos

1. **Cuenta de Google Cloud** con facturación habilitada
2. **Google Cloud CLI** instalado ([Descargar aquí](https://cloud.google.com/sdk/docs/install))
3. **Git** y tu código en GitHub
4. **Proyecto en Google Cloud** creado

## 🏗️ Arquitectura de Despliegue

```
┌─────────────────────┐
│   FRONTEND (React)  │  ← Cloud Run Service 1
│   nginx:alpine      │     Puerto 8080
└──────────┬──────────┘
           │
           │ API Calls
           ▼
┌─────────────────────┐
│  BACKEND (Django)   │  ← Cloud Run Service 2
│  Python + Gunicorn  │     Puerto 8080
└──────────┬──────────┘
           │
           ├─────► Cloud SQL (PostgreSQL)
           ├─────► Cloud Storage (Imágenes)
           └─────► Secret Manager (Claves)
```

---

## 🔧 PASO 1: Configuración Inicial de Google Cloud

### 1.1 Autenticación

```bash
# Iniciar sesión
gcloud auth login

# Configurar proyecto (reemplaza con tu PROJECT_ID)
gcloud config set project TU-PROJECT-ID

# Verificar configuración
gcloud config list
```

### 1.2 Habilitar APIs Necesarias

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

---

## 🗄️ PASO 2: Configurar Cloud SQL (PostgreSQL)

### 2.1 Crear Instancia

```bash
gcloud sql instances create boutique-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=TU-PASSWORD-SEGURO
```

### 2.2 Crear Base de Datos

```bash
gcloud sql databases create boutique_db \
  --instance=boutique-db
```

### 2.3 Obtener Connection String

```bash
# Esto te dará algo como: proyecto:region:instancia
gcloud sql instances describe boutique-db \
  --format="value(connectionName)"
```

**Nota:** Guarda este valor, lo necesitarás como `POSTGRES_HOST`

---

## 🪣 PASO 3: Configurar Cloud Storage

### 3.1 Crear Bucket

```bash
# Reemplaza BUCKET-NAME con un nombre único
gsutil mb -l us-central1 gs://boutique-media-bucket

# Hacer público para lectura (solo los archivos media)
gsutil iam ch allUsers:objectViewer gs://boutique-media-bucket
```

### 3.2 Configurar CORS

```bash
# Crear archivo cors.json
cat > cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "DELETE", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
EOF

# Aplicar CORS
gsutil cors set cors.json gs://boutique-media-bucket
```

---

## 🔐 PASO 4: Configurar Secret Manager

### 4.1 Crear Secretos

```bash
# Django Secret Key
echo -n "tu-clave-secreta-super-segura-minimo-50-caracteres" | \
  gcloud secrets create django-secret-key --data-file=-

# Postgres Password
echo -n "tu-password-postgres" | \
  gcloud secrets create postgres-password --data-file=-

# Groq API Key
echo -n "tu-groq-api-key" | \
  gcloud secrets create groq-api-key --data-file=-

# Stripe Secret Key
echo -n "sk_live_..." | \
  gcloud secrets create stripe-secret-key --data-file=-
```

### 4.2 Dar Permisos a Cloud Run

```bash
PROJECT_NUMBER=$(gcloud projects describe TU-PROJECT-ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding django-secret-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repetir para cada secreto: postgres-password, groq-api-key, stripe-secret-key
```

---

## 🐳 PASO 5: Actualizar Settings de Django

Edita `Backend_Boutique/boutique_Main/settings.py`:

```python
import os
from google.cloud import secretmanager

# Helper para obtener secretos en Cloud Run
def get_secret(secret_id):
    """Obtener secreto de Secret Manager"""
    if os.getenv('GAE_ENV', '').startswith('standard'):
        # Corriendo en Google Cloud
        try:
            client = secretmanager.SecretManagerServiceClient()
            project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode('UTF-8')
        except Exception:
            pass
    # Fallback a variable de entorno
    return os.getenv(secret_id.upper().replace('-', '_'))

# Configuración para producción
DEBUG = os.getenv('DEBUG', 'False') == 'True'
SECRET_KEY = get_secret('django-secret-key') or os.getenv('SECRET_KEY')
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',') + ['*.run.app']

# CORS - agregar tu dominio frontend
CORS_ALLOWED_ORIGINS = [
    'https://tu-frontend-url.run.app',
    'http://localhost:5173',
]

# Database - Usar Unix socket para Cloud SQL
if os.getenv('USE_POSTGRES') == 'true':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('POSTGRES_DB'),
            'USER': os.getenv('POSTGRES_USER'),
            'PASSWORD': get_secret('postgres-password'),
            'HOST': os.getenv('POSTGRES_HOST'),  # /cloudsql/project:region:instance
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
        }
    }
```

---

## 🚀 PASO 6: Desplegar Backend

### 6.1 Desde Local (con gcloud)

```bash
cd Backend_Boutique

gcloud run deploy boutique-backend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --add-cloudsql-instances=TU-PROJECT:us-central1:boutique-db \
  --set-env-vars "DEBUG=False,USE_POSTGRES=true,USE_GCS=true,POSTGRES_DB=boutique_db,POSTGRES_USER=postgres,POSTGRES_HOST=/cloudsql/TU-PROJECT:us-central1:boutique-db,GS_BUCKET_NAME=boutique-media-bucket,GS_PROJECT_ID=TU-PROJECT" \
  --set-secrets "SECRET_KEY=django-secret-key:latest,POSTGRES_PASSWORD=postgres-password:latest,GROQ_API_KEY=groq-api-key:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest"
```

### 6.2 Desde GitHub (Cloud Build)

Crea archivo `cloudbuild.yaml` en raíz:

```yaml
steps:
  # Build Backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/boutique-backend', './Backend_Boutique']
  
  # Push Backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/boutique-backend']
  
  # Deploy Backend
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'boutique-backend'
      - '--image=gcr.io/$PROJECT_ID/boutique-backend'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'

images:
  - 'gcr.io/$PROJECT_ID/boutique-backend'
```

Ejecutar:

```bash
gcloud builds submit --config=cloudbuild.yaml
```

### 6.3 Verificar Despliegue

```bash
# Ver logs
gcloud run services logs read boutique-backend --region=us-central1 --limit=50

# Obtener URL
gcloud run services describe boutique-backend --region=us-central1 --format="value(status.url)"
```

---

## 🎨 PASO 7: Desplegar Frontend

### 7.1 Actualizar Variables de Entorno

Edita `Frontend/src/services/api.js` o archivo de configuración:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
```

### 7.2 Desplegar

```bash
cd Frontend

gcloud run deploy boutique-frontend \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "VITE_API_URL=https://boutique-backend-XXXXX.run.app"
```

**Importante:** Reemplaza `XXXXX` con la URL real de tu backend.

### 7.3 Actualizar CORS en Backend

Una vez que tengas la URL del frontend, actualiza el backend:

```bash
gcloud run services update boutique-backend \
  --region=us-central1 \
  --update-env-vars "CORS_ALLOWED_ORIGINS=https://boutique-frontend-XXXXX.run.app"
```

---

## ✅ PASO 8: Verificación Post-Despliegue

### 8.1 Health Checks

```bash
# Backend
curl https://boutique-backend-XXXXX.run.app/api/health

# Frontend
curl https://boutique-frontend-XXXXX.run.app/health
```

### 8.2 Ejecutar Migraciones (si no se hicieron automáticamente)

```bash
# Conectar a Cloud Run temporalmente
gcloud run services proxy boutique-backend --region=us-central1 --port=8080

# En otra terminal
curl -X POST http://localhost:8080/api/admin/migrate
```

O usar Cloud Run Jobs:

```bash
gcloud run jobs create boutique-migrate \
  --image=gcr.io/TU-PROJECT/boutique-backend \
  --region=us-central1 \
  --set-cloudsql-instances=TU-PROJECT:us-central1:boutique-db \
  --set-env-vars "USE_POSTGRES=true,POSTGRES_HOST=/cloudsql/..." \
  --command="python,manage.py,migrate"

gcloud run jobs execute boutique-migrate --region=us-central1
```

---

## 🔄 PASO 9: CI/CD con GitHub Actions (Opcional)

Crea archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloud Run

on:
  push:
    branches: [main]

env:
  PROJECT_ID: TU-PROJECT-ID
  REGION: us-central1

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - uses: google-github-actions/setup-gcloud@v1
      
      - name: Deploy Backend
        run: |
          cd Backend_Boutique
          gcloud run deploy boutique-backend \
            --source . \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v3
      
      - uses: google-github-actions/auth@v1
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      
      - uses: google-github-actions/setup-gcloud@v1
      
      - name: Deploy Frontend
        run: |
          cd Frontend
          gcloud run deploy boutique-frontend \
            --source . \
            --region ${{ env.REGION }} \
            --platform managed \
            --allow-unauthenticated
```

---

## 💰 PASO 10: Optimización de Costos

### 10.1 Configurar Scaling

```bash
# Backend - escala a 0 cuando no hay tráfico
gcloud run services update boutique-backend \
  --region=us-central1 \
  --min-instances=0 \
  --max-instances=10 \
  --cpu-throttling

# Frontend - puede tener 1 instancia mínima para mejor respuesta
gcloud run services update boutique-frontend \
  --region=us-central1 \
  --min-instances=0 \
  --max-instances=5
```

### 10.2 Cloud SQL - Usar instancia pequeña

Para desarrollo/testing:
```bash
gcloud sql instances patch boutique-db \
  --tier=db-f1-micro \
  --activation-policy=ALWAYS
```

Para producción con poco tráfico:
```bash
gcloud sql instances patch boutique-db \
  --tier=db-g1-small \
  --activation-policy=ALWAYS
```

---

## 🐛 Troubleshooting

### Problema: "Error connecting to Cloud SQL"

**Solución:**
1. Verificar que agregaste `--add-cloudsql-instances` al desplegar
2. Verificar que el service account tiene permisos `cloudsql.client`

```bash
PROJECT_NUMBER=$(gcloud projects describe TU-PROJECT --format="value(projectNumber)")
gcloud projects add-iam-policy-binding TU-PROJECT \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### Problema: "CORS errors" en frontend

**Solución:**
Agregar dominio frontend a ALLOWED_HOSTS y CORS_ALLOWED_ORIGINS en settings.py:

```python
CORS_ALLOWED_ORIGINS = [
    'https://boutique-frontend-xxxx.run.app',
]
```

### Problema: "Container failed to start"

**Solución:**
Ver logs detallados:

```bash
gcloud run services logs read boutique-backend --region=us-central1 --limit=100
```

### Problema: "Static files not loading"

**Solución:**
Usar WhiteNoise para servir archivos estáticos:

```bash
pip install whitenoise

# En settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # ← Agregar
    ...
]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
```

---

## 📊 Monitoreo

### Ver Métricas

```bash
# CPU y Memoria
gcloud run services describe boutique-backend --region=us-central1

# Requests
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=boutique-backend" --limit=20
```

### Configurar Alertas

En Cloud Console > Monitoring > Alerting:
- CPU > 80%
- Memory > 90%
- Request latency > 2s
- Error rate > 5%

---

## 🔒 Seguridad

### Checklist de Seguridad

- [ ] DEBUG=False en producción
- [ ] SECRET_KEY en Secret Manager
- [ ] Contraseñas en Secret Manager
- [ ] ALLOWED_HOSTS configurado correctamente
- [ ] CORS configurado solo con dominios necesarios
- [ ] Cloud SQL con IP privada (opcional)
- [ ] Habilitar Cloud Armor para DDoS protection
- [ ] Configurar Identity-Aware Proxy para admin

---

## 📞 Recursos Adicionales

- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Cloud SQL Docs](https://cloud.google.com/sql/docs)
- [Cloud Storage Docs](https://cloud.google.com/storage/docs)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)

---

## 💡 Comandos Útiles

```bash
# Ver todos los servicios
gcloud run services list --region=us-central1

# Eliminar servicio
gcloud run services delete boutique-backend --region=us-central1

# Ver costos estimados
gcloud billing accounts list
gcloud alpha billing accounts get-iam-policy ACCOUNT_ID

# Exportar configuración actual
gcloud run services describe boutique-backend --region=us-central1 --format=yaml > backend-config.yaml
```

---

¡Listo! Tu aplicación debería estar corriendo en Cloud Run 🎉
