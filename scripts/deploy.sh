#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ChessRad deploy from $ROOT"
echo "==> Node $(node -v)"
echo "==> Do NOT use 'git pull' on the server — this script syncs code via fetch + reset."

# npm install on the server dirties package-lock.json and breaks git pull.
git checkout -- . 2>/dev/null || true
git fetch origin main
git reset --hard origin/main

HEAD="$(git rev-parse --short HEAD)"
echo "==> Git at $HEAD — $(git log -1 --oneline)"

if ! grep -q '"vite": "\^6' client/package.json; then
  echo "ERROR: expected Vite 6 in client/package.json — git reset may have failed."
  exit 1
fi

FREE_MB="$(df -m "$ROOT" | awk 'NR==2 {print $4}')"
echo "==> Free disk: ${FREE_MB} MB"
if [[ "${FREE_MB}" -lt 400 ]]; then
  echo "WARNING: low disk space — build may fail."
fi

if ! swapon --show 2>/dev/null | grep -q .; then
  echo "WARNING: no swap — if build crashes with 'Bus error', add 2G swap (see docs/DEPLOY.md)."
fi

echo "==> Clean client install (avoids mixed Vite 8/6 node_modules)"
rm -rf client/node_modules client/dist

echo "==> Build may take 2–8 minutes on a small VPS — wait for 'built in'."
npm run build

test -f client/dist/index.html || { echo "ERROR: client/dist/index.html missing"; exit 1; }
echo "==> Built assets:"
ls -la client/dist/index.html
ls -la client/dist/assets/ 2>/dev/null | head -6

PM2_APP="${PM2_APP:-chessrad-new}"

if command -v pm2 >/dev/null 2>&1; then
  # Remove legacy duplicate if deploy.sh previously started "chessrad" on the same PORT.
  if pm2 describe chessrad >/dev/null 2>&1 && [[ "$PM2_APP" != "chessrad" ]]; then
    echo "==> Stopping legacy PM2 app 'chessrad' (same port as $PM2_APP)"
    pm2 delete chessrad || true
  fi
  pm2 restart "$PM2_APP" || pm2 start ecosystem.config.cjs --only "$PM2_APP"
  pm2 save
  pm2 status "$PM2_APP"
else
  echo "pm2 not found — restart node manually"
fi

echo ""
echo "Done ($HEAD). Open https://chessrad.app:3569"
echo "Hard refresh: Ctrl+Shift+R. Clear PWA cache if UI is still old."
