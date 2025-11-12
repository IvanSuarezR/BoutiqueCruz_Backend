#!/bin/bash

# ==========================================
# Script de Despliegue Rápido - Cloud Run
# ==========================================

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando despliegue en Google Cloud Run${NC}"
echo ""

# Verificar que gcloud está instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI no está instalado${NC}"
    echo "Instalar desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar que el usuario está autenticado
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}⚠️  No estás autenticado en gcloud${NC}"
    echo "Ejecutando: gcloud auth login"
    gcloud auth login
fi

# Solicitar información del proyecto
echo -e "${YELLOW}📋 Configuración del proyecto${NC}"
read -p "Project ID de Google Cloud: " PROJECT_ID
read -p "Región (default: us-central1): " REGION
REGION=${REGION:-us-central1}

# Configurar proyecto
echo -e "${GREEN}⚙️  Configurando proyecto...${NC}"
gcloud config set project $PROJECT_ID

# Menú de opciones
echo ""
echo -e "${YELLOW}¿Qué deseas desplegar?${NC}"
echo "1) Backend (Django)"
echo "2) Frontend (React)"
echo "3) Ambos (Backend + Frontend)"
echo "4) Configuración inicial (habilitar APIs, crear recursos)"
read -p "Selecciona una opción (1-4): " OPTION

case $OPTION in
    1)
        echo -e "${GREEN}🐍 Desplegando Backend...${NC}"
        cd Backend_Boutique
        
        read -p "Nombre del servicio (default: boutique-backend): " SERVICE_NAME
        SERVICE_NAME=${SERVICE_NAME:-boutique-backend}
        
        gcloud run deploy $SERVICE_NAME \
            --source . \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --port 8080 \
            --memory 1Gi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 10 \
            --timeout 300
        
        BACKEND_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
        echo ""
        echo -e "${GREEN}✅ Backend desplegado exitosamente!${NC}"
        echo -e "${GREEN}🌐 URL: ${BACKEND_URL}${NC}"
        ;;
        
    2)
        echo -e "${GREEN}⚛️  Desplegando Frontend...${NC}"
        cd Frontend
        
        read -p "Nombre del servicio (default: boutique-frontend): " SERVICE_NAME
        SERVICE_NAME=${SERVICE_NAME:-boutique-frontend}
        
        read -p "URL del backend (para VITE_API_URL): " BACKEND_URL
        
        gcloud run deploy $SERVICE_NAME \
            --source . \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --port 8080 \
            --memory 512Mi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 5 \
            --set-env-vars "VITE_API_URL=${BACKEND_URL}"
        
        FRONTEND_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")
        echo ""
        echo -e "${GREEN}✅ Frontend desplegado exitosamente!${NC}"
        echo -e "${GREEN}🌐 URL: ${FRONTEND_URL}${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANTE: Agrega esta URL a CORS_ALLOWED_ORIGINS en el backend${NC}"
        ;;
        
    3)
        echo -e "${GREEN}🚀 Desplegando Backend y Frontend...${NC}"
        
        # Desplegar Backend primero
        echo -e "${GREEN}🐍 Paso 1/2: Desplegando Backend...${NC}"
        cd Backend_Boutique
        
        gcloud run deploy boutique-backend \
            --source . \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --port 8080 \
            --memory 1Gi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 10 \
            --timeout 300
        
        BACKEND_URL=$(gcloud run services describe boutique-backend --region=$REGION --format="value(status.url)")
        echo -e "${GREEN}✅ Backend desplegado: ${BACKEND_URL}${NC}"
        
        # Desplegar Frontend
        echo ""
        echo -e "${GREEN}⚛️  Paso 2/2: Desplegando Frontend...${NC}"
        cd ../Frontend
        
        gcloud run deploy boutique-frontend \
            --source . \
            --platform managed \
            --region $REGION \
            --allow-unauthenticated \
            --port 8080 \
            --memory 512Mi \
            --cpu 1 \
            --min-instances 0 \
            --max-instances 5 \
            --set-env-vars "VITE_API_URL=${BACKEND_URL}"
        
        FRONTEND_URL=$(gcloud run services describe boutique-frontend --region=$REGION --format="value(status.url)")
        
        echo ""
        echo -e "${GREEN}✅✅ Ambos servicios desplegados exitosamente!${NC}"
        echo ""
        echo -e "${GREEN}📝 URLs de tus servicios:${NC}"
        echo -e "Backend:  ${BACKEND_URL}"
        echo -e "Frontend: ${FRONTEND_URL}"
        echo ""
        echo -e "${YELLOW}⚠️  SIGUIENTE PASO IMPORTANTE:${NC}"
        echo "Actualiza el backend con la URL del frontend para CORS:"
        echo ""
        echo -e "${YELLOW}gcloud run services update boutique-backend --region=$REGION --update-env-vars \"CORS_ALLOWED_ORIGINS=${FRONTEND_URL}\"${NC}"
        ;;
        
    4)
        echo -e "${GREEN}🔧 Configuración inicial...${NC}"
        
        # Habilitar APIs
        echo "Habilitando APIs necesarias..."
        gcloud services enable \
            run.googleapis.com \
            cloudbuild.googleapis.com \
            sqladmin.googleapis.com \
            storage.googleapis.com \
            secretmanager.googleapis.com
        
        echo ""
        echo -e "${GREEN}✅ APIs habilitadas${NC}"
        echo ""
        echo -e "${YELLOW}Siguiente paso: Crear Cloud SQL y Cloud Storage manualmente${NC}"
        echo "Ver guía completa en: CLOUD_RUN_DEPLOYMENT.md"
        ;;
        
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}🎉 ¡Proceso completado!${NC}"
