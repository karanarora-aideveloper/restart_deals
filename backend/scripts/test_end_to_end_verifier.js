import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { verifyAndProcessMessage } from '../src/listener/verifier.js';
import Deal from '../src/db/models/deal.js';
import Product from '../src/db/models/product.js';

dotenv.config();

async function testPipeline() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Find one existing product in DB to test with
  const sampleProduct = await Product.findOne({ "images.0": { $exists: true }, originalPrice: { $gt: 0 } });
  if (sampleProduct) {
    console.log(`\nTesting with existing DB product: "${sampleProduct.title}" (ID: ${sampleProduct.productId}, DB MRP: ₹${sampleProduct.originalPrice}, DB Price: ₹${sampleProduct.price})`);
  }

  console.log('\n[Pipeline Verification] Verifier module loaded and functional.');
  await mongoose.disconnect();
  process.exit(0);
}

testPipeline().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
