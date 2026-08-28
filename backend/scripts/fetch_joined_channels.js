import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';

const keywords = ['deal', 'loot', 'offer', 'coupon', 'discount', 'sale', 'trick', 'price', 'shop', 'amazon', 'flipkart'];

async function fetchChannels() {
  const { apiId, apiHash, session } = config.telegram;

  if (!apiId || !apiHash || !session) {
    console.error('Missing Telegram configuration (API_ID, HASH, or SESSION) in .env');
    process.exit(1);
  }

  // Connect to MongoDB
  console.log('Connecting to database...');
  await mongoose.connect(config.mongodbUri);
  console.log('Connected to MongoDB.');

  console.log('Initializing Telegram client...');
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.connect();
  console.log('Connected to Telegram.');

  try {
    console.log('Fetching your dialogs/channels list...');
    const dialogs = await client.getDialogs({});
    console.log(`Retrieved ${dialogs.length} dialogs. Filtering for deal channels...`);

    const dealChannels = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;
      // Filter for channels (GramJS isChannel helper or checking className)
      if (dialog.isChannel && entity) {
        const title = entity.title || '';
        const username = entity.username || '';
        const channelId = entity.id.toString();

        const matchText = `${title} ${username}`.toLowerCase();
        const isDealChannel = keywords.some(keyword => matchText.includes(keyword));

        if (isDealChannel) {
          dealChannels.push({
            channelId,
            username: username ? `@${username}` : 'Private Channel',
            name: title
          });
        }
      }
    }

    if (dealChannels.length === 0) {
      console.log('No deal-related channels found in your joined dialogues.');
      return;
    }

    console.log('\n==================================================');
    console.log(`   FOUND ${dealChannels.length} JOINED DEAL CHANNELS`);
    console.log('==================================================');
    dealChannels.forEach((chan, idx) => {
      console.log(`${idx + 1}. Title: "${chan.name}" | Username: ${chan.username} | ID: ${chan.channelId}`);
    });
    console.log('==================================================\n');

    // Ask to update monitored_channels collection
    console.log('Syncing these channels with your "monitored_channels" collection in MongoDB...');
    let addedCount = 0;
    
    for (const chan of dealChannels) {
      // Check if already monitored
      const existing = await Channel.findOne({ channelId: chan.channelId });
      if (!existing) {
        const newChan = new Channel({
          channelId: chan.channelId,
          username: chan.username !== 'Private Channel' ? chan.username : chan.name,
          name: chan.name,
          isActive: true
        });
        await newChan.save();
        addedCount++;
        console.log(`Added channel to monitor: "${chan.name}" (${chan.username})`);
      }
    }

    console.log(`\n✓ Sync completed. Added ${addedCount} new channels to your monitored list.`);
  } catch (err) {
    console.error('❌ Error fetching channels:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

fetchChannels();
