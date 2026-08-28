import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';
import Master from '../src/db/models/master.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const deals = await Deal.countDocuments();
  const products = await Product.countDocuments();
  const cats = await Master.find({ type: 'category', isActive: true });
  console.log(`Deals: ${deals}, Products: ${products}`);
  console.log('Categories:', cats.map(c => c.value));
  process.exit(0);
}
run();
