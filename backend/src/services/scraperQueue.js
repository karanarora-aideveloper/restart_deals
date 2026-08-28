import { Queue, Job } from 'bullmq';
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

      console.log('[Backend Scraper Queue] Connected to BullMQ Distributed Queue "scraper-queue".');
    } catch (err) {
      console.error('[Backend Scraper Queue Init Error]:', err.message);
    }
  }

  async enqueue(url, options = {}) {
    const priority = options.priority || PRIORITY.TELEGRAM;
    const source = options.source || mapPriorityToSource(priority);

    if (!this.queue) {
      this.initQueue();
    }

    try {
      const job = await this.queue.add(
        'scrape',
        { url, source, enqueuedAt: Date.now() },
        { priority }
      );

      // Poll Redis directly for job completion — avoids pub/sub (QueueEvents) reliability
      // issues on Valkey/Render where completion events are never received.
      const TIMEOUT = 70000;
      const POLL_INTERVAL = 1000;
      const deadline = Date.now() + TIMEOUT;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        const fresh = await Job.fromId(this.queue, job.id);
        if (!fresh) break; // Removed by removeOnComplete before we could read it — treat as done
        const state = await fresh.getState();
        if (state === 'completed') return fresh.returnvalue?.html || null;
        if (state === 'failed') throw new Error(fresh.failedReason || 'Job failed');
      }

      throw new Error(`Job wait scrape timed out before finishing, no finish notification arrived after ${TIMEOUT}ms (id=${job.id})`);
    } catch (err) {
      console.error(`[Backend Scraper Queue Error] Job failed for ${url.slice(0, 45)}:`, err.message);
      return null;
    }
  }
}

export const scraperQueue = new DistributedScraperQueue();
