import mongoose from 'mongoose';
import config from '../config.js';

export async function connectDB() {
  if (!config.mongodbUri) {
    console.error('[Database Error] MONGODB_URI is not defined in the environment config.');
    process.exit(1);
  }

  try {
    await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('[Database] Connected to MongoDB Atlas successfully (poolSize: 10).');
  } catch (err) {
    console.error('[Database Error] Connection failed:', err.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[Database] Disconnected from MongoDB.');
  } catch (err) {
    console.error('[Database Error] Disconnection error:', err.message);
  }
}
