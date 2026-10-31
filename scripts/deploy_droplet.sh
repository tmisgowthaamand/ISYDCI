#!/usr/bin/env bash
# Runs ON the DigitalOcean droplet (called by .github/workflows/deploy.yml, or by hand):
#   bash scripts/deploy_droplet.sh
# Expects: git checkout of this repo, Node 20+, pm2, nginx proxying /api -> :5000 and serving dist/.
# Production env lives in backend/.env on the droplet (never committed) and must contain MONGO_URL
# pointing at the DigitalOcean Managed MongoDB cluster (/isydci_crm) plus the WHATSAPP_* keys.
set -euo pipefail

cd "$(dirname "$0")/.."
echo "── ISYDCI deploy @ $(date) in $(pwd)"

git fetch --all --prune
git reset --hard origin/main

echo "── install"
npm ci --omit=dev --no-audit --no-fund
npm --prefix backend ci --omit=dev --no-audit --no-fund

echo "── build frontend"
npm run build

echo "── restart backend (pm2)"
if pm2 describe isydci-backend >/dev/null 2>&1; then
  pm2 restart isydci-backend --update-env
else
  pm2 start backend/server.js --name isydci-backend --cwd "$(pwd)/backend"
fi
pm2 save

echo "── health"
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:5000/api/health | grep -q '"database":"mongodb"'; then
    echo "backend healthy on MongoDB"
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:5000/api/health || { echo "backend not healthy"; pm2 logs isydci-backend --lines 50 --nostream; exit 1; }

echo "── done"
