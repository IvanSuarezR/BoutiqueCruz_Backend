#!/bin/sh

# entrypoint.sh
# Genera un archivo env.js en la raíz del sitio con las variables de entorno
# que queramos exponer al cliente en runtime. Esto permite cambiar URLs y
# claves sin reconstruir el bundle de Vite.

set -e

WWW_DIR="/usr/share/nginx/html"
ENV_FILE="$WWW_DIR/env.js"

echo "🚀 Generando $ENV_FILE desde variables de entorno..."
echo "   - VITE_API_URL: ${VITE_API_URL:-'(vacío)'}"
echo "   - VITE_GOOGLE_MAPS_API_KEY: ${VITE_GOOGLE_MAPS_API_KEY}..."
echo "   - VITE_STRIPE_PUBLISHABLE_KEY: ${VITE_STRIPE_PUBLISHABLE_KEY}..."

cat > "$ENV_FILE" <<EOF
window._env_ = {
    VITE_API_URL: "${VITE_API_URL:-}",
    VITE_BANNER_IMAGE_URL: "${VITE_BANNER_IMAGE_URL:-}",
    VITE_STRIPE_PUBLISHABLE_KEY: "${VITE_STRIPE_PUBLISHABLE_KEY:-}",
    VITE_GOOGLE_MAPS_API_KEY: "${VITE_GOOGLE_MAPS_API_KEY:-}",
    _GENERATED_AT: "$(date)"
};
EOF

echo "✅ $ENV_FILE creado"
echo "🌐 Iniciando Nginx..."

exec nginx -g 'daemon off;'
