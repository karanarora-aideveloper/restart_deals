import { Queue, Job } from 'bullmq';
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
    this.initQueue();
  }

  initQueue() {
    try {
      const redisConnection = createRedisConnection();
      this.queue = new Queue('scraper-queue', {
        connection: redisConnection,
        defaultJobOptions: {
          // BUG (fixed): a completed job's returnvalue is the FULL scraped HTML page
          // (scraperWorker.js's executeScrapingAntJob returns { html, ... }) — a
          // ScrapingAnt browser=true render of Amazon/Flipkart typically runs
          // 300KB-1MB+. Retaining 200 of these on this Redis instance's 25MB free-tier
          // cap (confirmed via Render metrics: usage climbing to ~25-30MB then
          // crashing to a flat ~3.3MB — a maxmemory/eviction reset, not a graceful
          // trim) blew well past capacity. With maxmemory-policy=allkeys_lru, Redis
          // then evicts keys indiscriminately once full — including BullMQ's OWN
          // bookkeeping, not just old completed jobs — which is what actually caused
          // the mass "Job wait scrape timed out" failures across Telegram
          // verification, the daily refresher, AND the bestseller crawler
          // simultaneously: the Job.fromId/getState poll below couldn't get a clean
          // read while Redis was flapping. Once the caller has read a completed job's
          // html (within ~1s via the poll loop), there's no reason to keep it around —
          // a handful of recent completions is plenty for manual debugging.
          removeOnComplete: 5,
          removeOnFail: 500,
          attempts: 1, // Worker handles internal token retry logic
        },
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

    if (!this.queue) {
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

      // Poll Redis directly for job completion — avoids pub/sub (QueueEvents) reliability
      // issues on Valkey/Render where completion events are never received.
      // Must exceed the worker's worst case: a 90s render, then a rotate/backoff and a
      // second 90s render. Timing out first would orphan a job that is still running.
      const TIMEOUT = 200000;
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
