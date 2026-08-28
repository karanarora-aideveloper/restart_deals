import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export function createRedisConnection(customOptions = {}) {
  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
      const delay = Math.min(times * 500, 3000);
      return delay;
    },
    ...customOptions,
  });

  connection.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      console.warn(`[Redis Warning] Unable to connect to Redis at ${REDIS_URL}. Will retry automatically...`);
    } else {
      console.error('[Redis Error]:', err.message);
    }
  });

  connection.on('connect', () => {
    console.log(`[Redis] Connected successfully to ${REDIS_URL.replace(/:\/\/[^@]+@/, '://***@')}`);
  });

  return connection;
}

export const defaultRedis = createRedisConnection();
