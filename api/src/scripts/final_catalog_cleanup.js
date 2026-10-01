import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function finalCleanup() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  // 1. Fix output_channels
  await mongoose.connection.collection('output_channels').updateMany(
    { category: 'general' },
    { $set: { category: 'all' } }
  );
  console.log('✅ Updated output_channels category: "general" -> "all"');

  // 2. Fix remaining products in "general"
  const generalProducts = await Product.find({ category: 'general' });
  console.log(`Found ${generalProducts.length} products in "general".`);
  for (const p of generalProducts) {
    const title = (p.title || '').toLowerCase();
    let cat = 'home';
    let sub = 'decor';
    if (/water purifier|ro \+|aqua/i.test(title)) {
      cat = 'appliances';
      sub = 'water-purifiers';
    } else if (/wok|pot cover|cookware/i.test(title)) {
      cat = 'home';
      sub = 'kitchen-dining';
    } else if (/heat press|machine/i.test(title)) {
      cat = 'home';
      sub = 'tools';
    } else if (/plant clip|garden/i.test(title)) {
      cat = 'home';
      sub = 'decor';
    } else if (/savings|voucher|grocer/i.test(title)) {
      cat = 'grocery';
      sub = 'cooking-staples';
    }
    p.category = cat;
    p.subcategory = sub;
    await p.save();
    console.log(`   -> Fixed PID ${p.productId}: ${cat}:${sub}`);
  }

  // 3. Fix Samsung Galaxy F70e & Watches misclassified in home
  await Product.updateMany(
    { title: { $regex: /samsung galaxy f70e/i } },
    { $set: { category: 'electronics', subcategory: 'mobiles' } }
  );
  await Product.updateMany(
    { title: { $regex: /samsung galaxy watch/i } },
    { $set: { category: 'electronics', subcategory: 'wearables' } }
  );
  await Product.updateMany(
    { title: { $regex: /sportlink.*case/i } },
    { $set: { category: 'electronics', subcategory: 'accessories' } }
  );
  await Product.updateMany(
    { title: { $regex: /metal band.*watch/i } },
    { $set: { category: 'electronics', subcategory: 'accessories' } }
  );
  console.log('✅ Fixed Galaxy phone and watch categories.');

  // 4. Fix refrigerators misclassified in home
  const fridges = await Product.find({
    category: 'home',
    title: { $regex: /\b(refrigerator|direct-cool single|single door refrigerator)\b/i }
  });
  console.log(`Found ${fridges.length} refrigerators in home.`);
  for (const f of fridges) {
    f.category = 'appliances';
    f.subcategory = 'refrigerators';
    await f.save();
  }

  // 5. Expire impossible extreme discount deals (>98% discount on phones/laptops/USD items)
  const fakeDeals = await Deal.find({
    isExpired: { $ne: true },
    $or: [
      { discountPercentage: { $gte: 98 }, dealPrice: { $lt: 600 } },
      { title: { $regex: /iphone/i }, dealPrice: { $lt: 2000 } }
    ]
  });
  console.log(`Found ${fakeDeals.length} impossible fake discount deals.`);
  for (const d of fakeDeals) {
    d.isExpired = true;
    d.expiredAt = new Date();
    await d.save();
    console.log(`   -> Expired impossible deal: ${d.title.slice(0, 40)} (₹${d.dealPrice} vs MRP ₹${d.originalPrice})`);
  }

  // 6. Ensure products with empty subcategory get 'decor' or relevant subcategory
  const emptySub = await Product.find({
    $or: [{ subcategory: null }, { subcategory: '' }, { subcategory: { $exists: false } }]
  });
  console.log(`Found ${emptySub.length} products with empty subcategory.`);
  for (const p of emptySub) {
    p.subcategory = p.category === 'home' ? 'decor' : 'accessories';
    await p.save();
  }

  console.log('\n[DB] Disconnecting...');
  await mongoose.disconnect();
  console.log('✅ Final cleanup complete.');
}

finalCleanup().catch(console.error);
