import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  const conn = await mongoose.connect(MONGODB_URI);
  const db = conn.connection.db;

  console.log('1. Setting TTL index on verified_links...');
  try {
    await db.collection('verified_links').createIndex(
      { lastChecked: 1 },
      { expireAfterSeconds: 7776000, background: true }
    );
    console.log('✓ TTL index on verified_links created successfully.');
  } catch (e) {
    console.warn('verified_links index:', e.message);
  }

  console.log('2. Setting compound and TTL indexes on grocery_price_history...');
  try {
    await db.collection('grocery_price_history').createIndex(
      { platform: 1, storeId: 1, productId: 1, unit: 1 },
      { unique: true, background: true }
    );
    await db.collection('grocery_price_history').createIndex(
      { lastSeenAt: 1 },
      { expireAfterSeconds: 5184000, background: true }
    );
    console.log('✓ Indexes on grocery_price_history created successfully.');
  } catch (e) {
    console.warn('grocery_price_history index:', e.message);
  }

  console.log('3. Checking and dropping empty ghost collections...');
  const collections = await db.listCollections().toArray();
  const colNames = collections.map(c => c.name);

  if (colNames.includes('pricealerts')) {
    const count = await db.collection('pricealerts').countDocuments();
    if (count === 0) {
      await db.collection('pricealerts').drop();
      console.log('✓ Dropped phantom collection "pricealerts" (0 docs)');
    } else {
      console.log(`Skipped dropping pricealerts: has ${count} docs`);
    }
  }

  if (colNames.includes('scrapinganttokens')) {
    const count = await db.collection('scrapinganttokens').countDocuments();
    if (count === 0) {
      await db.collection('scrapinganttokens').drop();
      console.log('✓ Dropped phantom collection "scrapinganttokens" (0 docs)');
    } else {
      console.log(`Skipped dropping scrapinganttokens: has ${count} docs`);
    }
  }

  console.log('Done!');
  await mongoose.disconnect();
}

run().catch(console.error);
