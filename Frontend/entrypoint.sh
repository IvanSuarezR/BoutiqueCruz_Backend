#!/bin/sh

# Script para inyectar variables de entorno en el build de React
# Útil si necesitas cambiar la URL del backend en runtime

set -e

echo "🚀 Configurando variables de entorno..."

# Reemplazar placeholders en archivos JS si existen
# Por ejemplo: VITE_API_URL será reemplazado por el valor real
if [ ! -z "$VITE_API_URL" ]; then
    echo "📝 Configurando API_URL: $VITE_API_URL"
    find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|__VITE_API_URL__|$VITE_API_URL|g" {} \;
fi

echo "✅ Configuración completada"
echo "🌐 Iniciando Nginx..."

# Iniciar Nginx
exec nginx -g 'daemon off;'
