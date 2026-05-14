#!/usr/bin/env bash
set -Eeuo pipefail

APP_ROOT="${APP_ROOT:-$(pwd)}"
PUBLIC_ROOT="${PUBLIC_ROOT:-/var/www/shipzilla/public}"
BACKEND_ENV="${BACKEND_ENV:-/etc/shipzilla/backend.env}"
BACKEND_PORT="${BACKEND_PORT:-5002}"
PM2_APP_NAME="${PM2_APP_NAME:-shipzilla-api}"
LANDING_DOMAIN="${LANDING_DOMAIN:-shipzilla.in}"
WWW_DOMAIN="${WWW_DOMAIN:-www.shipzilla.in}"
APP_DOMAIN="${APP_DOMAIN:-app.shipzilla.in}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.shipzilla.in}"
API_DOMAIN="${API_DOMAIN:-api.shipzilla.in}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@shipzilla.in}"

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export npm_config_audit=false
export npm_config_fund=false
export npm_config_progress=false

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$HOME/.nvm/nvm.sh"
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd node
require_cmd npm
require_cmd nginx
require_cmd pm2

if [ ! -f "$BACKEND_ENV" ]; then
  echo "Backend env file is missing: $BACKEND_ENV" >&2
  exit 1
fi

mkdir -p "$PUBLIC_ROOT/landing" "$PUBLIC_ROOT/app" "$PUBLIC_ROOT/admin"

echo "[deploy] Node: $(node --version)"
echo "[deploy] npm: $(npm --version)"

echo "[deploy] Building backend"
(
  cd "$APP_ROOT/apps/backend"
  npm ci
  npm run build
)

echo "[deploy] Building landing"
(
  cd "$APP_ROOT/apps/landing"
  npm ci
  VITE_API_BASE_URL="https://${API_DOMAIN}" \
    VITE_PLATFORM_URL="https://${APP_DOMAIN}/" \
    VITE_CLIENT_AUTH_URL="https://${APP_DOMAIN}/login" \
    VITE_TRACKING_URL="https://${APP_DOMAIN}/tracking" \
    npm run build
  rm -rf "$PUBLIC_ROOT/landing"
  mkdir -p "$PUBLIC_ROOT/landing"
  cp -a dist/. "$PUBLIC_ROOT/landing/"
)

echo "[deploy] Building client"
(
  cd "$APP_ROOT/apps/client"
  npm ci
  VITE_BASE_PATH=/ \
    VITE_API_URL=/api \
    VITE_APP_SOCKET_URL=/ \
    VITE_UI_ONLY_AUTH=false \
    npm run build
  rm -rf "$PUBLIC_ROOT/app"
  mkdir -p "$PUBLIC_ROOT/app"
  cp -a dist/. "$PUBLIC_ROOT/app/"
)

echo "[deploy] Building admin"
(
  cd "$APP_ROOT/apps/admin"
  npm ci --legacy-peer-deps
  REACT_APP_API_BASE_URL=/api \
    REACT_APP_SOCKET_URL=/ \
    npm run build:vps
  rm -rf "$PUBLIC_ROOT/admin"
  mkdir -p "$PUBLIC_ROOT/admin"
  cp -a build/. "$PUBLIC_ROOT/admin/"
)

echo "[deploy] Writing nginx config"
cat >/etc/nginx/sites-available/shipzilla <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${API_DOMAIN};

    client_max_body_size 50m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    client_max_body_size 50m;

    location = /api {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root ${PUBLIC_ROOT}/app;
        try_files \$uri \$uri/ /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${ADMIN_DOMAIN};

    client_max_body_size 50m;

    location = /api {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root ${PUBLIC_ROOT}/admin;
        try_files \$uri \$uri/ /index.html;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name ${LANDING_DOMAIN} ${WWW_DOMAIN} 72.60.96.97;

    client_max_body_size 50m;

    location = /api {
        proxy_pass http://127.0.0.1:${BACKEND_PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /app {
        return 301 https://${APP_DOMAIN}/;
    }

    location /app/ {
        return 301 https://${APP_DOMAIN}/;
    }

    location = /admin {
        return 301 https://${ADMIN_DOMAIN}/;
    }

    location /admin/ {
        return 301 https://${ADMIN_DOMAIN}/;
    }

    location / {
        root ${PUBLIC_ROOT}/landing;
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/shipzilla /etc/nginx/sites-enabled/shipzilla
nginx -t
systemctl reload nginx

if command -v certbot >/dev/null 2>&1 && [ "${SKIP_CERTBOT:-false}" != "true" ]; then
  certbot --nginx --non-interactive --agree-tos --redirect \
    --email "${CERTBOT_EMAIL}" \
    -d "${LANDING_DOMAIN}" \
    -d "${WWW_DOMAIN}" \
    -d "${APP_DOMAIN}" \
    -d "${ADMIN_DOMAIN}" \
    -d "${API_DOMAIN}" || echo "[deploy] Certbot failed; continuing with HTTP config"
  nginx -t
  systemctl reload nginx
fi

echo "[deploy] Restarting backend"
set -a
# shellcheck disable=SC1090
. "$BACKEND_ENV"
set +a

(
  cd "$APP_ROOT/apps/backend"
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
  else
    pm2 start dist/index.js --name "$PM2_APP_NAME" --time
  fi
)

pm2 save
echo "[deploy] Complete"
