import mongoose from 'mongoose';
import config from '../src/config.js';
import Channel from '../src/db/models/channel.js';

await mongoose.connect(config.mongodbUri);

const dealKeywords = ['deal', 'loot', 'offer', 'shopping', 'price', 'bargain', 'tricks', 'store', 'market', 'discount', 'earn', 'coupon'];

const orConditions = dealKeywords.flatMap(k => [
  { name: new RegExp(k, 'i') },
  { username: new RegExp(k, 'i') }
]);

const result = await Channel.updateMany(
  { $or: orConditions },
  { $set: { isActive: true } }
);

console.log(`✓ Activated ${result.modifiedCount} shopping & deal channels in MongoDB.`);

const activeChans = await Channel.find({ isActive: true });
console.log(`Total Active Channels Now (${activeChans.length}):`, activeChans.map(c => c.name || c.username));

await mongoose.disconnect();
