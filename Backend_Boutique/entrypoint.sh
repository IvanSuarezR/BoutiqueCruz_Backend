#!/bin/bash

# Script de inicio para Django en Cloud Run

set -e

echo "🚀 Iniciando aplicación Django..."

# Esperar a que la base de datos esté lista (si usas Cloud SQL)
if [ "$USE_POSTGRES" = "true" ]; then
    echo "⏳ Esperando PostgreSQL..."
    until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
        echo "PostgreSQL no está listo - esperando..."
        sleep 2
    done
    echo "✅ PostgreSQL está listo!"
fi

# Ejecutar migraciones
echo "📦 Ejecutando migraciones..."
python manage.py migrate --noinput

# Crear superusuario si no existe (opcional, para producción)
# python manage.py shell << END
# from django.contrib.auth import get_user_model
# User = get_user_model()
# if not User.objects.filter(username='admin').exists():
#     User.objects.create_superuser('admin', 'admin@example.com', 'changeme')
# END

# Iniciar Gunicorn
echo "🌐 Iniciando servidor Gunicorn..."
exec gunicorn boutique_Main.wsgi:application \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers ${WORKERS:-2} \
    --threads ${THREADS:-4} \
    --timeout ${TIMEOUT:-120} \
    --access-logfile - \
    --error-logfile - \
    --log-level info
