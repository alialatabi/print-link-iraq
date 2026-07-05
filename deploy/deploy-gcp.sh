#!/usr/bin/env bash
# Build and deploy the frontend to the GCP VPS (gcp.matbaty.com / 34.18.18.5).
# VM: matbaty-web (me-central1-a, project matbaty-32922), served by Caddy from /var/www/matbaty.
# Requires the deploy key at ~/.ssh/matbaty_gcp.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
tar -czf /tmp/matbaty-dist.tgz -C dist .
scp -i ~/.ssh/matbaty_gcp /tmp/matbaty-dist.tgz deploy@34.18.18.5:/tmp/
ssh -i ~/.ssh/matbaty_gcp deploy@34.18.18.5 \
  'sudo rm -rf /var/www/matbaty/* && sudo tar -xzf /tmp/matbaty-dist.tgz -C /var/www/matbaty && sudo chown -R caddy:caddy /var/www/matbaty && rm /tmp/matbaty-dist.tgz'
echo "Deployed. Verify: curl -s http://34.18.18.5/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'"
