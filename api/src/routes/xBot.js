import express from 'express';
import XPostLog from '../db/models/xPostLog.js';
import { checkDeviceStatus } from '../utils/xBot.js';
import { runXBotPostCycle, cancelActiveRun, isRunActive } from '../jobs/xBotScheduler.js';

const router = express.Router();

/**
 * GET /api/x-bot/status
 * Live ADB connection check for the admin UI's device indicator — the phone being unplugged is
 * the expected steady-state outside of active posting, not an error condition to alarm on.
 */
router.get('/status', (req, res) => {
  try {
    const status = checkDeviceStatus();
    res.json({ success: true, ...status, postInProgress: isRunActive() });
  } catch (err) {
    console.error('[API Error] GET /api/x-bot/status failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/x-bot/post-now
 * Manual override for the 3x/day schedule — body: { dealId? }. Without dealId, runs the exact
 * same "pick the best unposted US deal" selection the cron job uses; with one, posts that
 * specific deal (still requires the device to be connected, same as the scheduled path).
 */
router.post('/post-now', async (req, res) => {
  try {
    const { dealId } = req.body || {};
    const log = await runXBotPostCycle({ trigger: 'manual', dealId: dealId || null });
    res.json({ success: log.status === 'SUCCESS', data: log });
  } catch (err) {
    console.error('[API Error] POST /api/x-bot/post-now failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/x-bot/cancel
 * Stops whichever posting attempt is currently in flight (scheduled or manual) — checked at
 * every step boundary in xBot.js, so it takes effect after the current adb command finishes, not
 * instantly. If the composer had already been opened, xBot.js best-effort backs out of it via
 * the Android BACK key rather than leaving a half-typed draft sitting open. Returns
 * wasRunning:false (not an error) if nothing was actually in progress.
 */
router.post('/cancel', (req, res) => {
  const wasRunning = cancelActiveRun();
  res.json({ success: true, wasRunning });
});

/**
 * GET /api/x-bot/history
 * Paginated, newest first — every attempt including skips/failures (see xPostLog.js).
 */
router.get('/history', async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const total = await XPostLog.countDocuments();
    const data = await XPostLog.find().sort({ timestamp: -1 }).skip(skip).limit(limit);

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 } });
  } catch (err) {
    console.error('[API Error] GET /api/x-bot/history failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
