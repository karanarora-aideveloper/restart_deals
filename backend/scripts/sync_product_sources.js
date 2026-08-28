import mongoose from 'mongoose';
import config from '../src/config.js';
import Product from '../src/db/models/product.js';
import Deal from '../src/db/models/deal.js';

async function syncProductSources() {
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB. Syncing product sourceChannelName...');

  const deals = await Deal.find({});
  console.log(`Found ${deals.length} deals in DB.`);

  let updatedCount = 0;

  for (const d of deals) {
    if (!d.sourceChannelName) continue;

    const query = [];
    if (d.dealUrl) query.push({ cleanUrl: d.dealUrl });
    if (d.title) query.push({ title: d.title });
    if (d.imageUrl) query.push({ imageUrl: d.imageUrl });

    if (query.length === 0) continue;

    const res = await Product.updateMany(
      { $or: query },
      { 
        $set: { 
          sourceChannelName: d.sourceChannelName,
          country: d.country || 'IN'
        } 
      }
    );

    if (res.modifiedCount > 0) {
      updatedCount += res.modifiedCount;
      console.log(`✓ Synced ${res.modifiedCount} product(s) for deal "${d.title?.slice(0, 30)}" -> Source: "${d.sourceChannelName}"`);
    }
  }

  // Set default fallback for any remaining products without sourceChannelName
  const defaultRes = await Product.updateMany(
    { $or: [{ sourceChannelName: { $exists: false } }, { sourceChannelName: null }, { sourceChannelName: '' }] },
    { $set: { sourceChannelName: 'Telegram Deals' } }
  );

  console.log(`\nSync complete! Updated ${updatedCount} products from deals, and set default source on ${defaultRes.modifiedCount} remaining products.`);
  await mongoose.disconnect();
  process.exit(0);
}

syncProductSources().catch(console.error);
