import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 15000,
};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    if (!uri) {
      console.warn('[MongoDB] MONGODB_URI is not defined in environment.');
    } else {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  if (uri) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export async function getDb(dbName = 'shoppers_deals') {
  if (!clientPromise) {
    if (!uri) throw new Error('MONGODB_URI environment variable is missing');
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

export default clientPromise;
