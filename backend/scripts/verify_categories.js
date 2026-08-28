import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const electronics = await Deal.countDocuments({ category: 'electronics' });
  const fashion = await Deal.countDocuments({ category: 'fashion' });
  const home = await Deal.countDocuments({ category: 'home' });
  const beauty = await Deal.countDocuments({ category: 'beauty' });
  
  console.log(`Electronics Deals: ${electronics}`);
  console.log(`Fashion Deals: ${fashion}`);
  console.log(`Home Deals: ${home}`);
  console.log(`Beauty Deals: ${beauty}`);
  
  process.exit(0);
}
run();
