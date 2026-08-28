import ScrapingAntToken from '../db/models/scrapingAntToken.js';

/**
 * Reset exhausted ScrapingAnt API tokens whose 30-day limits have expired.
 */
export async function checkAndResetTokens() {
  console.log('[Token Scheduler] Running ScrapingAnt token reset check...');
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Find tokens that are exhausted and whose exhausted duration >= 30 days
    const exhaustedTokens = await ScrapingAntToken.find({
      status: 'exhausted',
      exhaustedAt: { $lte: thirtyDaysAgo }
    });

    if (exhaustedTokens.length === 0) {
      console.log('[Token Scheduler] No tokens require reset at this time.');
      return;
    }

    console.log(`[Token Scheduler] Found ${exhaustedTokens.length} token(s) eligible for reset. Resetting...`);
    
    for (const tokenRecord of exhaustedTokens) {
      const truncatedToken = tokenRecord.token.substring(0, 8);
      tokenRecord.status = 'active';
      tokenRecord.usageCount = 0;
      tokenRecord.exhaustedAt = undefined; // Clear field
      await tokenRecord.save();
      console.log(`[Token Scheduler] Token ${truncatedToken}... has been reset to active status.`);
    }
  } catch (err) {
    console.error('[Token Scheduler Error] Failed to check and reset tokens:', err.message);
  }
}

/**
 * Initialize token reset scheduler to check once every 24 hours
 */
export function startTokenResetScheduler() {
  // Run on startup
  checkAndResetTokens();

  // Run daily
  const intervalMs = 24 * 60 * 60 * 1000;
  setInterval(checkAndResetTokens, intervalMs);
}
