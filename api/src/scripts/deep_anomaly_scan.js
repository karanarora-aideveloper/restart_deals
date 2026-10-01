import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';

dotenv.config({ path: path.resolve(process.cwd(), 'api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

async function deepScan() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.\n');

  // 1. Extreme discount active deals
  const extremeActive = await Deal.find({
    isExpired: { $ne: true },
    $or: [{ discountPercentage: { $gte: 95 } }, { discountPercentage: { $lte: 0 } }]
  }).lean();
  console.log('Total extreme/zero discount active deals:', extremeActive.length);

  let zeroOrNegative = 0;
  let usPriceVsInr = 0;
  let textParseGlitches = 0;
  let otherExtreme = 0;

  for (const d of extremeActive) {
    if (!d.discountPercentage || d.discountPercentage <= 0 || d.dealPrice >= d.originalPrice) {
      zeroOrNegative++;
    } else if (d.country === 'US' && d.originalPrice > 1000 && d.dealPrice < 200) {
      usPriceVsInr++;
    } else if (d.priceSource === 'price_history' || d.priceSource === 'ai_text') {
      textParseGlitches++;
    } else {
      otherExtreme++;
    }
  }

  console.log({ zeroOrNegative, usPriceVsInr, textParseGlitches, otherExtreme });

  // 2. Active deals with placeholder or missing images
  const badImages = await Deal.countDocuments({
    isExpired: { $ne: true },
    $or: [
      { imageUrl: null },
      { imageUrl: '' },
      { imageUrl: /placeholder/i }
    ]
  });
  console.log('Active deals with placeholder/missing image:', badImages);

  // 3. Active deals with Untitled or empty title
  const untitledDeals = await Deal.countDocuments({
    isExpired: { $ne: true },
    $or: [
      { title: null },
      { title: '' },
      { title: /untitled/i }
    ]
  });
  console.log('Active deals with untitled/empty title:', untitledDeals);

  // 4. Active deals pointing to OOS products
  const activeDealsList = await Deal.find({ isExpired: { $ne: true } }, { productId: 1 }).lean();
  const activePids = activeDealsList.map(d => d.productId).filter(Boolean);
  const oosProductsWithActiveDeals = await Product.countDocuments({
    productId: { $in: activePids },
    isAvailable: false
  });
  console.log('Active deals pointing to out-of-stock products:', oosProductsWithActiveDeals);

  // 5. Duplicate active deals
  const dupDeals = await Deal.aggregate([
    { $match: { isExpired: { $ne: true }, productId: { $exists: true, $ne: null } } },
    { $group: { _id: '$productId', count: { $sum: 1 }, deals: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  console.log('Product IDs with duplicate active deals:', dupDeals.length);

  // 6. Products still in "general"
  const generalProducts = await Product.find({ category: 'general' }).lean();
  console.log('Products currently in "general":', generalProducts.length);

  // 7. Misclassified home decor: phone cases and refrigerators
  const phoneCasesInDecor = await Product.countDocuments({
    category: 'home',
    title: { $regex: /\b(iphone|samsung galaxy|pixel|oneplus|case|cover)\b/i }
  });
  console.log('Phone/tech accessories misclassified in "home":', phoneCasesInDecor);

  const appliancesInHome = await Product.countDocuments({
    category: 'home',
    title: { $regex: /\b(refrigerator|fridge|washing machine|inverter ac|air conditioner|geyser|water purifier)\b/i }
  });
  console.log('Appliances misclassified in "home":', appliancesInHome);

  await mongoose.disconnect();
  console.log('\n[DB] Disconnected.');
}

deepScan().catch(console.error);
