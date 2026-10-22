import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasHindiCharacters, translateHindiToEnglish } from '../utils/languageUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI!');
  process.exit(1);
}

const DealSchema = new mongoose.Schema({}, { strict: false, collection: 'deals' });
const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });

const Deal = mongoose.model('Deal', DealSchema);
const Product = mongoose.model('Product', ProductSchema);

async function runHealing() {
  await mongoose.connect(MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  // 1. Scan and heal active/recent deals with Hindi characters
  console.log('Scanning deals for Hindi titles...');
  const dealsCursor = Deal.find({}, { title: 1, originalText: 1, dealPrice: 1, previousPrice: 1 }).cursor({ batchSize: 500 });
  
  const hindiDeals = [];
  for await (const doc of dealsCursor) {
    if (doc.title && hasHindiCharacters(doc.title)) {
      hindiDeals.push(doc);
    }
  }
  console.log(`Found ${hindiDeals.length} deals with Hindi titles.`);

  let dealHealedCount = 0;
  for (const deal of hindiDeals) {
    const originalHindiTitle = deal.title;
    const translatedTitle = await translateHindiToEnglish(originalHindiTitle);
    
    if (translatedTitle && translatedTitle !== originalHindiTitle) {
      let updateFields = { title: translatedTitle };

      if (deal.originalText && hasHindiCharacters(deal.originalText)) {
        if (deal.originalText.startsWith('Genuine Price Drop:')) {
          updateFields.originalText = `Genuine Price Drop: ${translatedTitle} at ₹${deal.dealPrice}${deal.previousPrice ? ` (Dropped from ₹${deal.previousPrice})` : ''}`;
        } else {
          updateFields.originalText = await translateHindiToEnglish(deal.originalText);
        }
      }

      await Deal.updateOne({ _id: deal._id }, { $set: updateFields });
      dealHealedCount++;
      console.log(`[Deal ${dealHealedCount}/${hindiDeals.length}] Healed:`);
      console.log(`   Before: ${originalHindiTitle.slice(0, 60)}...`);
      console.log(`   After:  ${translatedTitle.slice(0, 60)}...`);
    }
  }

  // 2. Scan and heal products with Hindi characters
  console.log('\nScanning products for Hindi titles...');
  const productsCursor = Product.find({}, { title: 1 }).cursor({ batchSize: 1000 });
  
  const hindiProducts = [];
  for await (const prod of productsCursor) {
    if (prod.title && hasHindiCharacters(prod.title)) {
      hindiProducts.push(prod);
    }
  }
  console.log(`Found ${hindiProducts.length} products with Hindi titles.`);

  let prodHealedCount = 0;
  for (const prod of hindiProducts) {
    const originalHindiTitle = prod.title;
    const translatedTitle = await translateHindiToEnglish(originalHindiTitle);

    if (translatedTitle && translatedTitle !== originalHindiTitle) {
      await Product.updateOne({ _id: prod._id }, { $set: { title: translatedTitle } });
      prodHealedCount++;
      if (prodHealedCount % 20 === 0 || prodHealedCount === hindiProducts.length) {
        console.log(`[Product ${prodHealedCount}/${hindiProducts.length}] Healed: "${translatedTitle.slice(0, 60)}..."`);
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`✓ Healing complete!`);
  console.log(`  Deals updated:    ${dealHealedCount}/${hindiDeals.length}`);
  console.log(`  Products updated: ${prodHealedCount}/${hindiProducts.length}`);
  console.log(`========================================`);

  await mongoose.disconnect();
  process.exit(0);
}

runHealing().catch(err => {
  console.error('Fatal error in healing script:', err);
  process.exit(1);
});
