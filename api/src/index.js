import { installSystemLogger } from './utils/systemLogger.js';
import { connectDB } from './db/connection.js';
import { startServer } from './server.js';
import { startAlgoliaSync } from './algolia/sync.js';

installSystemLogger();

async function main() {
  // If this instance is deployed as a dedicated scraper worker (e.g. shoppersdeals-scraper,
  // railway-scraper-*, or RENDER_SERVICE_NAME/RAILWAY_SERVICE_NAME contains 'scraper',
  // or explicitly configured via RAILWAY_START_COMMAND / SERVICE_TYPE), delegate to scraperWorker.
  const isScraperService =
    process.env.RAILWAY_SERVICE_NAME?.includes('scraper') ||
    process.env.RENDER_SERVICE_NAME?.includes('scraper') ||
    process.env.RAILWAY_START_COMMAND?.includes('scraperWorker') ||
    process.env.SERVICE_TYPE === 'scraper';

  if (isScraperService) {
    console.log(`[API Service] Service "${process.env.RAILWAY_SERVICE_NAME || process.env.RENDER_SERVICE_NAME || 'scraper'}" is identified as Scraper Worker fleet. Starting worker...`);
    const { runStandaloneWorker } = await import('./services/scraperWorker.js');
    runStandaloneWorker();
    return;
  }

  console.log('==================================================');
  console.log('            SHOPPERSDEALS API SERVICE             ');
  console.log('==================================================');

  await connectDB();
  await startServer();
  startAlgoliaSync();
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[API Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[API Uncaught Exception] occurred:', err);
});

main();

