import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import { runBatchAutomation, getAutomationStatus } from '../scripts/scrapingAntAutomation.js';
import { checkScrapingAntUsage } from '../utils/scrapingAntUsage.js';

const MIN_ACTIVE_TOKENS = 5;
const TARGET_POOL_SIZE = 8;
const MAX_BATCH_SIZE = 4;
const DEFAULT_CAPTCHA_API_KEY = '00f69cd4eefad8d5ccfe712289733973';

let isReplenishing = false;
let lastCheckTimestamp = 0;

/**
 * Check if the active ScrapingAnt token pool needs replenishment.
 * If active tokens < MIN_ACTIVE_TOKENS (default 5), autonomously runs a batch
 * to restore the pool up to TARGET_POOL_SIZE (default 8).
 */
export async function checkAndReplenishTokens({
  minThreshold = MIN_ACTIVE_TOKENS,
  targetPool = TARGET_POOL_SIZE,
  force = false,
} = {}) {
  try {
    const activeCount = await ScrapingAntToken.countDocuments({ status: 'active' });
    console.log(`[TokenReplenisher] Pool status: ${activeCount} active ScrapingAnt token(s) (safety threshold: ${minThreshold}, target: ${targetPool})`);

    if (!force && activeCount >= minThreshold) {
      return { needed: false, activeCount, message: `Pool healthy: ${activeCount} active tokens` };
    }

    const currentStatus = getAutomationStatus();
    if (isReplenishing || currentStatus?.running) {
      console.log(`[TokenReplenisher] Replenishment already in progress (${currentStatus?.completedCount || 0}/${currentStatus?.requestedCount || 0} completed). Skipping duplicate trigger.`);
      return { needed: true, inProgress: true, activeCount };
    }

    const tokensNeeded = Math.min(Math.max(1, targetPool - activeCount), MAX_BATCH_SIZE);
    const captchaApiKey = process.env.TWOCAPTCHA_API_KEY || DEFAULT_CAPTCHA_API_KEY;

    console.log(`[TokenReplenisher] ⚠️ Active token count (${activeCount}) is below safety threshold (${minThreshold}). Starting autonomous generation of ${tokensNeeded} token(s)...`);

    isReplenishing = true;

    // Fire batch automation in background
    runBatchAutomation({
      count: tokensNeeded,
      captchaApiKey,
      headless: true,
      delayBetween: 15000,
      saveToken: async (email, token, createdAt) => {
        try {
          const existing = await ScrapingAntToken.findOne({ token });
          if (existing) {
            existing.status = 'active';
            existing.email = email || existing.email;
            existing.lastUsedAt = new Date();
            existing.cooldownUntil = null;
            existing.planTotalCredits = 10000;
            await existing.save();
            console.log(`[TokenReplenisher] Reactivated existing token in DB: ${token.slice(0, 8)}...`);
          } else {
            await ScrapingAntToken.create({
              token,
              email,
              status: 'active',
              usageCount: 0,
              cooldownUntil: null,
              lastUsedAt: new Date(),
              planTotalCredits: 10000,
            });
            console.log(`[TokenReplenisher] ✓ Fresh ScrapingAnt token inserted into DB: ${token.slice(0, 8)}... (10,000 credits)`);
          }
        } catch (dbErr) {
          console.error('[TokenReplenisher] DB save error:', dbErr.message);
        }
      },
    }).then(() => {
      console.log(`[TokenReplenisher] ✓ Autonomous batch replenishment completed successfully.`);
    }).catch((err) => {
      console.error('[TokenReplenisher] ✕ Batch automation error:', err.message);
    }).finally(() => {
      isReplenishing = false;
    });

    return {
      needed: true,
      started: true,
      tokensRequested: tokensNeeded,
      activeCount,
    };
  } catch (err) {
    console.error('[TokenReplenisher Error] checkAndReplenishTokens failed:', err.message);
    isReplenishing = false;
    return { error: err.message };
  }
}

/**
 * Debounced / throttled trigger called reactively by ScraperWorker
 * when no active tokens are available or a token is exhausted.
 */
export async function triggerTokenReplenishmentIfLow() {
  const now = Date.now();
  // Throttle trigger invocations to at most once per 60 seconds
  if (now - lastCheckTimestamp < 60000) {
    return;
  }
  lastCheckTimestamp = now;
  return checkAndReplenishTokens();
}

/**
 * Automatically reset exhausted ScrapingAnt tokens whose 30-day limits have expired
 * or whose monthly renewalDate has passed.
 */
export async function checkAndResetExpiredTokens() {
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
    }).limit(10);

    if (candidates.length > 0) {
      console.log(`[TokenReplenisher] Inspecting ${candidates.length} candidate token(s) for quota renewal...`);
      for (const t of candidates) {
        try {
          const usage = await checkScrapingAntUsage(t.token);
          if (usage.valid && usage.remainedCredits > 500) {
            t.status = 'active';
            t.usageCount = 0;
            t.remainedCredits = usage.remainedCredits;
            t.planTotalCredits = usage.planTotalCredits;
            t.renewalDate = usage.renewalDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            t.cooldownUntil = null;
            t.exhaustedAt = undefined;
            t.lastCheckedAt = new Date();
            t.lastUsedAt = new Date();
            await t.save();
            console.log(`[TokenReplenisher] ✓ Reactivated renewed token: ${t.token.slice(0, 8)}... (${usage.remainedCredits} credits)`);
          } else if (usage.valid) {
            t.renewalDate = usage.renewalDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
            t.remainedCredits = usage.remainedCredits;
            t.lastCheckedAt = new Date();
            await t.save();
          } else {
            t.lastCheckedAt = new Date();
            await t.save();
          }
        } catch (tokenErr) {
          console.warn(`[TokenReplenisher] Error checking candidate token ${t.token.slice(0, 8)}:`, tokenErr.message);
        }
      }
    }
  } catch (err) {
    console.warn('[TokenReplenisher] Error checking/resetting expired tokens:', err.message);
  }
}

/**
 * Start the autonomous token replenisher background scheduler.
 * Runs every `intervalMinutes` (default: 30 minutes).
 */
export function startTokenReplenisherScheduler(intervalMinutes = 30) {
  console.log(`[TokenReplenisher] Initializing autonomous token pool replenishment scheduler (cadence: every ${intervalMinutes}m)...`);

  // Run initial pool check 10 seconds after server startup
  setTimeout(async () => {
    await checkAndResetExpiredTokens().catch(() => {});
    await checkAndReplenishTokens().catch(err => {
      console.warn('[TokenReplenisher Scheduler] Initial check failed:', err.message);
    });
  }, 10000);

  // Periodic interval
  setInterval(async () => {
    await checkAndResetExpiredTokens().catch(() => {});
    await checkAndReplenishTokens().catch(err => {
      console.warn('[TokenReplenisher Scheduler] Periodic check failed:', err.message);
    });
  }, intervalMinutes * 60 * 1000);
}

