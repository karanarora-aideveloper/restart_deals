import express from 'express';
import jwt from 'jsonwebtoken';
import PushToken from '../db/models/pushToken.js';
import { getVapidPublicKey, sendNotificationToToken } from '../utils/webPushNotifier.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shoppers_deals_jwt_secret_key_2026';

/**
 * Optional token authentication helper
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (err) {}
  next();
}

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key needed by browser clients to subscribe.
 */
router.get('/vapid-public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: getVapidPublicKey(),
  });
});

/**
 * POST /api/push/subscribe
 * Registers or updates a Web Push subscription.
 * Body: { subscription: { endpoint, keys: { p256dh, auth } }, deviceId, platform, productId }
 */
router.post('/subscribe', optionalAuth, async (req, res) => {
  try {
    const { subscription, token, deviceId, platform = 'web', productId } = req.body;

    if (!subscription && !token) {
      return res.status(400).json({ success: false, error: 'Subscription or token is required' });
    }

    const userId = req.user?.id || null;
    let pushDoc = null;

    if (subscription?.endpoint) {
      pushDoc = await PushToken.findOne({ endpoint: subscription.endpoint });

      if (pushDoc) {
        pushDoc.isActive = true;
        pushDoc.lastSeenAt = new Date();
        if (userId) pushDoc.userId = userId;
        if (deviceId) pushDoc.deviceId = deviceId;
        if (subscription.keys) pushDoc.keys = subscription.keys;
        if (productId && !pushDoc.subscribedProductIds.includes(productId)) {
          pushDoc.subscribedProductIds.push(productId);
        }
        await pushDoc.save();
      } else {
        pushDoc = new PushToken({
          endpoint: subscription.endpoint,
          keys: subscription.keys || {},
          platform: 'web',
          userId: userId || undefined,
          deviceId: deviceId || undefined,
          subscribedProductIds: productId ? [productId] : [],
          isActive: true,
        });
        await pushDoc.save();
      }
    } else if (token) {
      pushDoc = await PushToken.findOne({ token });

      if (pushDoc) {
        pushDoc.isActive = true;
        pushDoc.lastSeenAt = new Date();
        if (userId) pushDoc.userId = userId;
        if (deviceId) pushDoc.deviceId = deviceId;
        if (productId && !pushDoc.subscribedProductIds.includes(productId)) {
          pushDoc.subscribedProductIds.push(productId);
        }
        await pushDoc.save();
      } else {
        pushDoc = new PushToken({
          token,
          platform: platform || 'web',
          userId: userId || undefined,
          deviceId: deviceId || undefined,
          subscribedProductIds: productId ? [productId] : [],
          isActive: true,
        });
        await pushDoc.save();
      }
    }

    res.json({
      success: true,
      message: 'Push notification subscription registered successfully',
      data: {
        id: pushDoc?._id,
        platform: pushDoc?.platform,
        isSubscribedToProduct: productId ? pushDoc?.subscribedProductIds.includes(productId) : false,
      },
    });
  } catch (err) {
    console.error('[API Error] POST /api/push/subscribe failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to subscribe to push notifications: ' + err.message });
  }
});

/**
 * POST /api/push/track-product
 * Adds a product to the device/user's push notification watchlist.
 * Body: { productId, endpoint, deviceId }
 */
router.post('/track-product', optionalAuth, async (req, res) => {
  try {
    const { productId, endpoint, deviceId } = req.body;
    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }

    const userId = req.user?.id || null;
    const filter = {
      $or: [
        ...(endpoint ? [{ endpoint }] : []),
        ...(deviceId ? [{ deviceId }] : []),
        ...(userId ? [{ userId }] : []),
      ]
    };

    if (filter.$or.length === 0) {
      return res.status(400).json({ success: false, error: 'Valid subscription, deviceId, or auth token required' });
    }

    const tokens = await PushToken.find(filter);
    for (const t of tokens) {
      if (!t.subscribedProductIds.includes(productId)) {
        t.subscribedProductIds.push(productId);
        t.isActive = true;
        await t.save();
      }
    }

    res.json({
      success: true,
      message: `Product ${productId} added to push tracking watchlist`,
      matchedDevices: tokens.length,
    });
  } catch (err) {
    console.error('[API Error] POST /api/push/track-product failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/push/send-test
 * Dispatches an instant test push notification to verify browser receipt.
 * Body: { endpoint, deviceId }
 */
router.post('/send-test', optionalAuth, async (req, res) => {
  try {
    const { endpoint, deviceId } = req.body;
    const userId = req.user?.id;

    const query = {
      $or: [
        ...(endpoint ? [{ endpoint }] : []),
        ...(deviceId ? [{ deviceId }] : []),
        ...(userId ? [{ userId }] : []),
      ]
    };

    if (query.$or.length === 0) {
      return res.status(400).json({ success: false, error: 'Target endpoint or deviceId required' });
    }

    const tokenDoc = await PushToken.findOne(query);
    if (!tokenDoc) {
      return res.status(404).json({ success: false, error: 'No active push subscription found' });
    }

    const sent = await sendNotificationToToken(tokenDoc, {
      title: 'ShoppersDeals Push Test 🔔',
      body: 'Browser push notifications are active! You will get instant alerts whenever tracked products drop in price.',
      url: 'https://shoppersdeals.in',
    });

    res.json({
      success: sent,
      message: sent ? 'Test notification sent successfully' : 'Failed to deliver notification',
    });
  } catch (err) {
    console.error('[API Error] POST /api/push/send-test failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
