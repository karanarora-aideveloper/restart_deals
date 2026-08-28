import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/db/connection.js';
import Product from '../src/db/models/product.js';

// One-time backfill: pull historical price data for our existing products from
// pricebefore.com (a third-party Amazon/Flipkart price tracker) and merge it into
// each Product's `priceHistory` array. Never touches current price/originalPrice/MRP —
// those reflect our own live-verified state; this only adds historical data points.
//
// Site chosen after checking robots.txt: no Claude/AI-bot disallow, and the search flow
// used here (GET /search/?q=<product link>, which 302-redirects straight to the matching
// product page) is the site's own advertised "paste a product link" feature — not a bulk
// crawl of disallowed paths. /api/ and repeated /search/ index-crawling are avoided.
//
// Usage:
//   node scripts/backfillPriceHistory.js               # full catalog
//   node scripts/backfillPriceHistory.js --limit=20     # test batch

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const RATE_LIMIT_MS = 1200; // pace between products — be a polite scraper, not a hammer

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extracts the `var data = {...}` Chart.js payload embedded directly in a pricebefore.com
// product page — no separate API call needed, this ships in the plain HTML.
function extractChartData(html) {
  const marker = 'var data = ';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  let depth = 0;
  let i = start;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  try {
    return JSON.parse(html.slice(start, i));
  } catch {
    return null;
  }
}

// "18 Nov 2023" -> Date. Their format, not ISO.
function parsePbDate(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Merge into our existing priceHistory, skipping any day we already have a point for (our
// own points come from live scraping/AI-parsing and are authoritative for days they cover).
// No per-point MRP is available from this source (lowestPrices/highestPrices there are
// running all-time stats, not a per-day MRP), so originalPrice stays null on backfilled points.
function mergePriceHistory(existing, dates, prices) {
  const existingDays = new Set((existing || []).map((p) => new Date(p.timestamp).toISOString().slice(0, 10)));
  const merged = [...(existing || [])];
  for (let i = 0; i < dates.length; i++) {
    const price = prices[i];
    const date = parsePbDate(dates[i]);
    if (price == null || !date) continue;
    const day = date.toISOString().slice(0, 10);
    if (existingDays.has(day)) continue;
    existingDays.add(day);
    merged.push({ price, originalPrice: null, timestamp: date });
  }
  merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return merged;
}

async function backfillOne(product) {
  try {
    const searchUrl = `https://www.pricebefore.com/search/?q=${encodeURIComponent(product.cleanUrl)}`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
    const html = await res.text();

    if (html.includes('did not match any product')) {
      return { status: 'not_found' };
    }

    const data = extractChartData(html);
    if (!data || !Array.isArray(data.dates) || !Array.isArray(data.prices) || data.dates.length === 0) {
      return { status: 'no_history' };
    }

    const merged = mergePriceHistory(product.priceHistory, data.dates, data.prices);
    const added = merged.length - (product.priceHistory || []).length;
    await Product.updateOne({ _id: product._id }, { $set: { priceHistory: merged } });
    return { status: 'ok', added, total: merged.length };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  await connectDB();

  const query = Product.find({}).sort({ lastChecked: -1 });
  if (limit) query.limit(limit);
  const products = await query.lean();

  console.log(`[Backfill] Processing ${products.length} product(s)${limit ? ' (test batch)' : ''} via pricebefore.com...\n`);

  const counts = { ok: 0, not_found: 0, no_history: 0, error: 0 };
  let totalAdded = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const result = await backfillOne(p);
    counts[result.status] = (counts[result.status] || 0) + 1;
    if (result.status === 'ok') totalAdded += result.added;

    const extra = result.status === 'ok'
      ? ` (+${result.added} new points, ${result.total} total)`
      : result.error ? ` (${result.error})` : '';
    console.log(`[${i + 1}/${products.length}] ${p.productId} — ${p.title?.slice(0, 50) || ''} -> ${result.status}${extra}`);

    if (i < products.length - 1) await sleep(RATE_LIMIT_MS);
  }

  console.log('\n=== Summary ===');
  console.log(counts);
  console.log('Total price points added:', totalAdded);

  await disconnectDB();
  await mongoose.disconnect().catch(() => {});
}

main().catch((err) => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
