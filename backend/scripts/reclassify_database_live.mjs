import mongoose from 'mongoose';
import fs from 'fs';
import dotenv from 'dotenv';
import { classifyProduct } from '../src/utils/categoryClassifier.js';

const env = dotenv.parse(fs.readFileSync('./api/.env'));

async function runLiveReclassification() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log('--- STEP 1: RECLASSIFYING DEALS COLLECTION ---');
  const deals = await db.collection('deals').find({}).project({ _id: 1, title: 1, category: 1, subcategory: 1, merchant: 1 }).toArray();
  console.log(`Processing ${deals.length} deals...`);

  const dealOps = [];
  for (const d of deals) {
    const classification = classifyProduct(d.title, d.merchant);
    if (!classification) continue;

    const oldCat = d.category || 'none';
    const oldSub = d.subcategory || 'none';
    const newCat = classification.category;
    const newSub = classification.subcategory;

    if (oldCat === newCat && oldSub === newSub) continue;

    let shouldMove = false;

    // 1. If currently in home/decor, general, or empty
    if ((oldCat === 'home' && (oldSub === 'decor' || oldSub === 'none')) || oldCat === 'general' || oldCat === 'none' || !d.category) {
      if (`${newCat}/${newSub}` !== 'home/decor') shouldMove = true;
    }
    // 2. If in electronics/laptops but is accessory, bag, or desk
    else if (oldCat === 'electronics' && oldSub === 'laptops') {
      if (newCat === 'electronics' && newSub === 'accessories') shouldMove = true;
      else if (newCat === 'travel') shouldMove = true;
      else if (newCat === 'home') shouldMove = true;
    }
    // 3. If in electronics/mobiles but is accessory, wearable, or audio
    else if ((oldCat === 'electronics' && oldSub === 'mobiles') || oldCat === 'mobiles') {
      if (newCat === 'electronics' && newSub !== 'mobiles') shouldMove = true;
    }
    // 4. If in appliances but is USB flash drive, detergent, cleaner, or heating pad
    else if (oldCat === 'appliances') {
      if (newCat === 'electronics' || newCat === 'home' || newCat === 'personal-care') shouldMove = true;
      else if (newCat === 'appliances' && newSub !== oldSub) shouldMove = true;
    }
    // 5. If in grocery but is furniture, pet food, or whey protein
    else if (oldCat === 'grocery') {
      if (newCat === 'home' || newCat === 'pets' || newCat === 'fitness') shouldMove = true;
    }
    // 6. If in fashion but is luggage, bag, pad, diaper, or auto helmet
    else if (oldCat === 'men-fashion' || oldCat === 'women-fashion' || oldCat === 'fashion') {
      if (newCat === 'travel' || newCat === 'personal-care' || newCat === 'baby-kids' || newCat === 'auto') shouldMove = true;
      else if (oldCat === 'men-fashion' && newCat === 'women-fashion') shouldMove = true;
      else if (oldCat === 'women-fashion' && newCat === 'men-fashion') shouldMove = true;
    }
    // 7. If in baby-kids but is adult puzzle
    else if (oldCat === 'baby-kids' && /\bfor adults\b/i.test(d.title)) {
      shouldMove = true;
    }
    // 8. If in auto but is pool cleaner or barcode scanner
    else if (oldCat === 'auto') {
      if (newCat !== 'auto') shouldMove = true;
    }

    if (shouldMove) {
      dealOps.push({
        updateOne: {
          filter: { _id: d._id },
          update: { $set: { category: newCat, subcategory: newSub } }
        }
      });
    }
  }

  console.log(`Executing ${dealOps.length} deal reclassifications in batches of 500...`);
  for (let i = 0; i < dealOps.length; i += 500) {
    const chunk = dealOps.slice(i, i + 500);
    await db.collection('deals').bulkWrite(chunk, { ordered: false });
    console.log(`  Deals: Processed ${Math.min(i + 500, dealOps.length)} / ${dealOps.length}`);
  }

  console.log('\n--- STEP 2: RECLASSIFYING PRODUCTS COLLECTION ---');
  const prods = await db.collection('products').find({}).project({ _id: 1, title: 1, category: 1, subcategory: 1, merchant: 1 }).toArray();
  console.log(`Processing ${prods.length} products...`);

  const prodOps = [];
  for (const p of prods) {
    const classification = classifyProduct(p.title, p.merchant);
    if (!classification) continue;

    const oldCat = p.category || 'none';
    const oldSub = p.subcategory || 'none';
    const newCat = classification.category;
    const newSub = classification.subcategory;

    if (oldCat === newCat && oldSub === newSub) continue;

    let shouldMove = false;

    // 1. If currently in home/decor, general, or empty
    if ((oldCat === 'home' && (oldSub === 'decor' || oldSub === 'none')) || oldCat === 'general' || oldCat === 'none' || !p.category) {
      if (`${newCat}/${newSub}` !== 'home/decor') shouldMove = true;
    }
    // 2. If in electronics/laptops but is accessory, bag, or desk
    else if (oldCat === 'electronics' && oldSub === 'laptops') {
      if (newCat === 'electronics' && newSub === 'accessories') shouldMove = true;
      else if (newCat === 'travel') shouldMove = true;
      else if (newCat === 'home') shouldMove = true;
    }
    // 3. If in electronics/mobiles but is accessory, wearable, or audio
    else if ((oldCat === 'electronics' && oldSub === 'mobiles') || oldCat === 'mobiles') {
      if (newCat === 'electronics' && newSub !== 'mobiles') shouldMove = true;
    }
    // 4. If in appliances but is USB flash drive, detergent, cleaner, or heating pad
    else if (oldCat === 'appliances') {
      if (newCat === 'electronics' || newCat === 'home' || newCat === 'personal-care') shouldMove = true;
      else if (newCat === 'appliances' && newSub !== oldSub) shouldMove = true;
    }
    // 5. If in grocery but is furniture, pet food, or whey protein
    else if (oldCat === 'grocery') {
      if (newCat === 'home' || newCat === 'pets' || newCat === 'fitness') shouldMove = true;
    }
    // 6. If in fashion but is luggage, bag, pad, diaper, or auto helmet
    else if (oldCat === 'men-fashion' || oldCat === 'women-fashion' || oldCat === 'fashion') {
      if (newCat === 'travel' || newCat === 'personal-care' || newCat === 'baby-kids' || newCat === 'auto') shouldMove = true;
      else if (oldCat === 'men-fashion' && newCat === 'women-fashion') shouldMove = true;
      else if (oldCat === 'women-fashion' && newCat === 'men-fashion') shouldMove = true;
    }
    // 7. If in baby-kids but is adult puzzle
    else if (oldCat === 'baby-kids' && /\bfor adults\b/i.test(p.title)) {
      shouldMove = true;
    }
    // 8. If in auto but is pool cleaner or barcode scanner
    else if (oldCat === 'auto') {
      if (newCat !== 'auto') shouldMove = true;
    }

    if (shouldMove) {
      prodOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { category: newCat, subcategory: newSub } }
        }
      });
    }
  }

  console.log(`Executing ${prodOps.length} product reclassifications in batches of 500...`);
  for (let i = 0; i < prodOps.length; i += 500) {
    const chunk = prodOps.slice(i, i + 500);
    await db.collection('products').bulkWrite(chunk, { ordered: false });
    console.log(`  Products: Processed ${Math.min(i + 500, prodOps.length)} / ${prodOps.length}`);
  }

  console.log('\n--- STEP 3: ELIMINATING ANY REMAINING "general" DEALS/PRODUCTS ---');
  await db.collection('deals').updateMany(
    { category: 'general' },
    { $set: { category: 'home', subcategory: 'decor' } }
  );
  await db.collection('products').updateMany(
    { category: 'general' },
    { $set: { category: 'home', subcategory: 'decor' } }
  );

  console.log('✅ RECLASSIFICATION MIGRATION COMPLETE!');
  await mongoose.disconnect();
}

runLiveReclassification().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
