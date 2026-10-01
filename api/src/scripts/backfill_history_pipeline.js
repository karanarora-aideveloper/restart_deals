import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Product from '../db/models/product.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../backend/.env') });

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Global rate-limit pause coordinator across all parallel workers
let globalPauseUntil = 0;

function createSearchQuery(title) {
  if (!title) return '';
  const segment = title.split(/[|–—]/)[0].trim();
  const cleaned = segment
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ').filter((w) => w.length > 1);
  return words.slice(0, 5).join(' ');
}

function computeTokenSimilarity(strA, strB) {
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
 */
function normalizeBuyhatkeIntervals(rawIntervals, currentPrice, originalPrice) {
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

// Atomically claim the next un-backfilled Indian product
async function claimNextProduct() {
  return await Product.findOneAndUpdate(
    {
      country: 'IN',
      $or: [{ lastHistoryBackfillAt: null }, { lastHistoryBackfillAt: { $exists: false } }],
      $expr: { $gte: [{ $strLenCP: { $ifNull: ['$title', ''] } }, 8] },
      'priceHistory.30': { $exists: false },
    },
    {
      $set: {
        lastHistoryBackfillAt: new Date(),
      },
    },
    { new: true, sort: { isTop20: -1, updatedAt: -1 } }
  ).select('_id title productId merchant price originalPrice isTop20 category priceHistory');
}

async function startTurboParallelBackfill() {
  const concurrency = parseInt(process.env.CONCURRENCY || '10', 10);
  const isDryRun = process.argv.includes('--dry-run');

  console.log('================================================================');
  console.log('      SHOPPERSDEALS TURBO PARALLEL PRICE BACKFILL PIPELINE      ');
  console.log('================================================================');
  console.log(`Parallel Workers:   ${concurrency} Concurrent High-Speed HTTP Workers`);
  console.log(`Engine:             Pure Node.js Native HTTP Async I/O (Zero Browser RAM)`);
  console.log(`Scope:              Strictly India (country: 'IN')`);
  console.log(`Dry Run Mode:       ${isDryRun ? 'YES (No DB writes)' : 'NO (Live DB Updates)'}\n`);

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in environment.');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('[DB] Connected to MongoDB Atlas.');

  const totalRemaining = await Product.countDocuments({
    country: 'IN',
    $or: [{ lastHistoryBackfillAt: null }, { lastHistoryBackfillAt: { $exists: false } }],
    'priceHistory.30': { $exists: false },
  });

  console.log(`[DB] Total un-backfilled Indian products remaining: ${totalRemaining}\n`);

  const metrics = {
    totalProcessed: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalFailed: 0,
    workerStats: Array.from({ length: concurrency }, () => ({ processed: 0, updated: 0 })),
    startTime: Date.now(),
  };

  let isStopping = false;
  const gracefulStop = async () => {
    if (isStopping) return;
    isStopping = true;
    console.log('\n[Pipeline] Stopping turbo parallel pipeline gracefully...');
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    console.log('[Pipeline] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', gracefulStop);
  process.on('SIGTERM', gracefulStop);

  // Worker loop function
  const runWorker = async (workerId) => {
    // Stagger worker start slightly so initial requests spread evenly
    await new Promise((r) => setTimeout(r, (workerId - 1) * 200));

    console.log(`[Worker #${workerId}] Initialized. Listening for queue items...`);

    while (!isStopping) {
      // Respect global rate limit pause if any worker encountered HTTP 429
      if (Date.now() < globalPauseUntil) {
        const waitMs = globalPauseUntil - Date.now() + 200;
        await new Promise((r) => setTimeout(r, waitMs));
      }

      let product;
      try {
        product = await claimNextProduct();
      } catch (err) {
        console.error(`[Worker #${workerId}] DB claim error: ${err.message}`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (!product) {
        const remaining = await Product.countDocuments({
          country: 'IN',
          $or: [{ lastHistoryBackfillAt: null }, { lastHistoryBackfillAt: { $exists: false } }],
          'priceHistory.30': { $exists: false },
        });

        if (remaining === 0) {
          console.log(`[Worker #${workerId}] Queue empty. 100% of Indian products completed!`);
          break;
        }

        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      metrics.totalProcessed++;
      metrics.workerStats[workerId - 1].processed++;

      const query = createSearchQuery(product.title);
      const pid = product.productId;
      const merchant = (product.merchant || 'amazon').toLowerCase();

      let matchedDailyCheckpoints = null;

      try {
        const searchUrl = `https://buyhatke.com/search?product=${encodeURIComponent(query)}`;
        const sRes = await fetch(searchUrl, {
          headers: { 'User-Agent': USER_AGENT },
        });

        if (sRes.status === 429) {
          console.warn(`[W${workerId}] ⚠️ Rate limit 429 on search. Pausing cluster for 4s...`);
          globalPauseUntil = Date.now() + 4000;
          await new Promise((r) => setTimeout(r, 4200));
          continue;
        }

        if (sRes.ok) {
          const sHtml = await sRes.text();
          const regex = /<a[^>]*href=["'](\/[^"']*price-in-india-[^"']*)["'][^>]*>([\s\S]*?)<\/a>/g;
          let match;
          const candidates = [];

          while ((match = regex.exec(sHtml)) !== null && candidates.length < 8) {
            const rawHref = match[1];
            const rawText = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const href = 'https://buyhatke.com' + rawHref;

            // Prioritize candidates matching merchant prefix (e.g. /amazon- or /flipkart-)
            const merchantMatch = rawHref.toLowerCase().includes(`/${merchant}-`);
            const pidMatch = pid && rawHref.includes(pid);

            candidates.push({ href, text: rawText, merchantMatch, pidMatch });
          }

          // Sort candidates: PID matches first, then matching merchant, then others
          candidates.sort((a, b) => {
            if (a.pidMatch && !b.pidMatch) return -1;
            if (!a.pidMatch && b.pidMatch) return 1;
            if (a.merchantMatch && !b.merchantMatch) return -1;
            if (!a.merchantMatch && b.merchantMatch) return 1;
            return 0;
          });

          // Check top 3 prioritized candidates
          const inspectCandidates = candidates.slice(0, 3);

          for (let cIdx = 0; cIdx < inspectCandidates.length; cIdx++) {
            const candidate = inspectCandidates[cIdx];
            try {
              const pageRes = await fetch(candidate.href, {
                headers: { 'User-Agent': USER_AGENT },
              });

              if (pageRes.status === 429) {
                console.warn(`[W${workerId}] ⚠️ Rate limit 429 on candidate. Pausing cluster for 4s...`);
                globalPauseUntil = Date.now() + 4000;
                await new Promise((r) => setTimeout(r, 4200));
                break;
              }

              if (!pageRes.ok) continue;
              const html = await pageRes.text();

              const hasPidMatch = pid && (candidate.href.includes(pid) || html.includes(pid));
              const similarity = computeTokenSimilarity(product.title, candidate.text);

              // Strict verification guardrails
              if (hasPidMatch || similarity >= 0.52) {
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
                      const dailyCheckpoints = normalizeBuyhatkeIntervals(
                        rawIntervals,
                        product.price,
                        product.originalPrice
                      );

                      if (dailyCheckpoints.length > 0) {
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
            `[W${workerId}] -> ✅ Verified: [${merchant.toUpperCase()}] "${(product.title || '').substring(0, 32)}..." (${matchedDailyCheckpoints.length} pts: ₹${Math.min(...prices)}-₹${Math.max(...prices)})`
          );

          if (!isDryRun) {
            await Product.updateOne(
              { _id: product._id },
              {
                $set: {
                  priceHistory: matchedDailyCheckpoints,
                  updatedAt: new Date(),
                },
              }
            );
          }
          metrics.totalUpdated++;
          metrics.workerStats[workerId - 1].updated++;
        } else {
          metrics.totalSkipped++;
        }
      } catch (err) {
        metrics.totalFailed++;
      }

      // Gentle jitter pacing per worker: 150ms - 350ms
      const jitterMs = 150 + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, jitterMs));

      // Telemetry log every 50 items across all workers
      if (metrics.totalProcessed % 50 === 0) {
        const elapsedMins = ((Date.now() - metrics.startTime) / 60000).toFixed(1);
        const rate = (metrics.totalProcessed / (elapsedMins || 1)).toFixed(1);
        const remainingNow = Math.max(0, totalRemaining - metrics.totalProcessed);
        const workerBreakdown = metrics.workerStats
          .map((w, idx) => `W${idx + 1}:${w.updated}/${w.processed}`)
          .join(' | ');

        console.log(`\n================================================================`);
        console.log(
          `[Cluster Telemetry] Processed: ${metrics.totalProcessed} | Backfilled: ${metrics.totalUpdated} | Skipped: ${metrics.totalSkipped} | Rate: ${rate} items/min | Elapsed: ${elapsedMins}m | Est. Remaining: ~${(remainingNow / (rate || 1)).toFixed(0)}m`
        );
        console.log(`Worker Breakdown: [${workerBreakdown}]`);
        console.log(`================================================================\n`);
      }
    }
  };

  // Launch all N parallel workers concurrently
  const workerPromises = Array.from({ length: concurrency }, (_, idx) => runWorker(idx + 1));
  await Promise.all(workerPromises);

  await mongoose.disconnect();

  const totalTimeMins = ((Date.now() - metrics.startTime) / 60000).toFixed(1);
  console.log('\n================================================================');
  console.log('       TURBO PARALLEL INDIA BACKFILL PIPELINE CONCLUDED         ');
  console.log('================================================================');
  console.log(`Total Products Processed:  ${metrics.totalProcessed}`);
  console.log(`Successfully Backfilled:   ${metrics.totalUpdated}`);
  console.log(`Skipped / Not on Source:   ${metrics.totalSkipped}`);
  console.log(`Errors:                    ${metrics.totalFailed}`);
  console.log(`Total Elapsed Time:        ${totalTimeMins} minutes\n`);
}

startTurboParallelBackfill().catch((err) => {
  console.error('\nFatal Parallel Pipeline Error:', err);
  process.exit(1);
});
