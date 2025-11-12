# ==========================================
# Dockerfile para Frontend React + Vite
# Cloud Run Compatible
# ==========================================

# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de producción
RUN npm run build

# Etapa 2: Servidor con Nginx
FROM nginx:alpine

# Copiar archivos build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración de nginx personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 8080 (requerido por Cloud Run)
EXPOSE 8080

# Script para reemplazar variables de entorno en runtime
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Comando de inicio
CMD ["/entrypoint.sh"]
