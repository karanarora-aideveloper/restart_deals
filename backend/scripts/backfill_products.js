import mongoose from 'mongoose';
import config from '../src/config.js';
import Product from '../src/db/models/product.js';
import Deal from '../src/db/models/deal.js';
import { cleanAndParseUrl } from '../src/listener/verifier.js';

await mongoose.connect(config.mongodbUri);

const deals = await Deal.find({});
console.log(`Found ${deals.length} deals in DB.`);

for (const d of deals) {
  try {
    const { cleanUrl, merchant, productId } = cleanAndParseUrl(d.dealUrl);
    let prod = await Product.findOne({
      $or: [{ productId }, { cleanUrl }]
    });

    if (!prod) {
      prod = new Product({
        productId,
        cleanUrl,
        merchant,
        title: d.title,
        images: d.images && d.images.length > 0 ? d.images : (d.imageUrl ? [d.imageUrl] : []),
        imageUrl: d.imageUrl || '',
        rating: d.rating || 0,
        reviews: d.reviews || [],
        price: d.dealPrice,
        originalPrice: d.originalPrice,
        category: d.category || 'general',
        country: d.country || 'IN',
        sourceChannelName: d.sourceChannelName || 'Unknown',
        priceUpdatedAt: d.createdAt,
        lastChecked: d.createdAt,
        createdAt: d.createdAt
      });
      await prod.save();
      console.log(`✓ Backfilled product: "${d.title}" (${merchant}, ID: ${productId})`);
    }
  } catch (err) {
    console.error(`Failed to backfill deal "${d.title}":`, err.message);
  }
}

console.log('Total Products now in MongoDB:', await Product.countDocuments());
await mongoose.disconnect();
