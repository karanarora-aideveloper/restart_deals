import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { initScraperWorker } from '../services/scraperWorker.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function runBullMqTest() {
  console.log('==================================================');
  console.log('   TESTING BULLMQ DISTRIBUTED SCRAPING SERVICE   ');
  console.log('==================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  // Initialize Worker
  const worker = initScraperWorker();

  const testJobs = [
    { url: 'https://www.amazon.in/dp/B0H7S6LT9P', priority: PRIORITY.INTERACTIVE, label: '⚡ Urgent Interactive Re-check' },
    { url: 'https://www.amazon.in/dp/B08VW6MR7F', priority: PRIORITY.DAILY_REFRESH, label: '🕒 24h Background Refresher' },
  ];

  console.log(`[BullMQ Test] Pushing ${testJobs.length} jobs to Redis "scraper-queue"...\n`);

  const startTime = Date.now();
  const promises = testJobs.map(async (t) => {
    const jobStart = Date.now();
    console.log(` -> Dispatched to Redis [P${t.priority}]: ${t.label} (${t.url})`);
    const html = await scraperQueue.enqueue(t.url, { priority: t.priority });
    const duration = ((Date.now() - jobStart) / 1000).toFixed(2);
    console.log(` <- [COMPLETED in ${duration}s] [P${t.priority}] ${t.label}: HTML length = ${html?.length || 0}`);
    return { label: t.label, htmlLength: html?.length || 0, duration };
  });

  const results = await Promise.all(promises);
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n==================================================');
  console.log(`[BullMQ Test Success] All jobs processed in ${totalDuration}s via Redis distributed queue!`);
  console.log('Queue Status:', await scraperQueue.getStatus());
  console.log('==================================================\n');

  await worker.close();
  await mongoose.disconnect();
  process.exit(0);
}

runBullMqTest().catch((err) => {
  console.error('[BullMQ Test Error]:', err);
  process.exit(1);
});
