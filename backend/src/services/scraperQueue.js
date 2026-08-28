import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../utils/redis.js';

export const PRIORITY = {
  INTERACTIVE: 1,
  TELEGRAM: 2,
  DAILY_REFRESH: 3,
  BESTSELLER: 4,
};

function mapPriorityToSource(priority) {
  if (priority === PRIORITY.INTERACTIVE) return 'interactive';
  if (priority === PRIORITY.TELEGRAM) return 'telegram';
  if (priority === PRIORITY.DAILY_REFRESH) return 'daily_refresh';
  if (priority === PRIORITY.BESTSELLER) return 'bestseller_crawler';
  return 'other';
}

class DistributedScraperQueue {
  constructor() {
    this.queue = null;
    this.queueEvents = null;
    this.initQueue();
  }

  initQueue() {
    try {
      const redisConnection = createRedisConnection();
      this.queue = new Queue('scraper-queue', {
        connection: redisConnection,
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 500,
          attempts: 1,
        },
      });

      const eventsConnection = createRedisConnection();
      this.queueEvents = new QueueEvents('scraper-queue', {
        connection: eventsConnection,
      });

      console.log('[Backend Scraper Queue] Connected to BullMQ Distributed Queue "scraper-queue".');
    } catch (err) {
      console.error('[Backend Scraper Queue Init Error]:', err.message);
    }
  }

  async enqueue(url, options = {}) {
    const priority = options.priority || PRIORITY.TELEGRAM;
    const source = options.source || mapPriorityToSource(priority);

    if (!this.queue || !this.queueEvents) {
      this.initQueue();
    }

    try {
      const job = await this.queue.add(
        'scrape',
        { url, source, enqueuedAt: Date.now() },
        { priority }
      );

      const result = await job.waitUntilFinished(this.queueEvents, 70000);
      return result?.html || null;
    } catch (err) {
      console.error(`[Backend Scraper Queue Error] Job failed for ${url.slice(0, 45)}:`, err.message);
      return null;
    }
  }
}

export const scraperQueue = new DistributedScraperQueue();
