# ChessRad — Production Deploy

## Build

```bash
# From repo root (works even when NODE_ENV=production on the server)
npm run build

# Manual equivalent:
cd client
NODE_ENV=development NPM_CONFIG_PRODUCTION=false npm ci --no-audit --no-fund
npm run build
cd ..
npm ci
```

The build script forces `NODE_ENV=development` only for the client install step so Vite and other dev tools are installed on production servers.

**Requirements:** Node **18+**. Vite 6 is used (not Vite 8) so builds work on small VPS without Bus error / OOM.

**If `Bus error (core dumped)` during vite build:** add swap, then rebuild:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
bash scripts/deploy.sh
```

**If build fails on the server:**

```bash
node -v          # must be v20.19+
df -h            # need free disk (npm needs ~500MB+)
cd ~/chessrad.app/client && npm install && npm run build
```

Upgrade Node 20 on Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

Server serves `client/dist` when the folder exists.

## Environment (`.env`)

```env
NODE_ENV=production
PORT=13569
JWT_SECRET=<strong-random-secret>
PUBLIC_ORIGIN=https://chessrad.app:3569
AUTH_BYPASS=false
```

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=ChessRad <noreply@your-domain.com>
```

Email is used for lesson/tournament reminders (1 hour before), journal shares, and weekly parent reports.

## PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs --only chessrad-new
pm2 save
pm2 startup
```

## Nginx (example)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3569;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## After deploy

1. Open **https://chessrad.app:3569** — port **443** is still the **old** HTML site.
2. Hard refresh (Ctrl+Shift+R). PWA may cache the old UI: DevTools → Application → Service Workers → Unregister.
3. Verify the new bundle loaded: View Source should reference recent `/assets/index-*.js` (not old hashes).

### One-command deploy on the server

**Do not run `git pull`** — it fails when `package-lock.json` was touched by `npm install`. Use only:

```bash
cd ~/chessrad.app
bash scripts/deploy.sh
```

The script runs `git fetch` + `git reset --hard`, wipes `client/node_modules`, builds, and restarts PM2 app **`chessrad-new`** (override with `PM2_APP=...` if needed).

**If you see `EADDRINUSE 127.0.0.1:13569`:** two PM2 apps fight for the same port (often old `chessrad` + `chessrad-new`). Fix once:

```bash
pm2 list
pm2 delete chessrad          # legacy name from old deploy.sh
pm2 restart chessrad-new
pm2 save
```

## After deploy (smoke)
