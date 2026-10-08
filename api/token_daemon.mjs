// Autonomous Local ScrapingAnt Token Daemon
//
// Role:
// Continuously monitors the active ScrapingAnt token pool in MongoDB Atlas.
// Whenever the active token count drops below MIN_ACTIVE_TOKENS (default 5),
// it autonomously generates fresh tokens on this Mac (using SmailPro + 2Captcha)
// and updates the database, guaranteeing the scraper workers on Railway never stall.
//
// Usage:
//   node token_daemon.mjs          # Runs as persistent background loop (every 3 minutes)
//   node token_daemon.mjs --once   # Runs a single check & replenish, then exits

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { runBatchAutomation, getAutomationStatus } from './src/scripts/scrapingAntAutomation.js';
import ScrapingAntToken from './src/db/models/scrapingAntToken.js';
import { checkScrapingAntUsage } from './src/utils/scrapingAntUsage.js';

// Load environment variables from available .env files
const loadEnvFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...vals] = trimmed.split('=');
          if (key && vals.length > 0 && !process.env[key.trim()]) {
            process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch {}
};

loadEnvFile('../admin/.env.local');
loadEnvFile('../backend/.env');
loadEnvFile('./.env');

const MIN_ACTIVE_TOKENS = parseInt(process.env.MIN_ACTIVE_TOKENS, 10) || 6;
const TARGET_POOL_SIZE = parseInt(process.env.TARGET_POOL_SIZE, 10) || 10;
const MAX_BATCH_PER_RUN = 4;
const CHECK_INTERVAL_MS = (parseInt(process.env.CHECK_INTERVAL_MINUTES, 10) || 3) * 60 * 1000;

const ADMIN_API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || process.env.ADMIN_API_KEY || '8b76afd81ae2753addf182faf01315b196cb5934fe1d81e4ac625776fc00edde';
const API_BASE = process.env.API_BASE || 'https://api.shoppersdeals.in';
const MONGODB_URI = process.env.MONGODB_URI;
const TWOCAPTCHA_API_KEY = process.env.TWOCAPTCHA_API_KEY || '00f69cd4eefad8d5ccfe712289733973';

const isRunOnce = process.argv.includes('--once');
const isHeaded = process.argv.includes('--headed') || process.env.HEADED === 'true';
const isHeadless = !isHeaded;
let isRunningCycle = false;
let isShuttingDown = false;

// Ensure persistent MongoDB Atlas connection
async function connectDb() {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in any .env file.');
  }
  await mongoose.connect(MONGODB_URI);
}

// 1. Check and reactivate any parked tokens that renewed their monthly quota
async function checkRenewals() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const candidates = await ScrapingAntToken.find({
      status: { $in: ['exhausted', 'parked'] },
      $or: [
        { exhaustedAt: { $lte: thirtyDaysAgo } },
        { renewalDate: { $lte: now } },
        { renewalDate: { $exists: false } },
        { renewalDate: null }
      ]
    }).limit(10).lean();

    if (candidates.length === 0) return 0;

    let reactivated = 0;
    for (const t of candidates) {
      try {
        const usage = await checkScrapingAntUsage(t.token);
        if (usage.valid && usage.remainedCredits > 500) {
          await ScrapingAntToken.updateOne({ _id: t._id }, {
            $set: {
              status: 'active',
              usageCount: 0,
              remainedCredits: usage.remainedCredits,
              planTotalCredits: usage.planTotalCredits,
              renewalDate: usage.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              lastCheckedAt: new Date(),
              lastUsedAt: new Date(),
            },
            $unset: { exhaustedAt: 1, cooldownUntil: 1 }
          });
          reactivated++;
          console.log(`[Daemon Renewal] ✓ Reactivated token ${t.token.slice(0, 8)}... with ${usage.remainedCredits} renewed credits!`);
        } else if (usage.valid) {
          await ScrapingAntToken.updateOne({ _id: t._id }, {
            $set: {
              renewalDate: usage.renewalDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
              remainedCredits: usage.remainedCredits,
              lastCheckedAt: new Date()
            }
          });
        }
      } catch (err) {
        // Ignore single token check error
      }
    }
    return reactivated;
  } catch (err) {
    console.warn('[Daemon Renewal Error]:', err.message);
    return 0;
  }
}

// 2. Save a freshly generated token to DB and API
async function saveToken(email, token, createdAt) {
  console.log(`[Daemon Save] Cycle produced token for ${email}: ${token.slice(0, 8)}...`);

  // Pre-flight live validation against ScrapingAnt /v2/usage API
  let liveCredits = 10000;
  let planName = 'Free';
  let planTotalCredits = 10000;
  let renewalDate = null;
  try {
    const usage = await checkScrapingAntUsage(token);
    if (!usage.valid) {
      console.error(`[Daemon Save] ⚠️ Token ${token.slice(0, 8)}... failed live verification (${usage.error}). Refusing to insert.`);
      return;
    }
    liveCredits = usage.remainedCredits ?? 10000;
    planName = usage.planName || 'Free';
    planTotalCredits = usage.planTotalCredits || 10000;
    renewalDate = usage.renewalDate || null;
    console.log(`[Daemon Save] ✓ Pre-flight verified: ${liveCredits}/${planTotalCredits} credits valid (${planName}).`);
  } catch (verifyErr) {
    console.warn(`[Daemon Save] Pre-flight check warning (${verifyErr.message}), proceeding with standard defaults.`);
  }

  // Direct MongoDB Atlas write
  try {
    const existing = await ScrapingAntToken.findOne({ token });
    if (existing) {
      existing.status = 'active';
      existing.email = email || existing.email;
      existing.lastUsedAt = new Date();
      existing.cooldownUntil = null;
      existing.remainedCredits = liveCredits;
      existing.planTotalCredits = planTotalCredits;
      existing.planName = planName;
      if (renewalDate) existing.renewalDate = renewalDate;
      await existing.save();
      console.log(`[Daemon DB] ✓ Reactivated existing token ${token.slice(0, 8)}...`);
    } else {
      await ScrapingAntToken.create({
        token,
        email,
        status: 'active',
        usageCount: 0,
        cooldownUntil: null,
        lastUsedAt: new Date(),
        remainedCredits: liveCredits,
        planTotalCredits: planTotalCredits,
        planName: planName,
        renewalDate: renewalDate
      });
      console.log(`[Daemon DB] ✓ Inserted fresh verified token ${token.slice(0, 8)}... with ${liveCredits} credits.`);
    }
  } catch (dbErr) {
    console.error('[Daemon DB Error]:', dbErr.message);
  }

  // Also notify live API endpoint
  try {
    await fetch(`${API_BASE}/api/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_API_KEY,
      },
      body: JSON.stringify({ token, email }),
      signal: AbortSignal.timeout(10000)
    });
  } catch (apiErr) {
    // API notification is best-effort; direct DB write is authoritative
  }
}

// 3. Main evaluation & replenishment cycle
async function runCheckCycle() {
  if (isRunningCycle || isShuttingDown) return;
  isRunningCycle = true;

  try {
    await connectDb();

    // Step A: First check if any parked tokens renewed
    const renewed = await checkRenewals();
    if (renewed > 0) {
      console.log(`[Daemon] Reactivated ${renewed} renewed token(s) from database.`);
    }

    // Step B: Query active token count in DB
    const activeCount = await ScrapingAntToken.countDocuments({ status: 'active' });
    const timestamp = new Date().toLocaleTimeString();

    if (activeCount >= MIN_ACTIVE_TOKENS) {
      console.log(`[Daemon ${timestamp}] Pool healthy: ${activeCount} active token(s) (safety minimum: ${MIN_ACTIVE_TOKENS}). Sleeping.`);
      return;
    }

    // Step C: Pool is low — autonomously generate fresh tokens
    const tokensNeeded = Math.min(TARGET_POOL_SIZE - activeCount, MAX_BATCH_PER_RUN);
    console.log(`\n======================================================================`);
    console.log(`[Daemon ${timestamp}] ⚠️ LOW TOKEN ALERT: Only ${activeCount} active token(s) (threshold: ${MIN_ACTIVE_TOKENS})`);
    console.log(`[Daemon] Autonomously generating ${tokensNeeded} fresh token(s) to restore target pool (${TARGET_POOL_SIZE})...`);
    console.log(`======================================================================\n`);

    await runBatchAutomation({
      count: tokensNeeded,
      captchaApiKey: TWOCAPTCHA_API_KEY,
      headless: isHeadless,
      delayBetween: 15_000,
      saveToken,
    });

    const newActiveCount = await ScrapingAntToken.countDocuments({ status: 'active' });
    console.log(`\n[Daemon] ✓ Replenishment complete! Pool now has ${newActiveCount} active token(s).\n`);

  } catch (err) {
    console.error(`[Daemon Cycle Error]:`, err.message);
  } finally {
    isRunningCycle = false;
  }
}

// 4. Runner & Startup Logic
async function main() {
  console.log(`══════════════════════════════════════════════════════════════════════`);
  console.log(`🚀 ShoppersDeals Autonomous ScrapingAnt Token Daemon Started`);
  console.log(`══════════════════════════════════════════════════════════════════════`);
  console.log(`• Threshold: Triggers generation when active tokens < ${MIN_ACTIVE_TOKENS}`);
  console.log(`• Target Pool: Restores pool to ${TARGET_POOL_SIZE} tokens`);
  console.log(`• Cadence: Evaluates every ${CHECK_INTERVAL_MS / 60000} minute(s)`);
  console.log(`• Mode: ${isRunOnce ? 'Single-run (--once)' : 'Perpetual background loop'}`);
  console.log(`• Browser UI: ${isHeadless ? '100% Headless (Completely invisible in background)' : 'Visible (Headed browser)'}`);
  console.log(`• Target DB: MongoDB Atlas (${MONGODB_URI ? 'Connected' : 'Missing URI'})`);
  console.log(`══════════════════════════════════════════════════════════════════════\n`);

  // Run initial check immediately
  await runCheckCycle();

  if (isRunOnce) {
    console.log('[Daemon] Single-run completed. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Schedule perpetual loop
  const interval = setInterval(async () => {
    if (!isShuttingDown) {
      await runCheckCycle();
    }
  }, CHECK_INTERVAL_MS);

  // Graceful shutdown handling
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n[Daemon] Gracefully stopping token daemon...');
    clearInterval(interval);
    try {
      await mongoose.disconnect();
    } catch {}
    console.log('[Daemon] Stopped.');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('[Daemon Fatal Error]:', err.message);
  process.exit(1);
});
