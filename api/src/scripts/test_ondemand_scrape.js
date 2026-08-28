import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { scrapeProductUrl } from '../utils/productScraper.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function testOnDemand() {
  console.log('Connecting to DB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB.');

  console.log('Testing On-Demand Scraper...');
  const testUrl = 'https://www.amazon.in/dp/B0GPM1V9C5';
  console.log(`Scraping ${testUrl}...`);
  const result = await scrapeProductUrl(testUrl);
  console.log('Scraped Result:', result);

  await mongoose.disconnect();
  process.exit(0);
}

testOnDemand().catch(e => {
  console.error(e);
  process.exit(1);
});
