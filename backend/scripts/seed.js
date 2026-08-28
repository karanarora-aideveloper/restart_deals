import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';
import ScrapingAntToken from '../src/db/models/scrapingAntToken.js';

async function seed() {
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is missing in .env');
    process.exit(1);
  }

  console.log('Connecting to database:', config.mongodbUri.replace(/:[^@]+@/, ':****@'));
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB.');

  try {
    // 1. Seed Monitored Channels
    console.log('Seeding monitored channels...');
    await Channel.deleteMany({}); // Reset for clean seed
    
    const initialChannels = [
      {
        channelId: 'pending_resolve_1',
        username: 'desidime', // Popular deal community username in India as a template
        name: 'DesiDime Deals',
        isActive: true
      },
      {
        channelId: 'pending_resolve_2',
        username: 'lootoftheday', // Standard template deals channel
        name: 'Loot Of The Day',
        isActive: true
      }
    ];

    await Channel.insertMany(initialChannels);
    console.log('✓ Successfully seeded monitored channels.');

    // 2. Seed ScrapingAnt Tokens
    console.log('Seeding ScrapingAnt API tokens...');
    await ScrapingAntToken.deleteMany({}); // Reset for clean seed

    const initialTokens = [
      {
        token: 'PLACEHOLDER_SCRAPINGANT_KEY_1',
        usageCount: 0,
        status: 'active'
      },
      {
        token: 'PLACEHOLDER_SCRAPINGANT_KEY_2',
        usageCount: 0,
        status: 'active'
      }
    ];

    await ScrapingAntToken.insertMany(initialTokens);
    console.log('✓ Successfully seeded ScrapingAnt API tokens.');

    console.log('\n==================================================');
    console.log('           SEEDING COMPLETED SUCCESSFULLY!        ');
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

seed();
