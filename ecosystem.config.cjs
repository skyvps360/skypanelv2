module.exports = {
  apps: [
    {
      name: 'skypanelv2-api',
      script: 'api/server.ts',
      cwd: __dirname,
      interpreter: 'node',
      interpreter_args: '--import tsx',
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: process.env.PORT || 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 1000,
      exp_backoff_restart_delay: 2000,
      min_uptime: 5000,
      max_restarts: 10
    },
    {
      name: 'skypanelv2-ui',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 5173 --strictPort',
      cwd: __dirname,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      restart_delay: 500,
      exp_backoff_restart_delay: 2000,
      min_uptime: 5000,
      max_restarts: 10
    }
  ]
};