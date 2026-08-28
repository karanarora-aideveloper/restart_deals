import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';

await mongoose.connect(config.mongodbUri);

// Target active channels to keep ON
const keepActiveUsernames = ['@fitnessdealsindia', '@amazondeallovers', 'fitnessdealsindia', 'amazondeallovers'];

const result = await Channel.updateMany(
  { username: { $nin: keepActiveUsernames } },
  { $set: { isActive: false } }
);

console.log(`✓ Updated ${result.modifiedCount} channels to isActive: false (disabled).`);

const activeChannels = await Channel.find({ isActive: true });
console.log('Currently Active Channels:', activeChannels.map(c => c.name || c.username));

await mongoose.disconnect();
