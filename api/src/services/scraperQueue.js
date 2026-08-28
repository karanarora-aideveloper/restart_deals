import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../utils/redis.js';

export const PRIORITY = {
  INTERACTIVE: 1,    // On-demand user click ("Re-check Live Price", URL search paste)
  TELEGRAM: 2,       // Live incoming deal stream verifier
  DAILY_REFRESH: 3,  // 24h background refresher
  BESTSELLER: 4,     // Category crawler
};

function mapPriorityToSource(priority) {
  if (priority === PRIORITY.INTERACTIVE) return 'interactive';
  if (priority === PRIORITY.TELEGRAM) return 'telegram';
  if (priority === PRIORITY.DAILY_REFRESH) return 'daily_refresh';
  if (priority === PRIORITY.BESTSELLER) return 'bestseller_crawler';
  return 'other';
}

/**
 * Distributed BullMQ Scraper Queue Service
 * Connects to Redis and guarantees strict global single-flight concurrency across all machines.
 */
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
          attempts: 1, // Worker handles internal token retry logic
        },
      });

      const eventsConnection = createRedisConnection();
      this.queueEvents = new QueueEvents('scraper-queue', {
        connection: eventsConnection,
      });

      console.log('[Scraper Queue] Initialized BullMQ Distributed Queue on "scraper-queue".');
    } catch (err) {
      console.error('[Scraper Queue Init Error]:', err.message);
    }
  }

  /**
   * Enqueue a scraping task with priority.
   * Dispatches to Redis and awaits worker completion.
   * @param {string} url - Target product or category URL
   * @param {Object} options - { priority, source }
   * @returns {Promise<string|null>} HTML content
   */
  async enqueue(url, options = {}) {
    const priority = options.priority || PRIORITY.DAILY_REFRESH;
    const source = options.source || mapPriorityToSource(priority);

    if (!this.queue || !this.queueEvents) {
      console.warn('[Scraper Queue Warning] Queue not initialized. Re-initializing...');
      this.initQueue();
    }

    try {
      // Add job with BullMQ priority (lower number = higher priority)
      const job = await this.queue.add(
        'scrape',
        { url, source, enqueuedAt: Date.now() },
        { priority }
      );

      // Await job execution from the distributed worker
      const result = await job.waitUntilFinished(this.queueEvents, 70000);
      return result?.html || null;
    } catch (err) {
      console.error(`[Scraper Queue Error] Job failed for ${url.slice(0, 45)}:`, err.message);
      return null;
    }
  }

  /**
   * Get real-time queue health and metrics from Redis.
   */
  async getStatus() {
    if (!this.queue) return { queueLength: 0, isProcessing: false, stats: {} };

    try {
      const counts = await this.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      return {
        queueLength: (counts.waiting || 0) + (counts.delayed || 0),
        activeWorkers: counts.active || 0,
        isProcessing: (counts.active || 0) > 0,
        counts,
      };
    } catch (err) {
      return { queueLength: 0, isProcessing: false, error: err.message };
    }
  }
}

export const scraperQueue = new DistributedScraperQueue();
