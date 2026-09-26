import { connectDB } from './db/connection.js';
import { startServer } from './api/server.js';
import { startTelegramListener, stopTelegramListener } from './listener/telegram.js';
import { startTokenResetScheduler } from './listener/tokenReset.js';
import { installSystemLogger } from './utils/systemLogger.js';
import { startWatchdog } from './utils/watchdog.js';

// Mirror all console output to Redis so the admin panel can display live logs
installSystemLogger();

// Force-restart this process if it goes silent for too long — see watchdog.js's docblock for
// the exact multi-hour-silent-hang incident this guards against (Express's own health check
// doesn't cover whether the Telegram listener sub-system is actually still doing anything).
startWatchdog();

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

  // 4. Start Telegram Scraping Listener with resilient background retries
  const initTelegram = async () => {
    try {
      await startTelegramListener();
    } catch (listenerErr) {
      console.error('[Critical Error] Telegram listener failed to start:', listenerErr.message);
      console.log('[Telegram] Scheduling listener restart attempt in 15 seconds...');
      setTimeout(initTelegram, 15000);
    }
  };
  initTelegram();
}

// Graceful shutdown on SIGTERM/SIGINT (releases MTProto Telegram auth key cleanly)
const shutdown = async (signal) => {
  console.log(`[Process] Received ${signal}. Shutting down gracefully...`);
  try {
    await stopTelegramListener();
  } catch (e) {}
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection] at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception] occurred:', err);
});

// Run entry point
main();
