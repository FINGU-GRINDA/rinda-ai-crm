#!/bin/sh
set -e

# Substitute environment variables in nginx config template
envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Verify the config was generated correctly
if ! grep -q "proxy_pass" /etc/nginx/conf.d/default.conf; then
    echo "ERROR: nginx config not generated correctly"
    cat /etc/nginx/conf.d/default.conf
    exit 1
fi

echo "✓ Nginx config generated with BACKEND_URL: ${BACKEND_URL}"

# Start nginx
exec "$@"
