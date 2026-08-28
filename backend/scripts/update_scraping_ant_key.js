import mongoose from 'mongoose';
import config from '../src/config.js';
import ScrapingAntToken from '../src/db/models/scrapingAntToken.js';

async function run() {
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(config.mongodbUri);

  try {
    console.log('Updating ScrapingAnt API token in MongoDB...');
    await ScrapingAntToken.deleteMany({}); // Clear placeholders
    
    const key = new ScrapingAntToken({
      token: '0e78341cb16f4f83b35a6520db0a24c5',
      usageCount: 0,
      status: 'active'
    });
    
    await key.save();
    console.log('✓ Successfully saved real ScrapingAnt token to database.');
  } catch (err) {
    console.error('❌ Failed to update key:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

run();
