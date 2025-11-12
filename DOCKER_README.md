# 🐳 Docker & Cloud Run - Boutique Cruz

Este proyecto está configurado para desplegarse en **Google Cloud Run** usando contenedores Docker.

## 📁 Estructura de Archivos Docker

```
BoutiqueCruz_Backend/
├── Backend_Boutique/
│   ├── Dockerfile              # Imagen Docker para Django
│   ├── entrypoint.sh          # Script de inicio
│   ├── .dockerignore          # Archivos a ignorar
│   └── cloudrun-backend.yaml  # Configuración Cloud Run
│
├── Frontend/
│   ├── Dockerfile              # Imagen Docker para React
│   ├── nginx.conf             # Configuración Nginx
│   ├── entrypoint.sh          # Script de inicio
│   ├── .dockerignore          # Archivos a ignorar
│   └── cloudrun-frontend.yaml # Configuración Cloud Run
│
├── deploy.sh                   # Script de despliegue rápido
└── CLOUD_RUN_DEPLOYMENT.md    # Guía completa
```

## 🚀 Opciones de Despliegue

### Opción 1: Despliegue Directo (SIN Docker local)

**✅ RECOMENDADO** - No necesitas Docker instalado en tu máquina.

Cloud Run construirá las imágenes automáticamente desde el código fuente:

```bash
# 1. Configurar gcloud
gcloud auth login
gcloud config set project TU-PROJECT-ID

# 2. Backend
cd Backend_Boutique
gcloud run deploy boutique-backend --source . --region us-central1

# 3. Frontend
cd ../Frontend
gcloud run deploy boutique-frontend --source . --region us-central1
```

### Opción 2: Con GitHub Actions (CI/CD)

**✅ RECOMENDADO para producción**

1. Configura GitHub Actions (ver `.github/workflows/deploy.yml` en la guía)
2. Cada push a `main` desplegará automáticamente
3. No necesitas Docker local

### Opción 3: Build Local + Push (Requiere Docker)

Solo si quieres probar las imágenes localmente:

```bash
# Backend
cd Backend_Boutique
docker build -t boutique-backend .
docker run -p 8080:8080 --env-file .env boutique-backend

# Frontend
cd ../Frontend
docker build -t boutique-frontend .
docker run -p 8080:8080 boutique-frontend
```

## 🎯 Recomendación para tu Caso

Como mencionaste que **Docker no funciona en tu máquina**, usa la **Opción 1**:

### Pasos Rápidos:

1. **Instalar Google Cloud SDK** (solo CLI, no Docker):
   ```bash
   # Windows (PowerShell como administrador)
   (New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
   & $env:Temp\GoogleCloudSDKInstaller.exe
   ```

2. **Autenticar**:
   ```bash
   gcloud auth login
   gcloud config set project TU-PROJECT-ID
   ```

3. **Desplegar desde código fuente**:
   ```bash
   # Backend
   cd Backend_Boutique
   gcloud run deploy boutique-backend --source . --region us-central1 --allow-unauthenticated

   # Frontend
   cd ../Frontend
   gcloud run deploy boutique-frontend --source . --region us-central1 --allow-unauthenticated
   ```

Cloud Build construirá las imágenes Docker **en la nube** usando los Dockerfiles que creé.

## 📝 Archivos Importantes

### Backend - `Dockerfile`
- Usa Python 3.11 slim
- Instala dependencias desde `requirements.txt`
- Usa Gunicorn como servidor WSGI
- Puerto 8080 (requerido por Cloud Run)
- Ejecuta migraciones en el inicio

### Frontend - `Dockerfile`
- Build multi-stage (Node.js → Nginx)
- Build optimizado de producción con Vite
- Nginx sirve archivos estáticos
- Puerto 8080
- Soporte para React Router

## 🔑 Variables de Entorno

### Backend (Cloud Run Console o gcloud):
```bash
DEBUG=False
SECRET_KEY=xxx
USE_POSTGRES=true
POSTGRES_HOST=/cloudsql/project:region:instance
GS_BUCKET_NAME=xxx
GROQ_API_KEY=xxx
```

### Frontend:
```bash
VITE_API_URL=https://boutique-backend-xxx.run.app
```

## 🧪 Testing Local (Opcional)

Si logras arreglar Docker localmente:

```bash
# Backend
cd Backend_Boutique
docker build -t test-backend .
docker run -p 8080:8080 \
  -e DEBUG=True \
  -e SECRET_KEY=test \
  test-backend

# Frontend
cd Frontend
docker build -t test-frontend .
docker run -p 8080:8080 test-frontend
```

## 📊 Arquitectura en Cloud Run

```
┌──────────────────────────────────────────┐
│          Google Cloud Platform           │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │     Cloud Run - Frontend           │ │
│  │     (Nginx + React Build)          │ │
│  │     Port 8080                      │ │
│  └──────────────┬─────────────────────┘ │
│                 │                        │
│                 │ HTTPS                  │
│                 ▼                        │
│  ┌────────────────────────────────────┐ │
│  │     Cloud Run - Backend            │ │
│  │     (Django + Gunicorn)            │ │
│  │     Port 8080                      │ │
│  └──┬─────────┬────────────┬──────────┘ │
│     │         │            │            │
│     ▼         ▼            ▼            │
│  Cloud SQL  Storage   Secret Manager   │
└──────────────────────────────────────────┘
```

## 💰 Costos Estimados

Con tráfico bajo:
- Cloud Run Frontend: ~$0-5/mes (con min-instances=0)
- Cloud Run Backend: ~$0-10/mes (con min-instances=0)
- Cloud SQL (f1-micro): ~$7/mes
- Cloud Storage: ~$0.01-2/mes

**Total: ~$10-20/mes** para un sitio con poco tráfico.

## 🔄 Actualización de Código

Para actualizar después del primer despliegue:

```bash
# Backend
cd Backend_Boutique
gcloud run deploy boutique-backend --source . --region us-central1

# Frontend
cd Frontend
gcloud run deploy boutique-frontend --source . --region us-central1
```

O simplemente haz `git push origin main` si configuraste GitHub Actions.

## 🆘 Ayuda Rápida

**Ver logs:**
```bash
gcloud run services logs read boutique-backend --region us-central1 --limit 50
```

**Ver URL del servicio:**
```bash
gcloud run services describe boutique-backend --region us-central1 --format="value(status.url)"
```

**Eliminar servicio:**
```bash
gcloud run services delete boutique-backend --region us-central1
```

## 📚 Documentación Completa

Ver `CLOUD_RUN_DEPLOYMENT.md` para la guía completa paso a paso con:
- Configuración de Cloud SQL
- Cloud Storage
- Secret Manager
- CI/CD con GitHub Actions
- Troubleshooting
- Optimización de costos

## ✅ Checklist Pre-Despliegue

- [ ] Google Cloud SDK instalado
- [ ] Proyecto GCP creado con facturación
- [ ] APIs habilitadas (`gcloud services enable run.googleapis.com cloudbuild.googleapis.com`)
- [ ] Variables de entorno preparadas
- [ ] Código subido a GitHub (para CI/CD opcional)
- [ ] `DEBUG=False` en producción
- [ ] SECRET_KEY generada y segura

---

**¿Listo para desplegar?** Usa el script automático:

```bash
chmod +x deploy.sh
./deploy.sh
```

O sigue la guía completa en `CLOUD_RUN_DEPLOYMENT.md`.
