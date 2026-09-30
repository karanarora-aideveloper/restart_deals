import cluster from 'cluster';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import zlib from 'zlib';
import { createRedisConnection } from '../utils/redis.js';
import { installSystemLogger } from '../utils/systemLogger.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import ScrapingLog from '../db/models/scrapingLog.js';
import { triggerTokenReplenishmentIfLow } from './tokenReplenisher.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

// ScrapingAnt browser=true renders routinely take 40-70s. Aborting earlier leaves the
// remote browser running and holding the account's concurrency slot, which 409s the
// next request — so this must stay comfortably above their worst-case render time.
const SCRAPE_TIMEOUT_MS = 90000;

function detectMerchant(url) {
  if (!url) return 'unknown';
  if (url.includes('amazon.')) return 'amazon';
  if (url.includes('flipkart.')) return 'flipkart';
  if (url.includes('myntra.')) return 'myntra';
  if (url.includes('nykaa.')) return 'nykaa';
  if (url.includes('ajio.')) return 'ajio';
  if (url.includes('shopsy.')) return 'shopsy';
  if (url.includes('meesho.')) return 'meesho';
  return 'unknown';
}

function extractBasicMetadata(html) {
  if (!html) return {};
  try {
    const $ = cheerio.load(html);
    let rawTitle =
      $('#productTitle').text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('meta[name="title"]').attr('content')?.trim() ||
      $('h1._6EBuvc, .pdp-title, #title').first().text().trim() ||
      $('title').first().text().trim();

    if (rawTitle) {
      rawTitle = rawTitle.replace(/\s+/g, ' ').trim();
      const lower = rawTitle.toLowerCase();
      if (lower.includes('adding to cart') || lower.includes('added to cart') || lower.includes('robot check')) {
        rawTitle = $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim();
      }
      rawTitle = rawTitle.replace(/^Amazon\.[a-z.]+\s*:\s*/i, '').trim();
    }

    const priceText = $(
      '#apexPriceToPay .a-offscreen, .priceToPay .a-offscreen, .a-price .a-offscreen, ._30jeq3, .pdp-price strong, ._cDEzb_p13n-sc-price_3mJ9Z'
    ).first().text().trim();
    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

    return {
      title: rawTitle && rawTitle.length > 2 ? rawTitle.slice(0, 160) : null,
      price: !isNaN(price) && price > 0 ? price : null,
    };
  } catch (e) {
    return {};
  }
}

async function recordScrapingLog(data) {
  try {
    await ScrapingLog.create({
      url: data.url,
      domain: new URL(data.url).hostname || '',
      merchant: detectMerchant(data.url),
      source: data.source || 'other',
      mode: 'scrapingant_proxy',
      tokenUsed: data.tokenUsed ? `${data.tokenUsed.slice(0, 6)}••••${data.tokenUsed.slice(-4)}` : null,
      status: data.status || 'success',
      statusCode: data.statusCode || 200,
      durationMs: data.durationMs || 0,
      extractedData: data.extractedData || {},
      errorMessage: data.errorMessage || null,
      createdAt: new Date(),
    });
  } catch (err) {
    console.warn('[ScrapingLog Warning] Failed to save log:', err.message);
  }
}

/**
 * Execute ScrapingAnt Request with Token Lease & Backoff
 * STRICT: 100% of store scraping flows through ScrapingAnt proxy tokens.
 * Direct scraping and local headless browsing are completely disabled.
 */
export async function executeScrapingAntJob(url, source = 'other') {
  const startTime = Date.now();

  // Atomically claim the least-recently-used active token that is not in cooldown.
  const now = new Date();
  const leased = await ScrapingAntToken.findOneAndUpdate(
    {
      status: 'active',
      $or: [
        { cooldownUntil: { $exists: false } },
        { cooldownUntil: { $lte: now } }
      ]
    },
    { $set: { lastUsedAt: now } },
    { sort: { lastUsedAt: 1 }, new: true }
  ).lean();

  if (!leased) {
    console.warn('[ScraperWorker Warning] No active ScrapingAnt tokens found in pool! Auto-replenishment triggered. Re-enqueuing job...');
    triggerTokenReplenishmentIfLow().catch(err => {
      console.warn('[ScraperWorker] Failed to trigger token replenishment:', err.message);
    });
    // Throw error so BullMQ retries with backoff instead of direct scraping
    throw new Error('No active ScrapingAnt tokens available. Auto-replenishment triggered; waiting for tokens.');
  }

  const isUs = url.includes('amazon.com') || url.includes('.us');
  const countryParam = isUs ? '&proxy_country=US' : '&proxy_country=IN';

  // Proxy tier: amazon.in works fine on ScrapingAnt's standard/datacenter proxies (10
  // credits/scrape). amazon.com does NOT — confirmed live 2026-08-30 by pulling 500 recent
  // ScrapingLog entries: amazon.com on datacenter succeeded only 36% of the time (117/500
  // hit Amazon's own 423 "Anti-scraping protection" block, another 188/500 hung until
  // ScrapingAnt's own gateway gave up around ~30s — consistent with Amazon serving a slow
  // CAPTCHA/verification challenge to a datacenter IP that never resolves) vs amazon.in on
  // the IDENTICAL proxy tier succeeding 91% of the time. Same code, same proxy type, same
  // worker fleet — the only variable was which Amazon marketplace, which isolates the cause
  // to Amazon's US bot detection being measurably more aggressive than India's against
  // non-residential IPs. This was briefly widened to "any amazon.* marketplace" to support
  // expanding to more marketplaces; that assumption held for amazon.in but not amazon.com,
  // so it's back to naming amazon.in specifically — extend to another TLD only once it's
  // been confirmed live the same way, not by assumption. Everything else (Flipkart, Myntra,
  // Nykaa, amazon.com, etc.) uses residential (125 credits/scrape, 12.5x the cost) — see the
  // Capacity Planning panel on /settings/tokens for the credit math.
  const proxyType = url.includes('amazon.in') ? 'datacenter' : 'residential';

  const buildApiUrl = (t) =>
    `https://api.scrapingant.com/v2/general?x-api-key=${t}&url=${encodeURIComponent(url)}&browser=true&proxy_type=${proxyType}${countryParam}`;

  // Stamping lastUsedAt on lease (rather than only on success) is what makes rotation
  // work: a token left holding a hung remote browser drops to the back of the queue
  // instead of being re-picked. The findOneAndUpdate above already did the stamping
  // atomically as part of the claim.
  let token = leased.token;

  let response = null;
  let durationMs = 0;

  try {
    response = await fetch(buildApiUrl(token), { signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS) });
    durationMs = Date.now() - startTime;

    if (response.status === 409) {
      // The slot is held by a still-running remote browser, so retrying the same token
      // just 409s again. Atomically claim a DIFFERENT active token — same race-avoidance
      // reasoning as the initial lease above (a plain array lookup here would risk handing
      // out a token another racing worker already claimed).
      const rotated = await ScrapingAntToken.findOneAndUpdate(
        {
          status: 'active',
          token: { $ne: token },
          $or: [
            { cooldownUntil: { $exists: false } },
            { cooldownUntil: { $lte: new Date() } }
          ]
        },
        { $set: { lastUsedAt: new Date() } },
        { sort: { lastUsedAt: 1 }, new: true }
      ).lean();
      if (rotated) {
        console.warn(`[ScraperWorker] ScrapingAnt 409 on ${url.slice(0, 45)}. Rotating to next token...`);
        token = rotated.token;
      } else {
        console.warn(`[ScraperWorker] ScrapingAnt 409 on ${url.slice(0, 45)}. No spare token, waiting 8s...`);
        await new Promise(r => setTimeout(r, 8000));
      }
      response = await fetch(buildApiUrl(token), { signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS) });
      durationMs = Date.now() - startTime;
    }
  } catch (fetchErr) {
    durationMs = Date.now() - startTime;
    console.warn(`[ScraperWorker Timeout/Error] ${url.slice(0, 45)}: ${fetchErr.message}`);
    // If request timed out, wait 8s so ScrapingAnt cloud server releases the remote browser
    await new Promise(r => setTimeout(r, 8000));
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: 'error',
      statusCode: 500,
      durationMs,
      errorMessage: fetchErr.message,
    });
    // Transient (network blip, ScrapingAnt gateway hiccup) — throw so BullMQ's
    // attempts/backoff (see scraperQueue.js's defaultJobOptions) retries the whole job,
    // which re-leases a token from scratch on the next attempt.
    throw new Error(`Timeout/network error: ${fetchErr.message}`);
  }

  if (response.status === 409) {
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: '409_concurrency',
      statusCode: 409,
      durationMs,
      errorMessage: 'Concurrency limit (409)',
    });
    await new Promise(r => setTimeout(r, 5000));
    // Still 409 after the in-place rotation above — genuine contention, not a permanent
    // failure. Throw to get a full BullMQ retry (fresh atomic token lease) rather than
    // silently giving up after one rotation attempt.
    throw new Error('ScrapingAnt 409 concurrency limit (persisted after token rotation)');
  }

  if (response.status === 429) {
    console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... hit 429 rate limit. Setting 60s cooldown.`);
    await ScrapingAntToken.updateOne(
      { token },
      { $set: { cooldownUntil: new Date(Date.now() + 60_000) } }
    ).catch(() => {});
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: '429_rate_limit',
      statusCode: 429,
      durationMs,
      errorMessage: 'ScrapingAnt rate limit (429) - 60s cooldown applied',
    });
    throw new Error('ScrapingAnt rate limit (429) - token cooled down, rotating');
  }

  if (response.status === 403) {
    console.error(`[ScraperWorker] Token ${token.slice(0, 8)}... quota exhausted (403). Rotating token & checking replenishment...`);
    await ScrapingAntToken.updateOne({ token }, { status: 'exhausted', exhaustedAt: new Date() }).catch(() => {});
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: '403_exhausted',
      statusCode: 403,
      durationMs,
      errorMessage: 'Token quota exhausted (403)',
    });
    triggerTokenReplenishmentIfLow().catch(err => {
      console.warn('[ScraperWorker] Failed to trigger token replenishment:', err.message);
    });
    // Throw error so BullMQ retries the job and leases a fresh token
    throw new Error(`ScrapingAnt token ${token.slice(0, 8)}... exhausted (403) - rotating to fresh token`);
  }

  if (response.status === 423) {
    console.warn(`[ScraperWorker] ScrapingAnt 423 (Anti-scraping protection) on ${url.slice(0, 45)}. Direct scraping fallback is disabled.`);
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: 'error',
      statusCode: 423,
      durationMs,
      errorMessage: 'ScrapingAnt HTTP 423 (Anti-scraping protection)',
    });
    return null;
  }

  if (response.ok) {
    const html = await response.text();
    await ScrapingAntToken.updateOne({ token }, { lastUsedAt: new Date(), $inc: { usageCount: 1 } }).catch(() => {});

    const extracted = extractBasicMetadata(html);
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: 'success',
      statusCode: 200,
      durationMs,
      extractedData: extracted,
    });

    // The BullMQ job result is the cross-process handoff — the enqueuing service (a
    // different machine/process from this worker) polls Redis and reads it back. That
    // means `html` has to sit in Redis at least briefly regardless of how few completed
    // jobs are retained. A ScrapingAnt browser=true render runs 300KB-1MB+ raw; gzip
    // brings that down 70-90% (HTML/JS/JSON compress extremely well) — real, measured
    // headroom on a Redis instance capped at 25MB, on top of (not instead of) the
    // removeOnComplete reduction in scraperQueue.js. See that file's comment for the
    // full incident writeup.
    const htmlGzip = zlib.gzipSync(Buffer.from(html, 'utf-8')).toString('base64');
    return { htmlGzip, extractedData: extracted, durationMs };
  }

  // Other HTTP error
  await recordScrapingLog({
    url,
    source,
    tokenUsed: token,
    status: 'error',
    statusCode: response.status,
    durationMs,
    errorMessage: `ScrapingAnt HTTP ${response.status}`,
  });
  return null;
}

let workerInstance = null;

/**
 * Initialize Distributed BullMQ Scraper Worker
 */
export function initScraperWorker(workerIndex = '1') {
  if (workerInstance) return workerInstance;

  console.log(`[Scraper Worker #${workerIndex}] Initializing BullMQ Worker for "scraper-queue"...`);
  const redisConnection = createRedisConnection();

  workerInstance = new Worker(
    'scraper-queue',
    async (job) => {
      const { url, source } = job.data;
      console.log(`[Scraper Worker #${workerIndex}] Processing Job #${job.id} [Priority ${job.opts.priority || 3}]: ${url.slice(0, 50)}...`);
      const result = await executeScrapingAntJob(url, source);
      return result;
    },
    {
      connection: redisConnection,
      concurrency: parseInt(process.env.SCRAPER_WORKER_CONCURRENCY || '1', 10),
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  workerInstance.on('completed', (job, returnvalue) => {
    console.log(`[Scraper Worker #${workerIndex}] ✓ Job #${job.id} Completed in ${returnvalue?.durationMs || 0}ms`);
  });

  workerInstance.on('failed', (job, err) => {
    const urlHint = job?.data?.url ? job.data.url.slice(0, 60) : 'unknown url';
    console.error(`[Scraper Worker #${workerIndex}] ✕ Job #${job?.id} Failed (${urlHint}):`, err.message);
  });

  return workerInstance;
}

// Support running as standalone distributed multi-process fleet: `node src/services/scraperWorker.js`
// Spawns N isolated OS processes (default 3) running independently with their own V8 engines,
// each claiming 1 job from Redis with zero concurrency collisions.
export function runStandaloneWorker() {
  const processCount = parseInt(process.env.SCRAPER_PROCESS_COUNT || '3', 10);

  if (cluster.isPrimary) {
    cluster.setupPrimary({
      exec: fileURLToPath(import.meta.url),
    });

    installSystemLogger(process.env.RAILWAY_SERVICE_NAME || 'scraper-master');

    console.log('==================================================');
    console.log(`    DISTRIBUTED SCRAPER FLEET (Master Process)   `);
    console.log(`    Spawning ${processCount} isolated worker processes...`);
    console.log('==================================================\n');

    const port = process.env.PORT || 10000;
    http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('scraper fleet: ok');
    }).listen(port, () => {
      console.log(`[Scraper Master] Health check server listening on port ${port}`);
    });

    const isPaused = process.env.WORKER_PAUSED === 'true';
    if (isPaused) {
      console.log('[Scraper Master] WORKER_PAUSED=true — staying up for health checks, skipping worker spawns.');
      return;
    }

    for (let i = 1; i <= processCount; i++) {
      cluster.fork({ WORKER_INDEX: String(i), SCRAPER_WORKER_CONCURRENCY: '1' });
    }

    cluster.on('exit', (worker, code, signal) => {
      console.warn(`[Scraper Master] Worker PID ${worker.process.pid} exited (${signal || code}). Respawning in 2s...`);
      setTimeout(() => {
        cluster.fork({ SCRAPER_WORKER_CONCURRENCY: '1' });
      }, 2000);
    });

    process.on('SIGTERM', () => {
      console.log('[Scraper Master] SIGTERM received. Terminating worker fleet gracefully...');
      for (const id in cluster.workers) {
        cluster.workers[id]?.kill('SIGTERM');
      }
      process.exit(0);
    });
  } else {
    const workerIndex = process.env.WORKER_INDEX || String(cluster.worker?.id || '1');
    const workerTag = `scraper-${workerIndex}`;
    installSystemLogger(workerTag);

    console.log(`[Scraper Worker #${workerIndex}] Process started (PID: ${process.pid}). Connecting to Mongo & Redis...`);

    mongoose.connect(process.env.MONGODB_URI).then(() => {
      console.log(`[Scraper Worker #${workerIndex}] Connected to MongoDB Atlas.`);
      initScraperWorker(workerIndex);
      console.log(`[Scraper Worker #${workerIndex}] Ready and listening for distributed jobs.`);
    }).catch(err => {
      console.error(`[Scraper Worker #${workerIndex}] DB connection error:`, err.message);
    });
  }
}

if (process.argv[1]?.endsWith('scraperWorker.js')) {
  runStandaloneWorker();
}
