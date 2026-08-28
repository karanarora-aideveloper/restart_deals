import { connectDB } from './db/connection.js';
import { startServer } from './api/server.js';
import { startTelegramListener } from './listener/telegram.js';
import { startTokenResetScheduler } from './listener/tokenReset.js';
import { installSystemLogger } from './utils/systemLogger.js';

// Mirror all console output to Redis so the admin panel can display live logs
installSystemLogger();

async function main() {
  console.log('==================================================');
  console.log('            SHOPPERS DEALS STARTING UP            ');
  console.log('==================================================');

  // 1. Establish Database Connection
  await connectDB();

  // 2. Start daily scheduler to check for token credit resets
  startTokenResetScheduler();

  // 3. Launch API HTTP Server
  await startServer();

  // 4. Start Telegram Scraping Listener
  try {
    await startTelegramListener();
  } catch (listenerErr) {
    console.error('[Critical Error] Telegram listener failed to start:', listenerErr.message);
    // Do not crash the API server, keep running to allow API endpoints to function
  }
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] occurred:', err);
});

// Run entry point
main();
