import { Worker } from 'bullmq';
import * as cheerio from 'cheerio';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { createRedisConnection } from '../utils/redis.js';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import ScrapingLog from '../db/models/scrapingLog.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

function detectMerchant(url) {
  if (!url) return 'unknown';
  if (url.includes('amazon.')) return 'amazon';
  if (url.includes('flipkart.')) return 'flipkart';
  if (url.includes('myntra.')) return 'myntra';
  if (url.includes('nykaa.')) return 'nykaa';
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

  const tokenRecord = activeTokens[0];
  const token = tokenRecord.token;

  const isUs = url.includes('amazon.com') || url.includes('.us');
  const countryParam = isUs ? '&country=US' : '&country=IN';
  const apiUrl = `https://api.scrapingant.com/v2/general?x-api-key=${token}&url=${encodeURIComponent(url)}&browser=true${countryParam}`;

  let response = null;
  let durationMs = 0;

  try {
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
    durationMs = Date.now() - startTime;

    if (response.status === 409) {
      console.warn(`[ScraperWorker] ScrapingAnt 409 concurrency on ${url.slice(0, 45)}. Waiting 8s for cloud slot release...`);
      await new Promise(r => setTimeout(r, 8000));
      // Single retry after 8s cooldown
      response = await fetch(apiUrl, { signal: AbortSignal.timeout(30000) });
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

    return { html, extractedData: extracted, durationMs };
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
    console.error(`[Scraper Worker] ✕ Job #${job?.id} Failed:`, err.message);
  });

  return workerInstance;
}

// Support running as standalone process: `node src/services/scraperWorker.js`
if (process.argv[1]?.endsWith('scraperWorker.js')) {
  console.log('==================================================');
  console.log('    STANDALONE DISTRIBUTED SCRAPER WORKER SERVICE ');
  console.log('==================================================\n');

  mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('[DB] Connected to MongoDB Atlas.');
    initScraperWorker();
    console.log('[Scraper Worker] Ready and listening for distributed jobs across all machines.');
  });
}
