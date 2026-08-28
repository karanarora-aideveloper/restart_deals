import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  mongodbUri: process.env.MONGODB_URI,
  // Public base URL this backend is reachable at — used to build URLs for
  // Telegram photos we download as a fallback image (must be a real,
  // internet-reachable URL in production; Telegram's own link-preview fetch
  // and the app's <Image> both need to load it directly).
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0', 10),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    session: process.env.TELEGRAM_SESSION || '',
    fitnessChannel: process.env.TELEGRAM_FITNESS_CHANNEL || 'fitnessdealsindia',
    generalChannel: process.env.TELEGRAM_GENERAL_CHANNEL || 'amazondeallovers',
  },
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
  }
};

// Quick validation of required variables
const missing = [];
if (!config.mongodbUri) missing.push('MONGODB_URI');
if (!config.telegram.apiId) missing.push('TELEGRAM_API_ID');
if (!config.telegram.apiHash) missing.push('TELEGRAM_API_HASH');

if (missing.length > 0) {
  console.warn(`[Config Warning] Missing important environment variables: ${missing.join(', ')}`);
  console.warn('Please check your .env file.');
}

export default config;
