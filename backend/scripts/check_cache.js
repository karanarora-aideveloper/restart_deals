import mongoose from 'mongoose';
import config from '../src/config.js';
import VerifiedLink from '../src/db/models/verifiedLink.js';

async function checkCache() {
  await mongoose.connect(config.mongodbUri);
  try {
    const cache = await VerifiedLink.findOne({ productId: 'B002DYIZH6' });
    console.log('VerifiedLink Cache for B002DYIZH6:');
    console.log(JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

checkCache();
