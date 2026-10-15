module.exports = {
  apps: [
    {
      name: 'shoppersdeals-api',
      cwd: './api',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
    {
      name: 'shoppersdeals-backend',
      cwd: './backend',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
    },
    {
      name: 'shoppersdeals-scraper',
      cwd: './api',
      script: 'src/worker.js',
      instances: 10,
      autorestart: true,
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'shoppersdeals-web',
      cwd: './frontend/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
