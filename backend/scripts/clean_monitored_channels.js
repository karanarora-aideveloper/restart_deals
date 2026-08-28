import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';

// The user's own channels to exclude from monitored sources
const excludedIds = ['3808139202', '1420053275'];
const excludedUsernames = ['@fitnessdealsindia', '@amazondeallovers', 'fitnessdealsindia', 'amazondeallovers'];

// The list of channels we seeded earlier to remove
const seededUsernames = ['desidime', 'lootoftheday', '@desidime', '@lootoftheday'];

async function cleanChannels() {
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is missing in .env');
    process.exit(1);
  }

  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB.');

  try {
    // 1. Remove the user's own channels from the source list
    console.log('Removing user\'s own channels from monitored list...');
    const removeOwnResult = await Channel.deleteMany({
      $or: [
        { channelId: { $in: excludedIds } },
        { username: { $in: excludedUsernames } }
      ]
    });
    console.log(`✓ Removed ${removeOwnResult.deletedCount} own channels.`);

    // 2. Remove previous seeded template channels (like desidime)
    console.log('Removing previously seeded template channels...');
    const removeSeededResult = await Channel.deleteMany({
      $or: [
        { username: { $in: seededUsernames } },
        { channelId: '1081657902' } // Numeric ID resolved for desidime
      ]
    });
    console.log(`✓ Removed ${removeSeededResult.deletedCount} seeded channels.`);

    // Log the current list of monitored channels
    const remainingChannels = await Channel.find({});
    console.log(`\nRemaining Monitored Channels Count: ${remainingChannels.length}`);
    console.log('Sample of remaining channels:');
    remainingChannels.slice(0, 5).forEach((c, idx) => {
      console.log(`- ${c.name} (${c.username})`);
    });

  } catch (err) {
    console.error('❌ Failed to clean channels:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

cleanChannels();
