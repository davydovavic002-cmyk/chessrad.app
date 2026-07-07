#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ChessRad deploy from $ROOT"
echo "==> Node $(node -v)"

git fetch origin main
git reset --hard origin/main
echo "==> Git at $(git rev-parse --short HEAD) — $(git log -1 --oneline)"

npm run build

test -f client/dist/index.html || { echo "ERROR: client/dist/index.html missing"; exit 1; }
echo "==> Built assets:"
ls -la client/dist/index.html
ls client/dist/assets/ 2>/dev/null | head -5

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart chessrad || pm2 start ecosystem.config.cjs
  pm2 status chessrad
else
  echo "pm2 not found — restart node manually"
fi

echo ""
echo "Done. Open https://chessrad.app:3569 (not :443 — that is the old site)."
echo "Hard refresh: Ctrl+Shift+R. If still old UI: DevTools → Application → Service Workers → Unregister."
