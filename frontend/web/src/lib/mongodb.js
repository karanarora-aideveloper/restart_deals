import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

// Vercel spins up many short-lived instances; each opens its own pool. A big pool per
// instance quickly exhausts Atlas's connection limit (M0 = 500), after which Atlas rejects
// new TLS handshakes ("SystemOverloadedError"). Keep each instance's pool tiny and let idle
// connections go quickly.
const options = {
  maxPoolSize: 3,
  minPoolSize: 0,
  maxIdleTimeMS: 10000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 15000,
};

// Cache the connection promise on `global` in every environment so module re-evaluation
// (HMR in dev, duplicated chunks in prod) never creates a second client in the same process.
function getClientPromise() {
  if (!uri) throw new Error('MONGODB_URI environment variable is missing');
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((err) => {
      // Don't cache a failed connect — let the next call retry from scratch.
      global._mongoClientPromise = undefined;
      throw err;
    });
  }
  return global._mongoClientPromise;
}

export async function getDb(dbName = 'shoppers_deals') {
  const connectedClient = await getClientPromise();
  return connectedClient.db(dbName);
}

export default getClientPromise;
