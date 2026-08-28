import express from 'express';
import ScrapingAntToken from '../db/models/scrapingAntToken.js';
import { runBatchAutomation, getAutomationStatus, requestAbort, runScrapingAntAutomation, submitOtpCode, runLoginTest } from '../scripts/scrapingAntAutomation.js';

const router = express.Router();

/**
 * GET /api/tokens
 * List all ScrapingAnt API tokens & summary stats
 */
router.get('/', async (req, res) => {
  try {
    const tokens = await ScrapingAntToken.find({}).sort({ lastUsedAt: -1, createdAt: -1 });

    const total = tokens.length;
    const active = tokens.filter(t => t.status === 'active').length;
    const exhausted = tokens.filter(t => t.status === 'exhausted').length;
    const totalUsage = tokens.reduce((sum, t) => sum + (t.usageCount || 0), 0);

    res.json({
      success: true,
      tokens,
      summary: {
        total,
        active,
        exhausted,
        totalUsage
      }
    });
  } catch (error) {
    console.error('[API Error] GET /api/tokens failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

import ScrapingLog from '../db/models/scrapingLog.js';
import { scraperQueue } from '../services/scraperQueue.js';

/**
 * GET /api/tokens/logs
 * Retrieve paginated scraping activity logs and filter metrics
 */
router.get('/logs', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '25', 10)));
    const skip = (page - 1) * limit;

    const filter = {};

    // Status filter
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    // Source filter
    if (req.query.source && req.query.source !== 'all') {
      filter.source = req.query.source;
    }

    // Mode filter
    if (req.query.mode && req.query.mode !== 'all') {
      filter.mode = req.query.mode;
    }

    // Keyword search
    if (req.query.q) {
      const q = req.query.q.trim();
      filter.$or = [
        { url: { $regex: q, $options: 'i' } },
        { 'extractedData.title': { $regex: q, $options: 'i' } },
        { tokenUsed: { $regex: q, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      ScrapingLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ScrapingLog.countDocuments(filter),
    ]);

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [stats24h, queueState] = await Promise.all([
      ScrapingLog.aggregate([
        { $match: { createdAt: { $gte: last24h } } },
        {
          $group: {
            _id: null,
            totalScrapes: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            proxyCount: { $sum: { $cond: [{ $eq: ['$mode', 'scrapingant_proxy'] }, 1, 0] } },
            directCount: { $sum: { $cond: [{ $eq: ['$mode', 'direct'] }, 1, 0] } },
            avgDuration: { $avg: '$durationMs' },
            concurrency409: { $sum: { $cond: [{ $eq: ['$statusCode', 409] }, 1, 0] } },
          },
        },
      ]),
      scraperQueue.getStatus(),
    ]);

    const metrics = stats24h[0] || {
      totalScrapes: total,
      successCount: 0,
      proxyCount: 0,
      directCount: 0,
      avgDuration: 0,
      concurrency409: 0,
    };

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      metrics: {
        totalScrapes24h: metrics.totalScrapes,
        successRate: metrics.totalScrapes > 0 ? Math.round((metrics.successCount / metrics.totalScrapes) * 100) : 100,
        directCount: metrics.directCount,
        proxyCount: metrics.proxyCount,
        avgDurationMs: Math.round(metrics.avgDuration || 0),
        concurrency409Avoided: metrics.concurrency409,
        queue: queueState,
      },
    });
  } catch (error) {
    console.error('[API Error] GET /api/tokens/logs failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/tokens/automation-status
 * Get current automation run status (for polling from admin UI)
 */
router.get('/automation-status', (req, res) => {
  res.json({ success: true, ...getAutomationStatus() });
});

/**
 * POST /api/tokens/generate-scrapingant
 * Start batch automation to generate new tokens
 * Body: { count: 5, captchaApiKey: '...', headless: true, delayBetween: 30000 }
 */
router.post('/generate-scrapingant', async (req, res) => {
  const status = getAutomationStatus();
  if (status.running) {
    return res.status(409).json({
      success: false,
      error: 'An automation run is already in progress',
      status
    });
  }

  const { count = 1, captchaApiKey, headless = true, delayBetween = 30000 } = req.body;

  if (!captchaApiKey && !process.env.TWOCAPTCHA_API_KEY) {
    return res.status(400).json({
      success: false,
      error: '2Captcha API key is required. Pass captchaApiKey in body or set TWOCAPTCHA_API_KEY env var.'
    });
  }

  const tokenCount = Math.min(Math.max(1, parseInt(count) || 1), 50); // 1..50

  // Respond immediately — automation runs in background
  res.json({
    success: true,
    message: `Automation started: generating ${tokenCount} token(s) in the background.`,
    count: tokenCount,
  });

  // Fire and forget
  runBatchAutomation({
    count: tokenCount,
    captchaApiKey: captchaApiKey || process.env.TWOCAPTCHA_API_KEY,
    headless: headless !== false,
    delayBetween: parseInt(delayBetween) || 30_000,
    saveToken: async (email, token, createdAt) => {
      try {
        const existing = await ScrapingAntToken.findOne({ token });
        if (existing) {
          console.log(`[Automation] Token already exists in DB, skipping save.`);
          return;
        }
        const newToken = new ScrapingAntToken({
          token,
          email,
          status: 'active',
          usageCount: 0,
          lastUsedAt: new Date(),
        });
        await newToken.save();
        console.log(`[Automation] ✓ Token saved to DB: ${token.substring(0, 8)}...`);
      } catch (dbErr) {
        console.error(`[Automation] Error saving token to DB:`, dbErr.message);
      }
    }
  }).catch((err) => {
    console.error(`[Automation] Batch run failed:`, err.message);
  });
});

/**
 * POST /api/tokens/test-login
 * Run ONLY Steps 0-2 (browser launch → login status check → Sonjj login)
 * and stop — no email generation, no ScrapingAnt signup, no token spend.
 * Body: { captchaApiKey?: '...', headless?: false }
 */
router.post('/test-login', (req, res) => {
  const status = getAutomationStatus();
  if (status.running) {
    return res.status(409).json({
      success: false,
      error: 'An automation run is already in progress',
      status
    });
  }

  const { captchaApiKey, headless = false } = req.body;

  res.json({
    success: true,
    message: 'Login test started — watch for a browser window on the machine running api/.',
  });

  runLoginTest({
    captchaApiKey: captchaApiKey || process.env.TWOCAPTCHA_API_KEY,
    headless: headless === true,
  }).catch((err) => {
    console.error('[TestLogin] Run failed:', err.message);
  });
});

/**
 * POST /api/tokens/stop-automation
 * Request abort of the current automation run
 */
router.post('/stop-automation', (req, res) => {
  const stopped = requestAbort();
  if (stopped) {
    res.json({ success: true, message: 'Abort requested. Automation will stop after the current cycle.' });
  } else {
    res.json({ success: false, message: 'No automation is currently running.' });
  }
});

/**
 * POST /api/tokens/submit-otp-code
 * Hand off the Sonjj email verification code (read from Gmail by the admin)
 * to a paused automation run that's waiting on it.
 * Body: { code: "123456" }
 */
router.post('/submit-otp-code', (req, res) => {
  const { code } = req.body;
  if (!code || !String(code).trim()) {
    return res.status(400).json({ success: false, error: 'code is required' });
  }

  const status = getAutomationStatus();
  if (!status.awaitingCode) {
    return res.status(409).json({ success: false, error: 'Automation is not currently waiting for a code' });
  }

  const accepted = submitOtpCode(String(code).trim());
  if (!accepted) {
    return res.status(409).json({ success: false, error: 'No pending code request (it may have just timed out)' });
  }

  res.json({ success: true, message: 'Code submitted, automation resuming.' });
});

/**
 * POST /api/tokens
 * Add one or multiple ScrapingAnt API tokens
 * Body: { token: "key" } OR { tokens: ["key1", "key2"] }
 */
router.post('/', async (req, res) => {
  try {
    const { token, tokens } = req.body;

    let keyList = [];
    if (Array.isArray(tokens) && tokens.length > 0) {
      keyList = tokens.map(t => typeof t === 'string' ? t.trim() : '').filter(Boolean);
    } else if (typeof token === 'string' && token.trim()) {
      // Check if newline-separated or comma-separated tokens were pasted
      keyList = token
        .split(/[\n,]+/)
        .map(t => t.trim())
        .filter(Boolean);
    }

    if (keyList.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid API token string is required' });
    }

    const inserted = [];
    const skipped = [];

    for (const key of keyList) {
      const existing = await ScrapingAntToken.findOne({ token: key });
      if (existing) {
        skipped.push(key);
      } else {
        const newToken = new ScrapingAntToken({
          token: key,
          status: 'active',
          usageCount: 0,
          lastUsedAt: new Date()
        });
        await newToken.save();
        inserted.push(newToken);
      }
    }

    res.status(201).json({
      success: true,
      insertedCount: inserted.length,
      skippedCount: skipped.length,
      tokens: inserted
    });
  } catch (error) {
    console.error('[API Error] POST /api/tokens failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/tokens/:id
 * Update status, reset usage, or update token string
 */
router.patch('/:id', async (req, res) => {
  try {
    const tokenRecord = await ScrapingAntToken.findById(req.params.id);
    if (!tokenRecord) {
      return res.status(404).json({ success: false, error: 'ScrapingAnt token not found' });
    }

    const { status, resetUsage, token } = req.body;

    if (status && ['active', 'exhausted'].includes(status)) {
      tokenRecord.status = status;
      if (status === 'exhausted' && !tokenRecord.exhaustedAt) {
        tokenRecord.exhaustedAt = new Date();
      } else if (status === 'active') {
        tokenRecord.exhaustedAt = null;
      }
    }

    if (resetUsage) {
      tokenRecord.usageCount = 0;
    }

    if (typeof token === 'string' && token.trim()) {
      tokenRecord.token = token.trim();
    }

    await tokenRecord.save();

    res.json({
      success: true,
      token: tokenRecord
    });
  } catch (error) {
    console.error(`[API Error] PATCH /api/tokens/${req.params.id} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Helper: Check credits and usage on ScrapingAnt for a given API key
 */
async function checkScrapingAntUsage(token) {
  try {
    const url = `https://api.scrapingant.com/v2/usage?x-api-key=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok || data.detail) {
      return {
        valid: false,
        statusCode: response.status,
        error: data.detail || `HTTP ${response.status}: Failed to fetch usage`
      };
    }

    return {
      valid: true,
      statusCode: response.status,
      planName: data.plan_name || 'Free',
      planTotalCredits: data.plan_total_credits || 10000,
      remainedCredits: typeof data.remained_credits === 'number' ? data.remained_credits : 0,
      renewalDate: data.end_date || null,
      startDate: data.start_date || null,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message
    };
  }
}

/**
 * POST /api/tokens/:id/check-credits
 * Checks live credits on ScrapingAnt for a single token, updates DB, and reactivates if credits > 0
 */
router.post('/:id/check-credits', async (req, res) => {
  try {
    const tokenRecord = await ScrapingAntToken.findById(req.params.id);
    if (!tokenRecord) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    const usage = await checkScrapingAntUsage(tokenRecord.token);
    tokenRecord.lastCheckedAt = new Date();

    if (usage.valid) {
      tokenRecord.planName = usage.planName;
      tokenRecord.planTotalCredits = usage.planTotalCredits;
      tokenRecord.remainedCredits = usage.remainedCredits;
      if (usage.renewalDate) {
        tokenRecord.renewalDate = new Date(usage.renewalDate);
      }

      if (usage.remainedCredits > 0) {
        tokenRecord.status = 'active';
        tokenRecord.exhaustedAt = null;
        tokenRecord.usageCount = 0;
      } else {
        tokenRecord.status = 'exhausted';
        if (!tokenRecord.exhaustedAt) tokenRecord.exhaustedAt = new Date();
      }
    }

    await tokenRecord.save();

    res.json({
      success: true,
      token: tokenRecord,
      usage,
      reactivated: usage.valid && usage.remainedCredits > 0
    });
  } catch (error) {
    console.error(`[API Error] POST /api/tokens/${req.params.id}/check-credits failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tokens/sync
 * Syncs all tokens directly with ScrapingAnt's live usage API.
 * - Automatically activates tokens that have remained_credits > 0
 * - Marks tokens with 0 credits as exhausted
 * - Updates latest plan, credits, and renewal dates
 */
router.post('/sync', async (req, res) => {
  try {
    const tokens = await ScrapingAntToken.find({});
    const results = [];
    let reactivatedCount = 0;
    let stillExhaustedCount = 0;
    let invalidCount = 0;

    for (const tokenRecord of tokens) {
      const usage = await checkScrapingAntUsage(tokenRecord.token);
      tokenRecord.lastCheckedAt = new Date();

      if (usage.valid) {
        tokenRecord.planName = usage.planName;
        tokenRecord.planTotalCredits = usage.planTotalCredits;
        tokenRecord.remainedCredits = usage.remainedCredits;
        if (usage.renewalDate) {
          tokenRecord.renewalDate = new Date(usage.renewalDate);
        }

        if (usage.remainedCredits > 0) {
          tokenRecord.status = 'active';
          tokenRecord.exhaustedAt = null;
          tokenRecord.usageCount = 0;
          reactivatedCount++;
        } else {
          tokenRecord.status = 'exhausted';
          if (!tokenRecord.exhaustedAt) tokenRecord.exhaustedAt = new Date();
          stillExhaustedCount++;
        }
      } else {
        invalidCount++;
      }

      await tokenRecord.save();
      results.push({
        _id: tokenRecord._id,
        token: tokenRecord.token,
        status: tokenRecord.status,
        usage
      });
    }

    res.json({
      success: true,
      totalChecked: tokens.length,
      reactivatedCount,
      stillExhaustedCount,
      invalidCount,
      results
    });
  } catch (error) {
    console.error('[API Error] POST /api/tokens/sync failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tokens/verify-and-reset (alias for /sync)
 */
router.post('/verify-and-reset', async (req, res) => {
  return res.redirect(307, '/api/tokens/sync');
});

/**
 * DELETE /api/tokens/:id
 * Delete a ScrapingAnt token
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await ScrapingAntToken.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    res.json({
      success: true,
      deletedId: req.params.id
    });
  } catch (error) {
    console.error(`[API Error] DELETE /api/tokens/${req.params.id} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tokens/bulk-delete
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { tokenIds } = req.body;
    if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
      return res.status(400).json({ success: false, error: 'tokenIds array is required' });
    }

    const result = await ScrapingAntToken.deleteMany({ _id: { $in: tokenIds } });

    res.json({
      success: true,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('[API Error] POST /api/tokens/bulk-delete failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

