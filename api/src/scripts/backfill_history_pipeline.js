import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

let globalPauseUntil = 0;

/**
 * Strips promotional prefixes, deal badges, emojis, and parenthesized specs
 * to extract the 5-6 core keyword tokens for search.
 */
export function createSearchQuery(title) {
  if (!title) return '';
  let cleaned = title
    // Strip promotional deal prefixes like "64% off : ", "Flat 50% Off - ", "Loot: ", "Deal: "
    .replace(/^[\s\d%]+off\s*[:\-|–]?\s*/i, '')
    .replace(
      /^(?:loot|deal|hot|steal|mega\s*offer|offer\s*zone|today(?:'s)?\s*deal|lightning\s*deal)\s*(?:deal|price)?\s*[:\-|–]?\s*/i,
      ''
    )
    // Strip emojis
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Take segment before major separator (| – —)
    .split(/[|–—]/)[0]
    // Strip parenthesized specifications like (Peach), (Pack of 2)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 6).join(' ');
}

/**
 * Computes the Overlap / Containment Coefficient:
 * |TokensA ∩ TokensB| / min(|TokensA|, |TokensB|)
 * Excellent for e-commerce where titles vary in verbosity.
 */
export function computeContainment(strA, strB) {
  if (!strA || !strB) return 0;
  const tokenize = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const tokensA = tokenize(strA);
  const tokensB = tokenize(strB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  return intersection / Math.min(tokensA.size, tokensB.size);
}

/**
 * Computes standard Jaccard Token Similarity (|A ∩ B| / |A ∪ B|)
 */
export function computeTokenSimilarity(strA, strB) {
  if (!strA || !strB) return 0;
  const tokenize = (s) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const tokensA = tokenize(strA);
  const tokensB = tokenize(strB);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Normalizes raw intervals from Buyhatke into rolling 365 daily checkpoints,
 * properly respecting product-specific prices rather than hardcoded fallbacks.
 * (AGENTS.md Decision #12)
 */
export function normalizeBuyhatkeIntervals(rawIntervals, currentPrice, originalPrice) {
  if (!rawIntervals || rawIntervals.length === 0) return [];

  const defaultPrice = currentPrice || originalPrice || 999;
  const defaultOriginal = originalPrice || currentPrice || defaultPrice;

  const intervals = rawIntervals
    .map((h) => ({
      from: new Date(h.from.replace(' ', 'T') + 'Z'),
      to: new Date(h.to.replace(' ', 'T') + 'Z'),
      price: Math.round(Number(h.price)),
    }))
    .filter((h) => !isNaN(h.from.getTime()) && !isNaN(h.price) && h.price > 0)
    .sort((a, b) => a.from - b.from);

  if (intervals.length === 0) return [];

  const startDate = new Date(intervals[0].from);
  startDate.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const checkpoints = [];
  let curr = new Date(startDate);
  let lastKnownPrice = intervals[0].price;

  while (curr <= today) {
    const dateStr = curr.toISOString().split('T')[0];

    const match = intervals.find((inv) => inv.from <= curr && inv.to >= curr);
    if (match) {
      lastKnownPrice = match.price;
    } else {
      const past = intervals.filter((inv) => inv.to < curr);
      if (past.length > 0) {
        lastKnownPrice = past[past.length - 1].price;
      }
    }

    // Sanity range check (₹1 to ₹10,00,000)
    const validPrice = lastKnownPrice > 0 && lastKnownPrice < 1000000 ? lastKnownPrice : defaultPrice;

    checkpoints.push({
      date: dateStr,
      price: validPrice,
      originalPrice: defaultOriginal,
      timestamp: new Date(dateStr + 'T12:00:00Z'),
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  // Ensure today's live price is accurately reflected on the final checkpoint
  if (currentPrice && checkpoints.length > 0) {
    const todayStr = today.toISOString().split('T')[0];
    const last = checkpoints[checkpoints.length - 1];
    if (last && last.date === todayStr) {
      last.price = currentPrice;
    } else {
      checkpoints.push({
        date: todayStr,
        price: currentPrice,
        originalPrice: defaultOriginal,
        timestamp: new Date(),
      });
    }
  }

  // Cap to 365-day rolling window if exceeds 365 days (AGENTS.md Decision #12)
  if (checkpoints.length > 365) {
    return checkpoints.slice(-365);
  }

  return checkpoints;
}

/**
 * Atomically claims the next un-backfilled Indian product.
 * Safe for multi-process parallel execution across independent scripts.
 */
export async function claimNextProduct() {
  return await Product.findOneAndUpdate(
    {
      country: { $in: ['IN', 'in'] },
      'priceHistory.89': { $exists: false },
      $or: [
        { lastBuyhatkeSyncAt: null },
        { lastBuyhatkeSyncAt: { $exists: false } },
        { lastBuyhatkeSyncAt: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) } },
      ],
      $expr: { $gte: [{ $strLenCP: { $ifNull: ['$title', ''] } }, 6] },
    },
    {
      $set: {
        lastBuyhatkeSyncAt: new Date(),
      },
    },
    { new: true, sort: { isTop20: -1, updatedAt: -1 } }
  ).select('_id title productId merchant price originalPrice isTop20 category priceHistory');
}

/**
 * Core processing loop for one worker instance
 */
export async function runBackfillWorker(workerTag = 'Worker-1') {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(`[${workerTag}] Initialized and listening for un-backfilled products...`);

  const metrics = {
    processed: 0,
    backfilled: 0,
    skipped: 0,
    failed: 0,
    startTime: Date.now(),
  };

  while (true) {
    if (Date.now() < globalPauseUntil) {
      const waitMs = globalPauseUntil - Date.now() + 200;
      await new Promise((r) => setTimeout(r, waitMs));
    }

    let product;
    try {
      product = await claimNextProduct();
    } catch (err) {
      console.error(`[${workerTag}] DB claim error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    if (!product) {
      const remaining = await Product.countDocuments({
        country: { $in: ['IN', 'in'] },
        'priceHistory.89': { $exists: false },
        $or: [
          { lastBuyhatkeSyncAt: null },
          { lastBuyhatkeSyncAt: { $exists: false } },
        ],
      });

      if (remaining === 0) {
        console.log(`[${workerTag}] 🎉 Queue empty. All Indian products processed!`);
        break;
      }

      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    metrics.processed++;
    const query = createSearchQuery(product.title);
    const pid = product.productId;
    const merchant = (product.merchant || 'amazon').toLowerCase();

    let matchedDailyCheckpoints = null;

    try {
      const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;
      let sRes = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (sRes.status === 429) {
        console.warn(`[${workerTag}] ⚠️ HTTP 429 on search. Backing off 5s...`);
        globalPauseUntil = Date.now() + 5000;
        await new Promise((r) => setTimeout(r, 5200));
        sRes = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
      }

      if (sRes.ok) {
        const sHtml = await sRes.text();
        const regex =
          /href=["'](\/(?:amazon|flipkart|myntra|ajio|tatacliq|nykaa|croma|meesho)-[^"']*price-in-india-[^"']*)["']/g;
        let m;
        const candidates = [];
        const seen = new Set();

        while ((m = regex.exec(sHtml)) !== null) {
          const rawHref = m[1];
          if (seen.has(rawHref)) continue;
          seen.add(rawHref);

          const slugText = rawHref
            .replace(/^\/(?:amazon|flipkart|myntra|ajio|tatacliq|nykaa|croma|meesho)-/, '')
            .replace(/-price-in-india-.*$/, '')
            .replace(/-/g, ' ')
            .trim();

          const pidMatch = pid && rawHref.includes(pid);
          const merchantMatch = rawHref.toLowerCase().includes(`/${merchant}-`);

          candidates.push({
            href: 'https://buyhatke.com' + rawHref,
            slugText,
            pidMatch,
            merchantMatch,
          });
        }

        // Sort candidates: PID matches first, matching store first
        candidates.sort((a, b) => {
          if (a.pidMatch && !b.pidMatch) return -1;
          if (!a.pidMatch && b.pidMatch) return 1;
          if (a.merchantMatch && !b.merchantMatch) return -1;
          if (!a.merchantMatch && b.merchantMatch) return 1;
          return 0;
        });

        const inspectCandidates = candidates.slice(0, 4);

        for (const candidate of inspectCandidates) {
          const containment = computeContainment(product.title, candidate.slugText);
          const similarity = computeTokenSimilarity(product.title, candidate.slugText);

          // Fast rejection if completely unrelated
          if (!candidate.pidMatch && containment < 0.40) {
            continue;
          }

          try {
            let pageRes = await fetch(candidate.href, {
              headers: { 'User-Agent': USER_AGENT },
            });

            if (pageRes.status === 429) {
              console.warn(`[${workerTag}] ⚠️ HTTP 429 on candidate. Backing off 5s...`);
              globalPauseUntil = Date.now() + 5000;
              await new Promise((r) => setTimeout(r, 5200));
              pageRes = await fetch(candidate.href, { headers: { 'User-Agent': USER_AGENT } });
            }

            if (!pageRes.ok) continue;
            const html = await pageRes.text();

            const hasPidMatch =
              candidate.pidMatch || (pid && (candidate.href.includes(pid) || html.includes(pid)));

            if (hasPidMatch || containment >= 0.45 || (containment >= 0.40 && similarity >= 0.25)) {
              const histStart = html.indexOf('history:[');
              if (histStart !== -1) {
                const arrayStart = histStart + 8;
                let depth = 0;
                let arrayEnd = -1;

                for (let i = arrayStart; i < html.length; i++) {
                  if (html[i] === '[') depth++;
                  else if (html[i] === ']') {
                    depth--;
                    if (depth === 0) {
                      arrayEnd = i;
                      break;
                    }
                  }
                }

                if (arrayEnd !== -1) {
                  const historyCode = html.substring(arrayStart, arrayEnd + 1);
                  // eslint-disable-next-line no-eval
                  const rawIntervals = eval(historyCode);

                  if (Array.isArray(rawIntervals) && rawIntervals.length > 0) {
                    // Price sanity check: make sure latest candidate price is not 4x or 0.25x off
                    if (product.price && product.price > 0) {
                      const latestRawPrice = Number(rawIntervals[rawIntervals.length - 1].price);
                      if (
                        latestRawPrice > 0 &&
                        (latestRawPrice < product.price * 0.25 || latestRawPrice > product.price * 4.0)
                      ) {
                        // Price mismatch (likely variant / different item)
                        continue;
                      }
                    }

                    const dailyCheckpoints = normalizeBuyhatkeIntervals(
                      rawIntervals,
                      product.price,
                      product.originalPrice
                    );

                    // Ensure minimum quality of backfilled history (at least 60 daily points)
                    if (dailyCheckpoints.length >= 60) {
                      matchedDailyCheckpoints = dailyCheckpoints;
                      break;
                    }
                  }
                }
              }
            }
          } catch {
            // ignore single candidate fetch error
          }
        }
      }

      if (matchedDailyCheckpoints) {
        const prices = matchedDailyCheckpoints.map((d) => d.price);
        console.log(
          `[${workerTag}] ✅ [${merchant.toUpperCase()}] "${(product.title || '').substring(0, 34)}..." -> ${matchedDailyCheckpoints.length} pts (₹${Math.min(...prices)} - ₹${Math.max(...prices)})`
        );

        if (!isDryRun) {
          await Product.updateOne(
            { _id: product._id },
            {
              $set: {
                priceHistory: matchedDailyCheckpoints,
                lastBuyhatkeSyncAt: new Date(),
                lastHistoryBackfillAt: new Date(),
                updatedAt: new Date(),
              },
            }
          );
        }
        metrics.backfilled++;
      } else {
        metrics.skipped++;
      }
    } catch (err) {
      metrics.failed++;
    }

    // Gentle pacing per worker
    await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 200)));

    if (metrics.processed % 25 === 0) {
      const elapsedMins = ((Date.now() - metrics.startTime) / 60000).toFixed(1);
      const rate = (metrics.processed / (elapsedMins || 1)).toFixed(1);
      console.log(
        `[${workerTag}] Telemetry: ${metrics.processed} processed | ${metrics.backfilled} backfilled | ${metrics.skipped} skipped | ${rate} items/min`
      );
    }
  }

  const totalMins = ((Date.now() - metrics.startTime) / 60000).toFixed(1);
  console.log(`\n[${workerTag}] Concluded: ${metrics.processed} processed, ${metrics.backfilled} backfilled in ${totalMins}m.`);
}

async function main() {
  const argWorkerId = process.argv.find((a) => a.startsWith('--workerId='))?.split('=')[1] || 'Worker-1';

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`[${argWorkerId}] Connected to MongoDB Atlas.`);

  await runBackfillWorker(argWorkerId);
  await mongoose.disconnect();
}

import { fileURLToPath } from 'url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Fatal Worker Error:', err);
    process.exit(1);
  });
}
