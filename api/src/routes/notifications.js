import express from 'express';
import PushToken from '../db/models/pushToken.js';
import NotificationLog from '../db/models/notificationLog.js';
import { isFirebaseAdminReady, getFirebaseAdminError, getMessaging } from '../utils/firebaseAdmin.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * POST /api/notifications/register
 * Called by the native app on launch (see frontend/src/utils/pushNotifications.js). Public —
 * logins are hidden on native for now, so there's no auth token to require here. Upserts by
 * token: a device reinstalling or getting a fresh FCM token just creates a new row; an
 * unchanged token on repeat calls just bumps lastSeenAt and reactivates it if it had been
 * marked inactive by a previous failed send.
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform, deviceId } = req.body;
    if (!token || !platform) {
      return res.status(400).json({ success: false, error: 'token and platform are required' });
    }
    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({ success: false, error: 'platform must be "android" or "ios"' });
    }

    await PushToken.findOneAndUpdate(
      { token },
      { $set: { platform, deviceId, isActive: true, lastSeenAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[API Error] POST /api/notifications/register failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/status
 * Lets the admin UI show "Firebase isn't configured yet" up front instead of only discovering
 * it after a failed send, plus how many devices are actually reachable right now.
 */
router.get('/status', requireAdminAuth, async (req, res) => {
  try {
    const [androidCount, iosCount] = await Promise.all([
      PushToken.countDocuments({ platform: 'android', isActive: true }),
      PushToken.countDocuments({ platform: 'ios', isActive: true }),
    ]);
    res.json({
      success: true,
      firebaseReady: isFirebaseAdminReady(),
      firebaseError: isFirebaseAdminReady() ? null : getFirebaseAdminError(),
      tokenCounts: { android: androidCount, ios: iosCount, total: androidCount + iosCount },
    });
  } catch (err) {
    console.error('[API Error] GET /api/notifications/status failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/notifications/history
 * Paginated, newest first.
 */
router.get('/history', requireAdminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const total = await NotificationLog.countDocuments();
    const data = await NotificationLog.find().sort({ sentAt: -1 }).skip(skip).limit(limit);

    res.json({ success: true, data, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[API Error] GET /api/notifications/history failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// FCM's multicast send caps at 500 recipients per call.
const FCM_BATCH_SIZE = 500;

/**
 * POST /api/notifications/send
 * Admin-triggered broadcast. Body: { title, body, data?, platform? }. platform defaults to
 * 'android' (iOS isn't wired up yet — this app hides login/permissions and is Android-first
 * per the current rollout). Sends in batches of 500 (FCM's multicast limit), deactivates any
 * token FCM reports as invalid/unregistered so future sends stop wasting calls on it, and logs
 * the result for the history view.
 */
router.post('/send', requireAdminAuth, async (req, res) => {
  try {
    if (!isFirebaseAdminReady()) {
      return res.status(503).json({ success: false, error: getFirebaseAdminError() || 'Firebase Admin is not configured.' });
    }

    const { title, body, data, platform = 'android' } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'title and body are required' });
    }
    if (!['android', 'ios', 'all'].includes(platform)) {
      return res.status(400).json({ success: false, error: 'platform must be "android", "ios", or "all"' });
    }

    const query = { isActive: true };
    if (platform !== 'all') query.platform = platform;

    const tokens = await PushToken.find(query).select('token').lean();
    if (tokens.length === 0) {
      return res.status(400).json({ success: false, error: 'No active devices registered for that platform yet.' });
    }

    const messaging = getMessaging();
    const dataPayload = {};
    if (data && typeof data === 'object') {
      // FCM requires all `data` values to be strings.
      for (const [key, value] of Object.entries(data)) {
        if (value != null) dataPayload[key] = String(value);
      }
    }

    let successCount = 0;
    let failureCount = 0;
    const errorSample = [];
    const invalidTokens = [];

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const batch = tokens.slice(i, i + FCM_BATCH_SIZE).map((t) => t.token);
      const message = {
        notification: { title, body },
        data: dataPayload,
        tokens: batch,
        android: { priority: 'high', notification: { channelId: 'default', color: '#FF6B00' } },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      };

      const result = await messaging.sendEachForMulticast(message);
      successCount += result.successCount;
      failureCount += result.failureCount;

      result.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code || 'unknown';
        if (errorSample.length < 10) errorSample.push(code);
        if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(batch[idx]);
        }
      });
    }

    if (invalidTokens.length > 0) {
      await PushToken.updateMany({ token: { $in: invalidTokens } }, { $set: { isActive: false } });
    }

    const log = await NotificationLog.create({
      title,
      body,
      data: dataPayload,
      platform,
      recipientCount: tokens.length,
      successCount,
      failureCount,
      errorSample,
    });

    res.json({ success: true, data: log });
  } catch (err) {
    console.error('[API Error] POST /api/notifications/send failed:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
