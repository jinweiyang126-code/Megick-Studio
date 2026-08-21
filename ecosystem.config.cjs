/**
 * PM2 process layout for Megick.
 *
 * Defaults tuned for a small single box (e.g. Aliyun ECS 2C4G):
 *   megick-api ×1 + megick-worker ×1
 * Override when needed:
 *   MEGICK_API_INSTANCES=2 MEGICK_WORKER_INSTANCES=2 pm2 startOrReload ecosystem.config.cjs --update-env
 */
module.exports = {
  apps: [
    {
      name: "megick-api",
      cwd: "./apps/api",
      script: "dist/main.js",
      exec_mode: "cluster",
      // 2C4G: keep 1; larger hosts can raise via MEGICK_API_INSTANCES
      instances: Number(process.env.MEGICK_API_INSTANCES || 1),
      autorestart: true,
      watch: false,
      // Cap below host RAM so one leak does not OOM the whole 4G box
      max_memory_restart: process.env.MEGICK_API_MAX_MEMORY || "768M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
        PORT: 3333,
        WEB_DIST_DIR: "../web/dist",
        MEGICK_RUN_WORKERS: "false",
      },
    },
    {
      name: "megick-worker",
      cwd: "./apps/api",
      script: "dist/worker.js",
      exec_mode: "fork",
      // 2C4G: keep 1–2; do not use the old default of 5 on small VMs
      instances: Number(process.env.MEGICK_WORKER_INSTANCES || 1),
      autorestart: true,
      watch: false,
      max_memory_restart: process.env.MEGICK_WORKER_MAX_MEMORY || "768M",
      kill_timeout: 30000,
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
        SERVE_WEB: "false",
        MEGICK_RUN_WORKERS: "true",
      },
    },
  ],
};
