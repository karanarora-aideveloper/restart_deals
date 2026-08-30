import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { runCategoryBestsellerCrawl } from '../jobs/bestsellerCrawler.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Runs every currently-enabled seed (admin-controlled via Settings → Bestseller Crawler /
  // CrawlerSeed collection) — pass { seedIds: [...] } to test just a few specific seeds instead.
  const stats = await runCategoryBestsellerCrawl();
  console.log('Result Stats:', stats);

  await mongoose.disconnect();
  console.log('Disconnected.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
