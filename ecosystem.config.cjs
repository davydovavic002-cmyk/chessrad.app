module.exports = {
  apps: [
    {
      name: 'chessrad-new',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // On server: nginx :3569 → Node 13569 (see deploy/nginx-chessrad-3569.conf)
        PORT: 13569,
      },
    },
  ],
};
