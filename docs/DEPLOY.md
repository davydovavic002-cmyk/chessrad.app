# ChessRad — Production Deploy

## Build

```bash
cd client && npm ci && npm run build
cd .. && npm ci
```

Server serves `client/dist` when the folder exists.

## Environment (`.env`)

```env
NODE_ENV=production
PORT=3569
JWT_SECRET=<strong-random-secret>
PUBLIC_ORIGIN=https://your-domain.com

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
pm2 start ecosystem.config.cjs
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

1. Hard refresh browser (Ctrl+Shift+R)
2. Run smoke checks from [QA-CHECKLIST.md](./QA-CHECKLIST.md)
