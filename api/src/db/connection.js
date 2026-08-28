import mongoose from 'mongoose';
import config from '../config.js';

export async function connectDB() {
  if (!config.mongodbUri) {
    console.error('[Database Error] MONGODB_URI is missing in environment.');
    process.exit(1);
  }

  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[API Database] Connected to MongoDB Atlas successfully.');
  } catch (err) {
    console.error('[API Database Error] Connection failed:', err.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[API Database] Disconnected from MongoDB.');
  } catch (err) {
    console.error('[API Database Error] Disconnection error:', err.message);
  }
}
