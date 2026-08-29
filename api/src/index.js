import { installSystemLogger } from './utils/systemLogger.js';
import { connectDB } from './db/connection.js';
import { startServer } from './server.js';
import { startAlgoliaSync } from './algolia/sync.js';

installSystemLogger();

async function main() {
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

