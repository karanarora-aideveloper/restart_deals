import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import { checkScrapingAntUsage } from '../utils/scrapingAntUsage.js';

/**
 * Audit and reactivate parked / exhausted ScrapingAnt API tokens whose 30-day monthly limit has renewed.
 * Uses ScrapingAnt live usage API to verify available credits, updates renewal timestamps,
 * and deletes permanently dead / revoked tokens.
 */
export async function checkAndResetTokens() {
  console.log('[Token Scheduler] Running ScrapingAnt token renewal audit...');
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Find tokens that are parked or exhausted and due for verification
    const candidates = await ScrapingAntToken.find({
      status: { $in: ['parked', 'exhausted'] },
      $or: [
        { renewalDate: { $lte: now } },
        { renewalDate: null },
        { exhaustedAt: { $lte: thirtyDaysAgo } }
      ]
    });

    if (candidates.length === 0) {
      console.log('[Token Scheduler] No parked/exhausted tokens due for renewal verification.');
      return;
    }

    console.log(`[Token Scheduler] Found ${candidates.length} token(s) due for renewal check. Querying ScrapingAnt API...`);
    
    for (const tokenRecord of candidates) {
      const truncated = tokenRecord.token.substring(0, 8);
      const usage = await checkScrapingAntUsage(tokenRecord.token);
      tokenRecord.lastCheckedAt = new Date();

      if (!usage.valid) {
        // If ScrapingAnt reports invalid token, purge it from DB
        console.warn(`[Token Scheduler] Token ${truncated}... is invalid or dead (${usage.error}). Deleting from DB.`);
        await ScrapingAntToken.deleteOne({ _id: tokenRecord._id });
        continue;
      }

      tokenRecord.planName = usage.planName;
      tokenRecord.planTotalCredits = usage.planTotalCredits;
      tokenRecord.remainedCredits = usage.remainedCredits;
      if (usage.renewalDate) {
        tokenRecord.renewalDate = usage.renewalDate;
      }

      if (usage.remainedCredits > 0) {
        tokenRecord.status = 'active';
        tokenRecord.usageCount = 0;
        tokenRecord.exhaustedAt = null;
        tokenRecord.cooldownUntil = null;
        await tokenRecord.save();
        console.log(`[Token Scheduler] Token ${truncated}... renewed with ${usage.remainedCredits} credits! Reactivated to 'active'.`);
      } else {
        tokenRecord.status = 'parked';
        await tokenRecord.save();
        console.log(`[Token Scheduler] Token ${truncated}... checked; 0 credits remaining. Parked until renewal date: ${tokenRecord.renewalDate?.toISOString() || 'unknown'}.`);
      }
    }
  } catch (err) {
    console.error('[Token Scheduler Error] Failed to check and reset tokens:', err.message);
  }
}

/**
 * Initialize token reset scheduler to check on startup and then periodically every 6 hours
 */
export function startTokenResetScheduler() {
  // Run on startup
  checkAndResetTokens().catch(err => {
    console.error('[Token Scheduler] Initial startup check failed:', err.message);
  });

  // Run every 6 hours
  const intervalMs = 6 * 60 * 60 * 1000;
  setInterval(checkAndResetTokens, intervalMs);
}
