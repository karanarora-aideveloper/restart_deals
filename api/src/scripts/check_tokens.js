import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

async function checkTokens() {
  await mongoose.connect(process.env.MONGODB_URI);
  const total = await ScrapingAntToken.countDocuments();
  const active = await ScrapingAntToken.find({ status: 'active' });
  const exhausted = await ScrapingAntToken.countDocuments({ status: 'exhausted' });

  console.log(`Total Tokens: ${total}`);
  console.log(`Active Tokens: ${active.length}`);
  console.log(`Exhausted Tokens: ${exhausted}`);
  active.forEach(t => console.log(` - Token: ${t.token.substring(0, 10)}... (used: ${t.usageCount})`));

  await mongoose.disconnect();
}

checkTokens();
