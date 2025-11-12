# 🚀 Configuración de CI/CD con GitHub Actions

Esta guía te ayudará a configurar el despliegue automático desde GitHub a Google Cloud Run.

## 📋 Resumen

Con esta configuración, cada vez que hagas `git push origin main`, tu aplicación se desplegará automáticamente en Cloud Run.

## 🔑 PASO 1: Crear Service Account en Google Cloud

### 1.1 Crear Service Account

```bash
# Reemplaza con tu PROJECT_ID
PROJECT_ID="acoustic-art-473804-v8"

# Crear Service Account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deployer" \
    --project=$PROJECT_ID
```

### 1.2 Dar Permisos Necesarios

```bash
# Email del Service Account
SA_EMAIL="github-actions@${PROJECT_ID}.iam.gserviceaccount.com"

# Permisos para Cloud Run
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/run.admin"

# Permisos para Cloud Build
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/cloudbuild.builds.editor"

# Permisos para Storage (para subir imágenes Docker)
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.admin"

# Permisos para Artifact Registry
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/artifactregistry.admin"

# Permisos para actuar como Service Account
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/iam.serviceAccountUser"
```

### 1.3 Crear y Descargar Clave JSON

```bash
# Crear clave
gcloud iam service-accounts keys create github-actions-key.json \
    --iam-account=$SA_EMAIL

# Esto creará el archivo github-actions-key.json
# ⚠️ IMPORTANTE: Guarda este archivo de forma segura, lo necesitarás en el siguiente paso
```

## 🔐 PASO 2: Configurar Secret en GitHub

### 2.1 Abrir el contenido del archivo JSON

**En PowerShell:**
```powershell
Get-Content github-actions-key.json | Set-Clipboard
```

**O manualmente:**
```powershell
notepad github-actions-key.json
```

### 2.2 Agregar Secret a GitHub

1. Ve a tu repositorio en GitHub: https://github.com/IvanSuarezR/BoutiqueCruz_Backend
2. Click en **Settings** → **Secrets and variables** → **Actions**
3. Click en **New repository secret**
4. Nombre: `GCP_SA_KEY`
5. Valor: Pega todo el contenido del archivo JSON
6. Click en **Add secret**

## ✅ PASO 3: Verificar Workflows

Los siguientes workflows ya están creados:

### 📄 `.github/workflows/deploy-full-stack.yml`
- **Trigger:** Push a `main` o ejecución manual
- **Acción:** Despliega Backend y Frontend automáticamente
- **Recomendado:** Para despliegues completos

### 📄 `.github/workflows/deploy-backend.yml`
- **Trigger:** Push a `main` con cambios en `Backend_Boutique/`
- **Acción:** Solo despliega el Backend

### 📄 `.github/workflows/deploy-frontend.yml`
- **Trigger:** Push a `main` con cambios en `Frontend/`
- **Acción:** Solo despliega el Frontend

## 🚀 PASO 4: Primer Despliegue

### Opción A: Push a GitHub (Automático)

```bash
cd E:\aplicacion\proyecto\BoutiqueCruz_Backend

# Agregar archivos de GitHub Actions
git add .github/
git commit -m "feat: Add CI/CD with GitHub Actions"

# Push a main
git push origin main
```

GitHub Actions se ejecutará automáticamente.

### Opción B: Ejecución Manual

1. Ve a: https://github.com/IvanSuarezR/BoutiqueCruz_Backend/actions
2. Click en el workflow **"Deploy Full Stack to Cloud Run"**
3. Click en **Run workflow** → **Run workflow**

## 📊 Monitorear Despliegue

### En GitHub:
1. Ve a: https://github.com/IvanSuarezR/BoutiqueCruz_Backend/actions
2. Verás el progreso en tiempo real
3. Click en el workflow para ver detalles

### En Google Cloud Console:
1. Ve a: https://console.cloud.google.com/run?project=acoustic-art-473804-v8
2. Verás los servicios desplegados

## 🔄 Flujo de Trabajo

```
┌─────────────────────────────────────────────────┐
│  Desarrollador hace cambios                     │
│  git add . && git commit -m "msg"               │
│  git push origin main                           │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  GitHub detecta push a main                     │
│  Ejecuta workflow automáticamente               │
└─────────────────┬───────────────────────────────┘
                  │
                  ├─────────────────────────────────┐
                  │                                 │
                  ▼                                 ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  Job 1: Deploy Backend   │    │  Job 2: Deploy Frontend  │
│  1. Build Docker image   │    │  Espera a Job 1          │
│  2. Push to registry     │    │  1. Build Docker image   │
│  3. Deploy to Cloud Run  │    │  2. Push to registry     │
│  4. Return backend URL   │    │  3. Deploy to Cloud Run  │
└────────────┬─────────────┘    │  4. Update CORS          │
             │                  └──────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│  Aplicación desplegada en producción 🎉        │
│  Backend: https://boutique-backend-xxx.run.app  │
│  Frontend: https://boutique-frontend-xxx.run.app│
└─────────────────────────────────────────────────┘
```

## 🎯 Ventajas de este Setup

✅ **Despliegue automático:** Solo haz `git push`
✅ **Sin Docker local:** Todo se construye en la nube
✅ **Rollback fácil:** Revierte a commits anteriores
✅ **Logs detallados:** Ve qué falla y por qué
✅ **Múltiples ambientes:** Puedes crear branches para staging
✅ **Seguro:** Secrets encriptados en GitHub

## 🐛 Troubleshooting

### Error: "Unauthorized" o "Permission denied"

**Solución:**
Verifica que el Service Account tenga todos los roles:
```bash
gcloud projects get-iam-policy acoustic-art-473804-v8 \
    --flatten="bindings[].members" \
    --filter="bindings.members:github-actions@*"
```

### Error: "Secret GCP_SA_KEY not found"

**Solución:**
1. Verifica que creaste el secret en GitHub
2. El nombre debe ser exactamente `GCP_SA_KEY`
3. El contenido debe ser el JSON completo

### Workflow no se ejecuta automáticamente

**Solución:**
1. Verifica que hiciste push a la rama `main`
2. Los archivos `.yml` deben estar en `.github/workflows/`
3. Revisa la pestaña Actions en GitHub

### Build falla con "No space left on device"

**Solución:**
Agrega limpieza en el workflow:
```yaml
- name: Clean up
  run: docker system prune -af
```

## 🔧 Configuración Avanzada

### Despliegue con PostgreSQL y GCS

Edita el workflow y cambia las variables de entorno:

```yaml
--set-env-vars DEBUG=False,USE_POSTGRES=true,USE_GCS=true,POSTGRES_HOST=/cloudsql/...,GS_BUCKET_NAME=...
```

### Múltiples Ambientes (Staging + Production)

Crea branches adicionales:

```yaml
on:
  push:
    branches:
      - main        # → Production
      - staging     # → Staging
```

Y nombra los servicios diferente:
```yaml
SERVICE_NAME: boutique-backend-${{ github.ref_name }}
```

### Usar Secrets para Variables Sensibles

En GitHub Settings → Secrets, agrega:
- `SECRET_KEY`
- `POSTGRES_PASSWORD`
- `GROQ_API_KEY`
- `STRIPE_SECRET_KEY`

Luego en el workflow:
```yaml
--set-secrets SECRET_KEY=django-secret:latest
```

## 📝 Comandos Útiles

### Ver logs del despliegue:
```bash
gcloud run services logs read boutique-backend --region us-central1 --limit 100
```

### Ver historial de revisiones:
```bash
gcloud run revisions list --service boutique-backend --region us-central1
```

### Rollback a versión anterior:
```bash
gcloud run services update-traffic boutique-backend \
    --region us-central1 \
    --to-revisions REVISION-NAME=100
```

### Eliminar Service Account (si necesitas recrearlo):
```bash
gcloud iam service-accounts delete github-actions@acoustic-art-473804-v8.iam.gserviceaccount.com
```

## 🎉 ¡Listo!

Ahora cada vez que hagas push a `main`, tu aplicación se desplegará automáticamente.

**Próximos pasos:**
1. Crear el Service Account y su clave JSON
2. Agregar `GCP_SA_KEY` a GitHub Secrets
3. Hacer push y ver la magia ✨

---

**Documentación adicional:**
- [GitHub Actions con Google Cloud](https://github.com/google-github-actions/auth)
- [Cloud Run Docs](https://cloud.google.com/run/docs)
- [Workload Identity](https://cloud.google.com/iam/docs/workload-identity-federation)
