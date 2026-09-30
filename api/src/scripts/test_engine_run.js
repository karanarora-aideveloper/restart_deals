import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import CrawlerSeed from '../db/models/crawlerSeed.js';
import { runCategoryBestsellerCrawl } from '../jobs/bestsellerCrawler.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/deals_db';

async function testEngineRun() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');

  // Find a Nykaa or Flipkart seed
  const testSeed = await CrawlerSeed.findOne({ store: 'nykaa', isEnabled: true });
  if (!testSeed) {
    console.log('No Nykaa seed found!');
    await mongoose.disconnect();
    return;
  }

  console.log(`\nTriggering Shoppers Deals Engine test run for: [${testSeed.store.toUpperCase()}] ${testSeed.category}/${testSeed.subcategory} ("${testSeed.keywords}")`);
  console.log(`Search URL: ${testSeed.url}`);

  const stats = await runCategoryBestsellerCrawl({ seedIds: [testSeed._id] });
  console.log('\n--- Test Run Results ---');
  console.log(stats);

  const updatedSeed = await CrawlerSeed.findById(testSeed._id);
  console.log('Updated Seed Result:', updatedSeed?.lastResult);

  await mongoose.disconnect();
}

testEngineRun().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
