// PM2 process file. The API process also serves the built frontend (dist/)
// on the same port, so deploying exposes a single port (default 8787).
module.exports = {
  apps: [
    {
      name: "ly-travel-agent",
      script: "server-dist/server/index.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
      // .env in cwd is loaded by the app itself (loadLocalEnv); values here
      // only override when present.
      env: {
        NODE_ENV: "development"
      },
      // `npm run deploy:prod` / pm2 --env production: strict mode — startup
      // refuses weak secrets and sandbox payment/ticket providers.
      env_production: {
        NODE_ENV: "production"
      }
    }
  ]
};
