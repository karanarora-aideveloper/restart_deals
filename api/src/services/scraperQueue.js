import { Queue, Job } from 'bullmq';
import zlib from 'zlib';
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
        // ACTUAL root cause of the 2026-08-30 incident (the removeOnComplete fix below and
        // the gzip fix in scraperWorker.js were real bugs worth fixing but were NOT this):
        // BullMQ auto-logs every job lifecycle event (added/active/completed/failed/...) to
        // a Redis Stream at `bull:scraper-queue:events`, written by the Queue/Worker
        // regardless of whether anything (e.g. QueueEvents) is listening to it — and nothing
        // in this codebase does; QueueEvents was removed from both scraperQueue.js copies in
        // an earlier fix. BullMQ's own default cap for this stream is 10,000 entries, and
        // confirmed live via a one-off diagnostic (GET /api/admin/redis-debug) that default
        // alone reached 22MB — 96% of this instance's 25MB total, dwarfing every job hash
        // combined (<1KB each). THAT's what was actually climbing to the cap and getting
        // evicted every ~10 minutes, completely independent of job payload size or count.
        // Since nothing ever reads this stream, there's no reason to keep 10,000 of anything
        // — capped far tighter, generous only for a quick manual peek if ever needed.
        streams: { events: { maxLen: 500 } },
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
          // Automatic retry for transient failures (network timeouts, 409 concurrency
          // contention, exhausted tokens — see scraperWorker.js's executeScrapingAntJob for
          // exactly which failure modes throw vs. return null). Previously attempts: 1 meant
          // ANY such failure was final immediately — the only path back to that URL was the
          // 24h daily refresher's staleness sweep, so a Telegram-triggered deal that hit a
          // transient blip could sit unresolved for up to a day. 3 attempts with exponential
          // backoff (5s, 10s) gives it two more chances within seconds/tens-of-seconds — each
          // retry re-runs the whole job, including a fresh atomic token lease, so it's not
          // just blindly repeating the same failing request. Non-transient failures (404s,
          // Amazon's 423 anti-scraping block, no active tokens) still return null instead of
          // throwing, so they're NOT retried and don't burn extra ScrapingAnt credits chasing
          // something a retry can't fix.
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      });

      console.log('[Scraper Queue] Initialized BullMQ Distributed Queue on "scraper-queue".');

      // The streams.events.maxLen option above only bounds FUTURE growth — it does nothing
      // to the ~22MB already sitting in bull:scraper-queue:events from before this fix
      // existed (confirmed via GET /api/admin/redis-debug). Trim it once, actively, on every
      // boot: harmless/no-op once already trimmed, and self-healing across restarts/deploys
      // without needing a one-off manual script.
      this.queue.trimEvents(500)
        .then(() => console.log('[Scraper Queue] Trimmed bull:scraper-queue:events to 500 entries.'))
        .catch((err) => console.warn('[Scraper Queue] trimEvents failed (non-fatal):', err.message));
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
      // Must exceed the worker's worst case. A single BullMQ attempt can itself take up to
      // ~188s pathologically (90s render + 409 rotate + a second 90s render + 8s grace).
      // With attempts: 3 + exponential backoff (5s, 10s — see defaultJobOptions below) now
      // retrying transient failures, the full worst case across all attempts is higher than
      // one attempt alone — sized with headroom for that without being reckless (this is
      // also the ceiling an interactive "re-check price" click can block on).
      const TIMEOUT = 300000;
      const POLL_INTERVAL = 1000;
      const deadline = Date.now() + TIMEOUT;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        const fresh = await Job.fromId(this.queue, job.id);
        if (!fresh) break; // Removed by removeOnComplete before we could read it — treat as done
        const state = await fresh.getState();
        if (state === 'completed') {
          // Worker gzips the page before returning it (see scraperWorker.js) — decompress
          // here so every caller (verifier.js, productScraper.js, bestsellerCrawler.js)
          // keeps getting a plain HTML string back, unaware this ever changed.
          const gz = fresh.returnvalue?.htmlGzip;
          if (!gz) return null;
          try {
            return zlib.gunzipSync(Buffer.from(gz, 'base64')).toString('utf-8');
          } catch (err) {
            console.error(`[Scraper Queue Error] Failed to decompress result for ${url.slice(0, 45)}:`, err.message);
            return null;
          }
        }
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
