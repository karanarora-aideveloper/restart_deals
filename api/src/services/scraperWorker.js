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
 */
export async function executeScrapingAntJob(url, source = 'other') {
  const startTime = Date.now();
  const activeTokens = await ScrapingAntToken.find({ status: 'active' }).sort({ lastUsedAt: 1 }).lean();

  if (!activeTokens || activeTokens.length === 0) {
    console.warn('[ScraperWorker Warning] No active ScrapingAnt tokens found.');
    await recordScrapingLog({
      url,
      source,
      status: 'error',
      statusCode: 503,
      durationMs: Date.now() - startTime,
      errorMessage: 'No active ScrapingAnt tokens in database',
    });
    return null;
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

  // Lease the least-recently-used token and stamp it immediately. Stamping on lease
  // (rather than only on success) is what makes rotation work: a token left holding a
  // hung remote browser drops to the back of the queue instead of being re-picked.
  let token = activeTokens[0].token;
  await ScrapingAntToken.updateOne({ token }, { lastUsedAt: new Date() }).catch(() => {});

  let response = null;
  let durationMs = 0;

  try {
    response = await fetch(buildApiUrl(token), { signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS) });
    durationMs = Date.now() - startTime;

    if (response.status === 409) {
      // The slot is held by a still-running remote browser, so retrying the same token
      // just 409s again. Rotate to a different active token instead.
      const nextToken = activeTokens.find(t => t.token !== token)?.token;
      if (nextToken) {
        console.warn(`[ScraperWorker] ScrapingAnt 409 on ${url.slice(0, 45)}. Rotating to next token...`);
        token = nextToken;
        await ScrapingAntToken.updateOne({ token }, { lastUsedAt: new Date() }).catch(() => {});
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
    return null;
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
    return null;
  }

  if (response.status === 403 || response.status === 429) {
    console.error(`[ScraperWorker] Token ${token.slice(0, 8)}... quota exhausted (${response.status}).`);
    await ScrapingAntToken.updateOne({ token }, { status: 'exhausted', exhaustedAt: new Date() }).catch(() => {});
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: '403_exhausted',
      statusCode: response.status,
      durationMs,
      errorMessage: `Token quota exhausted (${response.status})`,
    });
    return null;
  }

  if (response.status === 423) {
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
export function initScraperWorker() {
  if (workerInstance) return workerInstance;

  console.log('[Scraper Worker] Initializing BullMQ Worker for "scraper-queue"...');
  const redisConnection = createRedisConnection();

  workerInstance = new Worker(
    'scraper-queue',
    async (job) => {
      const { url, source } = job.data;
      console.log(`[Scraper Worker] Processing Job #${job.id} [Priority ${job.opts.priority || 3}]: ${url.slice(0, 50)}...`);
      const result = await executeScrapingAntJob(url, source);
      return result;
    },
    {
      connection: redisConnection,
      concurrency: 1, // Strict Single-Flight Concurrency = 1
      limiter: {
        max: 1,
        duration: 2500, // Enforce 2.5s global delay between jobs
      },
    }
  );

  workerInstance.on('completed', (job, returnvalue) => {
    console.log(`[Scraper Worker] ✓ Job #${job.id} Completed in ${returnvalue?.durationMs || 0}ms`);
  });

  workerInstance.on('failed', (job, err) => {
    // Job data/url so the admin panel's per-worker log view actually shows WHAT failed,
    // not just an opaque job id — the previous version left "what's failing" unanswerable
    // without cross-referencing BullMQ directly.
    const urlHint = job?.data?.url ? job.data.url.slice(0, 60) : 'unknown url';
    console.error(`[Scraper Worker] ✕ Job #${job?.id} Failed (${urlHint}):`, err.message);
  });

  return workerInstance;
}

// Support running as standalone process: `node src/services/scraperWorker.js`
//
// This is deployed as its own Render service (independent of the api web
// service) so scraping throughput can scale horizontally — each instance
// pulls from the same BullMQ queue with its own 1-job/2.5s self-throttle,
// so N instances = N times the aggregate scraping throughput, without any
// single instance exceeding ScrapingAnt's per-request pacing.
//
// Render's web-service health check requires binding to $PORT, even though
// this process is really a queue consumer with nothing to serve — a tiny
// HTTP server that always answers 200 satisfies that without pulling in a
// full framework dependency just for a health check.
if (process.argv[1]?.endsWith('scraperWorker.js')) {
  // Each of the 5 scraper-N Render services runs this exact same file — tagging by
  // RENDER_SERVICE_NAME (set automatically by Render on every service) instead of a
  // fixed 'api' source is what lets the admin panel's live logs show which specific
  // worker a job failed on, not just an undifferentiated merged stream.
  installSystemLogger(process.env.RENDER_SERVICE_NAME || 'scraper-unknown');

  console.log('==================================================');
  console.log('    STANDALONE DISTRIBUTED SCRAPER WORKER SERVICE ');
  console.log('==================================================\n');

  const port = process.env.PORT || 10000;
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('scraper worker: ok');
  }).listen(port, () => {
    console.log(`[Scraper Worker] Health check server listening on port ${port}`);
  });

  mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('[DB] Connected to MongoDB Atlas.');
    initScraperWorker();
    console.log('[Scraper Worker] Ready and listening for distributed jobs across all machines.');
  });
}
