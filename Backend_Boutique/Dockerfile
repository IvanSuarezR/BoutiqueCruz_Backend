# Usar una imagen base oficial de Python
FROM python:3.11-slim

# Establecer variables de entorno
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Establecer el directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
# libpq-dev es para psycopg2 (PostgreSQL)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar el archivo de requerimientos e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copiar el resto del código de la aplicación
COPY . .

# Copiar y dar permisos al entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponer el puerto 8080 (Cloud Run default)
EXPOSE 8080

# Usar entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Comando por defecto (puede ser sobreescrito por el entrypoint o Cloud Run)
# Aumentamos el timeout a 120s para evitar 502 en subidas lentas a GCS
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--timeout", "120", "boutique_Main.wsgi:application"]
