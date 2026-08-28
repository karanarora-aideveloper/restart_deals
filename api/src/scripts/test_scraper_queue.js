import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { scraperQueue, PRIORITY } from '../services/scraperQueue.js';
import { scrapeProductUrl } from '../utils/productScraper.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function runQueueStressTest() {
  console.log('==================================================');
  console.log('   TESTING UNIFIED SCRAPING QUEUE & CONCURRENCY   ');
  console.log('==================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  const testUrls = [
    // Low priority (Category crawler)
    { url: 'https://www.amazon.in/dp/B081QTNF7V', priority: PRIORITY.BESTSELLER, label: 'Bestseller Task 1' },
    { url: 'https://www.amazon.in/dp/B07XVMHS1H', priority: PRIORITY.BESTSELLER, label: 'Bestseller Task 2' },

    // Normal priority (24h Refresher)
    { url: 'https://www.amazon.in/dp/B08VW6MR7F', priority: PRIORITY.DAILY_REFRESH, label: 'Daily Refresh Task 1' },
    { url: 'https://www.amazon.in/dp/B0BV23KFGY', priority: PRIORITY.DAILY_REFRESH, label: 'Daily Refresh Task 2' },

    // High priority (User clicked "⚡ Re-check Live Price")
    { url: 'https://www.amazon.in/dp/B0H7S6LT9P', priority: PRIORITY.INTERACTIVE, label: '⚡ USER INTERACTIVE (P1)' }
  ];

  console.log(`[Queue Test] Enqueuing ${testUrls.length} requests concurrently...\n`);

  const startTime = Date.now();
  const promises = testUrls.map(async (t) => {
    const taskStart = Date.now();
    console.log(` -> Enqueued [P${t.priority}]: ${t.label}`);
    const result = await scrapeProductUrl(t.url, t.priority);
    const duration = ((Date.now() - taskStart) / 1000).toFixed(2);
    console.log(` <- [COMPLETED in ${duration}s] [P${t.priority}] ${t.label}: "${result?.title?.slice(0, 35)}..." (₹${result?.price})`);
    return { label: t.label, result, duration };
  });

  const results = await Promise.all(promises);
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n==================================================');
  console.log(`[Queue Test Results] All ${results.length} tasks completed in ${totalDuration}s without 409 errors!`);
  console.log('Queue Status:', JSON.stringify(scraperQueue.getStatus(), null, 2));
  console.log('==================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runQueueStressTest().catch(e => {
  console.error('[Queue Test Error]:', e);
  process.exit(1);
});
