import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

const subcats = [
  { cat: "electronics", sub: "mobiles" },
  { cat: "electronics", sub: "laptops" },
  { cat: "electronics", sub: "audio" },
  { cat: "electronics", sub: "tv" },
  { cat: "electronics", sub: "wearables" },
  { cat: "beauty", sub: "skincare" },
  { cat: "beauty", sub: "makeup" },
  { cat: "beauty", sub: "haircare" },
  { cat: "beauty", sub: "bath-body" },
  { cat: "home", sub: "kitchen" },
  { cat: "home", sub: "appliances-large" },
  { cat: "home", sub: "decor" },
  { cat: "men-fashion", sub: "footwear" },
  { cat: "men-fashion", sub: "men-topwear" },
  { cat: "women-fashion", sub: "women-footwear" },
  { cat: "fitness", sub: "gym-equipment" },
  { cat: "fitness", sub: "sports-gear" },
  { cat: "general", sub: "groceries" },
];

async function seedTop20() {
  await mongoose.connect(MONGODB_URI);
  console.log('[Seed Top20] Connected to MongoDB Atlas.');
  const db = mongoose.connection.db;

  let totalTagged = 0;

  for (const s of subcats) {
    const candidates = await db.collection("products").find({
      subcategory: s.sub,
      isActive: true,
      price: { $gt: 50 },
      imageUrl: { $ne: null, $exists: true },
      $or: [{ country: "IN" }, { country: { $exists: false } }, { country: null }]
    })
    .sort({ rating: -1, price: -1 })
    .limit(20)
    .toArray();

    let rank = 1;
    for (const prod of candidates) {
      await db.collection("products").updateOne(
        { _id: prod._id },
        {
          $set: {
            isTop20: true,
            top20Category: s.cat,
            top20Subcategory: s.sub,
            top20Rank: rank++,
            productSource: prod.productSource || 'top20_catalog'
          }
        }
      );
      totalTagged++;
    }
    console.log(`✓ Enrolled ${candidates.length} Top-20 products for ${s.cat}/${s.sub}`);
  }

  const finalCount = await db.collection("products").countDocuments({ isTop20: true });
  console.log(`\n====================================================`);
  console.log(`[Seed Top20 Finished] Successfully seeded ${totalTagged} products.`);
  console.log(`Total isTop20 products in DB: ${finalCount}`);
  console.log(`====================================================\n`);

  await mongoose.disconnect();
}

seedTop20().catch(err => {
  console.error('[Seed Top20 Error]:', err);
  process.exit(1);
});
