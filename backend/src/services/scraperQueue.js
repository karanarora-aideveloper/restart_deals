import { Queue, Job } from 'bullmq';
import zlib from 'zlib';
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
        // ACTUAL root cause of the 2026-08-30 incident — see the matching comment in
        // api/src/services/scraperQueue.js. BullMQ's events stream (bull:scraper-queue:events,
        // shared across both services since it's keyed by queue name) defaults to a 10,000-
        // entry cap that alone reached 22MB (96% of this instance's 25MB total) — nothing
        // reads this stream (QueueEvents was removed from both copies), so it's capped far
        // tighter here.
        // Tightened 500 → 100 (2026-09-01) — see api/'s matching comment: even at 500 with
        // periodic trimming, this stream was still measured at 6.9MB (~all of this Redis
        // instance's memory), and Redis's maxmemory-policy here is allkeys_lru (should be
        // noeviction for BullMQ — needs a manual Render dashboard change, no safe API path
        // to edit an existing instance's policy). Until that's fixed, minimizing this
        // stream's footprint is the safest lever available to reduce eviction risk —
        // confirmed live: logs:backend (Telegram listener logs) lost all its entries within
        // minutes of being confirmed working, consistent with eviction under pressure.
        streams: { events: { maxLen: 100 } },
        defaultJobOptions: {
          // See api/src/services/scraperQueue.js's matching comment — a completed
          // job's returnvalue is the full scraped HTML (300KB-1MB+ per page).
          // Retaining 200 of those blew past this Redis instance's 25MB free-tier
          // cap and triggered LRU eviction of BullMQ's own bookkeeping, causing the
          // mass "Job wait scrape timed out" failures across the whole pipeline.
          removeOnComplete: 5,
          removeOnFail: 500,
          // See the matching comment in api/src/services/scraperQueue.js — this is the copy
          // that actually governs Telegram-sourced (Priority 2) jobs, since defaultJobOptions
          // is applied by whichever Queue instance calls .add() (this one, for every incoming
          // Telegram message via verifier.js), not by the consuming Worker. Keep this in sync
          // with api/'s copy — attempts: 1 here would silently leave Telegram deals unretried
          // even after fixing the other copy.
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      });

      console.log('[Backend Scraper Queue] Connected to BullMQ Distributed Queue "scraper-queue".');

      // See api/src/services/scraperQueue.js's matching comment — actively trims the
      // pre-existing bloated stream on every boot, not just future growth.
      this.queue.trimEvents(100)
        .then(() => console.log('[Backend Scraper Queue] Trimmed bull:scraper-queue:events to 100 entries.'))
        .catch((err) => console.warn('[Backend Scraper Queue] trimEvents failed (non-fatal):', err.message));

      // Also re-trim periodically — see api/'s matching comment for why the one-time boot
      // trim alone isn't enough. Tightened to every 2 minutes (from 10) alongside the maxLen
      // reduction above, to keep memory pressure down as much as possible while the
      // underlying allkeys_lru eviction policy is still in place.
      setInterval(() => {
        this.queue.trimEvents(100).catch((err) =>
          console.warn('[Backend Scraper Queue] periodic trimEvents failed (non-fatal):', err.message)
        );
      }, 2 * 60 * 1000);
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
      // See api/src/services/scraperQueue.js's matching comment — sized for attempts: 3 +
      // backoff above, not just one worker attempt.
      const TIMEOUT = 300000;
      const POLL_INTERVAL = 1000;
      const deadline = Date.now() + TIMEOUT;

      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        const fresh = await Job.fromId(this.queue, job.id);
        if (!fresh) break; // Removed by removeOnComplete before we could read it — treat as done
        const state = await fresh.getState();
        if (state === 'completed') {
          // Worker gzips the page before returning it (see api/src/services/scraperWorker.js)
          // — decompress here so verifier.js keeps getting a plain HTML string back.
          const gz = fresh.returnvalue?.htmlGzip;
          if (!gz) return null;
          try {
            return zlib.gunzipSync(Buffer.from(gz, 'base64')).toString('utf-8');
          } catch (err) {
            console.error(`[Backend Scraper Queue Error] Failed to decompress result for ${url.slice(0, 45)}:`, err.message);
            return null;
          }
        }
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
