#!/usr/bin/env bash
set -Eeuo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

apt-get update
apt-get install -y ca-certificates curl git gnupg nginx build-essential postgresql-client openssl

if ! command -v docker >/dev/null 2>&1; then
  apt-get install -y docker.io
fi

if ! command -v node >/dev/null 2>&1 || [ "${FORCE_NODE_INSTALL:-false}" = "true" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

systemctl enable --now nginx
systemctl enable --now docker

mkdir -p /etc/shipzilla /var/www/shipzilla/source /var/www/shipzilla/public

echo "[provision] Installed base packages, Node, PM2, Nginx, Docker, and PostgreSQL client."
