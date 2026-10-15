import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { installSystemLogger } from './utils/systemLogger.js';
import { initScraperWorker } from './services/scraperWorker.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const workerIndex = String(parseInt(process.env.NODE_APP_INSTANCE || '0', 10) + 1);
const workerTag = `scraper-${workerIndex}`;
installSystemLogger(workerTag);

console.log(`[Scraper Worker #${workerIndex}] Process started (PID: ${process.pid}). Connecting to Mongo & Redis...`);

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error(`[Scraper Worker #${workerIndex}] MONGODB_URI missing in environment.`);
  process.exit(1);
}

mongoose.connect(mongoUri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}).then(async () => {
  console.log(`[Scraper Worker #${workerIndex}] Connected to MongoDB Atlas.`);
  initScraperWorker(workerIndex);
  console.log(`[Scraper Worker #${workerIndex}] Ready and listening for distributed jobs on "scraper-queue".`);

  const { defaultRedis } = await import('./utils/redis.js');
  const registerHeartbeat = async () => {
    try {
      if (defaultRedis) {
        await defaultRedis.set(
          `worker:heartbeat:${workerTag}`,
          JSON.stringify({
            name: workerTag,
            workerIndex,
            platform: 'local-pm2',
            pid: process.pid,
            lastSeen: Date.now(),
          }),
          'EX',
          180
        );
      }
    } catch (e) {}
  };
  registerHeartbeat();
  setInterval(registerHeartbeat, 30000);
}).catch(err => {
  console.error(`[Scraper Worker #${workerIndex}] DB connection error:`, err.message);
  process.exit(1);
});
