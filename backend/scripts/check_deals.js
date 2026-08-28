import mongoose from 'mongoose';
import config from '../src/config.js';
import Deal from '../src/db/models/deal.js';

async function checkDeals() {
  await mongoose.connect(config.mongodbUri);
  try {
    const deals = await Deal.find({}).sort({ createdAt: -1 }).limit(5);
    console.log(`Found ${deals.length} deals in DB.`);
    deals.forEach((d) => {
      console.log(`- Title: "${d.title}" | Category: ${d.category} | DealPrice: ${d.dealPrice} | OriginalPrice: ${d.originalPrice} | Discount: ${d.discountPercentage}% | URL: ${d.dealUrl}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkDeals();
