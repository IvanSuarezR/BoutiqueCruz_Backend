#!/bin/sh
set -e

echo "🚀 Iniciando entrypoint del Backend..."

# Ejecutar migraciones
echo "📦 Aplicando migraciones de base de datos..."
python manage.py migrate --noinput
python manage.py seed_rbac

# Recolectar archivos estáticos (si usas WhiteNoise o similar, o para subir a GCS)
# echo "🎨 Recolectando archivos estáticos..."
# python manage.py collectstatic --noinput

# Crear superusuario si se proporcionan las variables (Opcional)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "👤 Creando/Actualizando superusuario..."
    python manage.py createsuperuser --noinput || true
fi

echo "✅ Preparación completada. Iniciando servidor..."

# Ejecutar el comando pasado al contenedor (por defecto gunicorn)
exec "$@"
