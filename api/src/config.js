import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend or root .env
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const config = {
  port: parseInt(process.env.PORT || process.env.API_PORT || '5001', 10),
  mongodbUri: process.env.MONGODB_URI
};

if (!config.mongodbUri) {
  console.warn('[API Config Warning] MONGODB_URI is not defined in environment.');
}

export default config;
