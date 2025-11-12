# ==========================================
# Dockerfile para Backend Django
# Cloud Run Compatible
# ==========================================

FROM python:3.11-slim

# Variables de entorno para Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements y instalar dependencias Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install -r requirements.txt && \
    pip install gunicorn

# Copiar el código de la aplicación
COPY . .

# Crear directorios necesarios
RUN mkdir -p /app/staticfiles /app/media

# Recolectar archivos estáticos
RUN python manage.py collectstatic --noinput || true

# Exponer puerto 8080 (requerido por Cloud Run)
EXPOSE 8080

# Script de inicio
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Ejecutar con gunicorn
CMD ["/entrypoint.sh"]
