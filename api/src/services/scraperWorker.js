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
import { checkScrapingAntUsage } from '../utils/scrapingAntUsage.js';

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

    let priceText = $(
      '#apexPriceToPay .a-offscreen, .priceToPay .a-price-whole, .priceToPay .a-offscreen, .priceToPay, .a-price:not(.a-text-price):not(.apex-basisprice-value) .a-price-whole, .a-price:not(.a-text-price):not(.apex-basisprice-value) .a-offscreen, ._30jeq3, .pdp-price strong, ._cDEzb_p13n-sc-price_3mJ9Z'
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

function isChallengeOrBlockedHtml(html) {
  if (!html || html.length < 500) return true;
  const lower = html.toLowerCase();
  return (
    lower.includes('robot check') ||
    lower.includes('type the characters you see in this image') ||
    lower.includes('api-services-support@amazon.com') ||
    lower.includes('checking your browser before accessing') ||
    lower.includes('challenge-running') ||
    lower.includes('cf-browser-verification') ||
    lower.includes('waf-challenge') ||
    lower.includes('access denied') ||
    lower.includes('detected unusual traffic')
  );
}

function isValidHtmlResult(url, html, extracted) {
  if (!html || isChallengeOrBlockedHtml(html)) return false;
  // If it's a search/listing page:
  if (url.includes('/s?') || url.includes('/bestsellers') || url.includes('/search')) {
    return html.includes('data-asin') || html.includes('s-result-item') || html.includes('_1AtVbE');
  }
  // If it's a product detail page:
  return Boolean(extracted && extracted.price != null && extracted.price > 0);
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
  const MAX_FAILOVER_ATTEMPTS = 5;
  const excludedTokens = new Set();

  const isUs = url.includes('amazon.com') || url.includes('.us');
  const countryParam = isUs ? '&proxy_country=US' : '&proxy_country=IN';
  const proxyType = url.includes('amazon.in') ? 'datacenter' : 'residential';

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FAILOVER_ATTEMPTS; attempt++) {
    const now = new Date();

    // Atomically claim the least-recently-used active token that is not in cooldown,
    // not currently leased by another parallel request, and not already excluded in this job.
    const leased = await ScrapingAntToken.findOneAndUpdate(
      {
        status: 'active',
        token: { $nin: Array.from(excludedTokens) },
        $and: [
          {
            $or: [
              { cooldownUntil: { $exists: false } },
              { cooldownUntil: null },
              { cooldownUntil: { $lte: now } }
            ]
          },
          {
            $or: [
              { leasedUntil: { $exists: false } },
              { leasedUntil: null },
              { leasedUntil: { $lte: now } }
            ]
          }
        ]
      },
      { $set: { lastUsedAt: now, leasedUntil: new Date(Date.now() + 25000) } },
      { sort: { lastUsedAt: 1 }, new: true }
    ).lean();

    if (!leased) {
      console.warn(`[ScraperWorker Warning] No active ScrapingAnt tokens available on attempt ${attempt}/${MAX_FAILOVER_ATTEMPTS}! Triggering auto-replenishment...`);
      triggerTokenReplenishmentIfLow().catch(err => {
        console.warn('[ScraperWorker] Failed to trigger token replenishment:', err.message);
      });
      break;
    }

    const token = leased.token;
    excludedTokens.add(token);

    const fastApiUrl = `https://api.scrapingant.com/v2/general?x-api-key=${token}&url=${encodeURIComponent(url)}&browser=false&proxy_type=${proxyType}${countryParam}`;

    // TIER 1: Fast Raw HTML Request (1 API credit, ~1-3s response)
    // Most Amazon India PDPs & search listing pages return full price and metadata in raw HTML.
    try {
      const fastStartTime = Date.now();
      const fastRes = await fetch(fastApiUrl, { signal: AbortSignal.timeout(15000) });
      const fastDurationMs = Date.now() - fastStartTime;

      if (fastRes.ok) {
        const html = await fastRes.text();
        const extracted = extractBasicMetadata(html);

        if (isValidHtmlResult(url, html, extracted)) {
          await ScrapingAntToken.updateOne({ token }, { lastUsedAt: new Date(), $inc: { usageCount: 1 }, $set: { leasedUntil: null } }).catch(() => {});
          await recordScrapingLog({
            url,
            source,
            tokenUsed: token,
            status: 'success_fast_tier',
            statusCode: 200,
            durationMs: fastDurationMs,
            extractedData: extracted,
          });
          console.log(`[ScraperWorker] ⚡ Fast Tier Success in ${fastDurationMs}ms (1 credit): "${extracted.title?.slice(0, 40) || url.slice(0, 40)}" (₹${extracted.price || 0})`);
          const htmlGzip = zlib.gzipSync(Buffer.from(html, 'utf-8')).toString('base64');
          return { htmlGzip, extractedData: extracted, durationMs: Date.now() - startTime };
        } else {
          console.log(`[ScraperWorker] Fast Tier HTML did not contain valid price/listing for ${url.slice(0, 45)}. Escalating to Headless Browser Tier...`);
        }
      } else if (fastRes.status === 403) {
        console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... received HTTP 403 on fast tier. Rotating token...`);
        await recordScrapingLog({
          url,
          source,
          tokenUsed: token,
          status: '403_exhausted',
          statusCode: 403,
          durationMs: fastDurationMs,
          errorMessage: 'Token quota exhausted or invalid (403)',
        });
        checkScrapingAntUsage(token).then(async (usage) => {
          if (!usage.valid) {
            await ScrapingAntToken.deleteOne({ token }).catch(() => {});
          } else {
            await ScrapingAntToken.updateOne(
              { token },
              {
                status: 'parked',
                remainedCredits: 0,
                planName: usage.planName,
                planTotalCredits: usage.planTotalCredits,
                renewalDate: usage.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastCheckedAt: new Date(),
                exhaustedAt: new Date()
              }
            ).catch(() => {});
          }
        }).catch(() => {});
        triggerTokenReplenishmentIfLow().catch(() => {});
        lastError = new Error(`ScrapingAnt token ${token.slice(0, 8)}... exhausted (403)`);
        continue;
      } else if (fastRes.status === 429) {
        console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... hit 429 rate limit on fast tier.`);
        await ScrapingAntToken.updateOne({ token }, { $set: { cooldownUntil: new Date(Date.now() + 60_000) } }).catch(() => {});
        await recordScrapingLog({
          url,
          source,
          tokenUsed: token,
          status: '429_rate_limit',
          statusCode: 429,
          durationMs: fastDurationMs,
          errorMessage: 'ScrapingAnt rate limit (429) - 60s cooldown applied',
        });
        lastError = new Error('ScrapingAnt rate limit (429)');
        continue;
      }
    } catch (fastErr) {
      console.log(`[ScraperWorker] Fast Tier attempt skipped/timed out (${fastErr.message}). Escalating to Headless Browser Tier...`);
    }

    // TIER 2: Full Headless Browser with Anti-Detect (10 credits, 30-70s)
    // Used when fast tier encounters JS rendering requirement or anti-bot challenge.
    const apiUrl = `https://api.scrapingant.com/v2/general?x-api-key=${token}&url=${encodeURIComponent(url)}&browser=true&proxy_type=${proxyType}${countryParam}`;

    let response = null;
    let durationMs = 0;
    const attemptStartTime = Date.now();

    try {
      response = await fetch(apiUrl, { signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS) });
      durationMs = Date.now() - attemptStartTime;
    } catch (fetchErr) {
      durationMs = Date.now() - attemptStartTime;
      console.warn(`[ScraperWorker Timeout/Error] Attempt ${attempt} on ${url.slice(0, 45)} with token ${token.slice(0, 8)}...: ${fetchErr.message}`);
      await recordScrapingLog({
        url,
        source,
        tokenUsed: token,
        status: 'error',
        statusCode: 500,
        durationMs,
        errorMessage: fetchErr.message,
      });
      lastError = new Error(`Timeout/network error: ${fetchErr.message}`);
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 409 Concurrency limit: another request is using this account's browser slot
    if (response.status === 409) {
      console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... hit 409 concurrency limit. Rotating to next token (attempt ${attempt}/${MAX_FAILOVER_ATTEMPTS})...`);
      await recordScrapingLog({
        url,
        source,
        tokenUsed: token,
        status: '409_concurrency',
        statusCode: 409,
        durationMs,
        errorMessage: 'Concurrency limit (409)',
      });
      lastError = new Error('ScrapingAnt 409 concurrency limit');
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    // 429 Rate limit: too many requests per second for this key
    if (response.status === 429) {
      console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... hit 429 rate limit. Setting 60s cooldown and rotating to next token (attempt ${attempt}/${MAX_FAILOVER_ATTEMPTS})...`);
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
      lastError = new Error('ScrapingAnt rate limit (429)');
      continue;
    }

    // 403 Forbidden / Quota Exhausted: Token ran out of credits or key revoked
    if (response.status === 403) {
      console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... received HTTP 403 (quota exhausted or invalid). Checking token status...`);
      await recordScrapingLog({
        url,
        source,
        tokenUsed: token,
        status: '403_exhausted',
        statusCode: 403,
        durationMs,
        errorMessage: 'Token quota exhausted or invalid (403)',
      });

      checkScrapingAntUsage(token).then(async (usage) => {
        if (!usage.valid) {
          console.warn(`[ScraperWorker] Token ${token.slice(0, 8)}... is dead/invalid (${usage.error}). Deleting from DB.`);
          await ScrapingAntToken.deleteOne({ token }).catch(() => {});
        } else {
          console.log(`[ScraperWorker] Token ${token.slice(0, 8)}... exhausted (0 credits). Parking until renewal date: ${usage.renewalDate?.toISOString() || '30 days'}`);
          await ScrapingAntToken.updateOne(
            { token },
            {
              status: 'parked',
              remainedCredits: 0,
              planName: usage.planName,
              planTotalCredits: usage.planTotalCredits,
              renewalDate: usage.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              lastCheckedAt: new Date(),
              exhaustedAt: new Date()
            }
          ).catch(() => {});
        }
      }).catch(() => {});

      triggerTokenReplenishmentIfLow().catch(err => {
        console.warn('[ScraperWorker] Failed to trigger token replenishment:', err.message);
      });

      console.log(`[ScraperWorker] 🔄 Seamlessly rotating to next active token without failing job (attempt ${attempt}/${MAX_FAILOVER_ATTEMPTS})...`);
      lastError = new Error(`ScrapingAnt token ${token.slice(0, 8)}... exhausted (403)`);
      continue;
    }

    // 423 Anti-scraping protection
    if (response.status === 423) {
      console.warn(`[ScraperWorker] ScrapingAnt 423 (Anti-scraping protection) on ${url.slice(0, 45)} with token ${token.slice(0, 8)}...`);
      await recordScrapingLog({
        url,
        source,
        tokenUsed: token,
        status: 'error',
        statusCode: 423,
        durationMs,
        errorMessage: 'ScrapingAnt HTTP 423 (Anti-scraping protection)',
      });
      if (attempt < 2) {
        continue;
      }
      return null;
    }

    // 200 OK: Successful Scrape!
    if (response.ok) {
      const html = await response.text();
      await ScrapingAntToken.updateOne({ token }, { lastUsedAt: new Date(), $inc: { usageCount: 1 }, $set: { leasedUntil: null } }).catch(() => {});

      const extracted = extractBasicMetadata(html);
      await recordScrapingLog({
        url,
        source,
        tokenUsed: token,
        status: 'success_headless_tier',
        statusCode: 200,
        durationMs,
        extractedData: extracted,
      });

      const htmlGzip = zlib.gzipSync(Buffer.from(html, 'utf-8')).toString('base64');
      return { htmlGzip, extractedData: extracted, durationMs: Date.now() - startTime };
    }

    // Other HTTP error (e.g. 500, 502, 504 from gateway)
    console.warn(`[ScraperWorker] HTTP ${response.status} from ScrapingAnt on ${url.slice(0, 45)} with token ${token.slice(0, 8)}...`);
    await recordScrapingLog({
      url,
      source,
      tokenUsed: token,
      status: 'error',
      statusCode: response.status,
      durationMs,
      errorMessage: `ScrapingAnt HTTP ${response.status}`,
    });
    lastError = new Error(`ScrapingAnt HTTP ${response.status}`);
    continue;
  }

  // All failover attempts exhausted or pool empty
  throw (lastError || new Error(`No active ScrapingAnt tokens available after ${MAX_FAILOVER_ATTEMPTS} attempts for ${url}`));
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

      // Register heartbeat in Redis every 30 seconds
      const registerHeartbeat = async () => {
        try {
          const { defaultRedis } = await import('../utils/redis.js');
          if (defaultRedis) {
            await defaultRedis.set(
              `worker:heartbeat:${workerTag}`,
              JSON.stringify({
                name: workerTag,
                workerIndex,
                platform: 'railway',
                pid: process.pid,
                lastSeen: Date.now(),
              }),
              'EX',
              180
            );
          }
        } catch (e) {}
      };
      registerHeartbeat();
      setInterval(registerHeartbeat, 30000);
    }).catch(err => {
      console.error(`[Scraper Worker #${workerIndex}] DB connection error:`, err.message);
    });
  }
}

if (process.argv[1]?.endsWith('scraperWorker.js')) {
  runStandaloneWorker();
}
