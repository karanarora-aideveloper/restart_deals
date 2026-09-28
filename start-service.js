import { spawn } from 'child_process';

const serviceName = process.env.RAILWAY_SERVICE_NAME || process.env.SERVICE_NAME || '';
console.log(`[Railway Service Launcher] 🚀 Booting service for RAILWAY_SERVICE_NAME="${serviceName}"...`);

let args = [];

if (serviceName.includes('backend')) {
  console.log('[Railway Service Launcher] Routing to backend daemon service (backend/src/index.js)...');
  args = ['--prefix', 'backend', 'start'];
} else if (serviceName.includes('scraper')) {
  console.log('[Railway Service Launcher] Routing to scraper worker service (api/src/services/scraperWorker.js)...');
  args = ['--prefix', 'api', 'run', 'worker:scraper'];
} else {
  // Default to API service
  console.log('[Railway Service Launcher] Routing to REST API service (api/src/server.js)...');
  args = ['--prefix', 'api', 'start'];
}

const child = spawn('npm', args, { stdio: 'inherit', env: process.env });

child.on('exit', (code, signal) => {
  console.log(`[Railway Service Launcher] Service process exited with code ${code}, signal ${signal}`);
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error('[Railway Service Launcher Error] Failed to spawn process:', err.message);
  process.exit(1);
});
