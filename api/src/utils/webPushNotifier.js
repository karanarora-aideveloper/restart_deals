import webpush from 'web-push';
import PushToken from '../db/models/pushToken.js';
import PriceAlert from '../db/models/priceAlert.js';
import { isFirebaseAdminReady, getMessaging } from './firebaseAdmin.js';

// Default VAPID credentials for ShoppersDeals Web Push
export const DEFAULT_VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BMf1wMv-5-B1yOV-brXysz3U9hJQzIUe7AinBbOfZ3HNJP0V4X9PUUK6HKxRo3c9vgFVL1VpgRilnWOj550ev5Q';
const DEFAULT_VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '0qJjUFijCmWt5W-GhsvbLabm2iJxgneqv77JoYw5LE0';
const DEFAULT_VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@shoppersdeals.in';

try {
  webpush.setVapidDetails(
    DEFAULT_VAPID_SUBJECT,
    DEFAULT_VAPID_PUBLIC_KEY,
    DEFAULT_VAPID_PRIVATE_KEY
  );
  console.log('[Web Push] VAPID details configured successfully.');
} catch (err) {
  console.warn('[Web Push Warning] Could not configure VAPID details:', err.message);
}

/**
 * Returns the active VAPID public key for browser clients.
 */
export function getVapidPublicKey() {
  return DEFAULT_VAPID_PUBLIC_KEY;
}

/**
 * Sends a browser push notification to a single PushToken document.
 */
export async function sendNotificationToToken(tokenDoc, payload = {}) {
  if (!tokenDoc || !tokenDoc.isActive) return false;

  const notificationPayload = {
    title: payload.title || 'ShoppersDeals Price Drop! 🎉',
    body: payload.body || 'A product you are tracking just dropped in price!',
    icon: payload.icon || 'https://shoppersdeals.in/icons/icon-192.png',
    badge: 'https://shoppersdeals.in/icons/icon-192.png',
    data: {
      url: payload.url || (payload.productId ? `https://shoppersdeals.in/product/${payload.productId}` : 'https://shoppersdeals.in'),
      productId: payload.productId,
      price: payload.price,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_url', title: 'View Deal ↗' }
    ]
  };

  // 1. Standard W3C Web Push (via endpoint and keys)
  if (tokenDoc.endpoint && tokenDoc.keys?.p256dh && tokenDoc.keys?.auth) {
    try {
      const pushSubscription = {
        endpoint: tokenDoc.endpoint,
        keys: {
          p256dh: tokenDoc.keys.p256dh,
          auth: tokenDoc.keys.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, JSON.stringify(notificationPayload));
      tokenDoc.lastSeenAt = new Date();
      await tokenDoc.save().catch(() => {});
      return true;
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription has expired or unsubscribed
        console.log(`[Web Push] Expired subscription marked inactive: ${tokenDoc._id}`);
        tokenDoc.isActive = false;
        await tokenDoc.save().catch(() => {});
      } else {
        console.warn(`[Web Push Error] Failed to send web push to ${tokenDoc._id}:`, err.message);
      }
      return false;
    }
  }

  // 2. Firebase Cloud Messaging (FCM Token)
  if (tokenDoc.token && isFirebaseAdminReady()) {
    try {
      const messaging = getMessaging();
      if (!messaging) return false;

      const fcmMessage = {
        token: tokenDoc.token,
        notification: {
          title: notificationPayload.title,
          body: notificationPayload.body,
          imageUrl: payload.imageUrl || notificationPayload.icon,
        },
        data: {
          url: notificationPayload.data.url,
          productId: String(notificationPayload.data.productId || ''),
        },
        webpush: {
          fcmOptions: {
            link: notificationPayload.data.url,
          },
        },
      };

      await messaging.send(fcmMessage);
      tokenDoc.lastSeenAt = new Date();
      await tokenDoc.save().catch(() => {});
      return true;
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered') {
        tokenDoc.isActive = false;
        await tokenDoc.save().catch(() => {});
      }
      console.warn(`[FCM Push Error] Failed to send FCM to ${tokenDoc._id}:`, err.message);
      return false;
    }
  }

  return false;
}

/**
 * Broadcasts a price drop notification to all subscribed users/devices for a product.
 */
export async function broadcastPriceDropPush({
  productId,
  title,
  livePrice,
  previousPrice,
  dealUrl,
  imageUrl,
  merchant,
  country = 'IN',
}) {
  if (!productId || !livePrice) return 0;

  try {
    // 1. Find price alerts that match this product and target price
    const alerts = await PriceAlert.find({
      productId,
      status: { $in: ['active', 'triggered'] },
      $or: [
        { targetPrice: { $gte: livePrice } },
        { targetPrice: { $exists: false } }
      ]
    }).select('userId email phone').lean();

    const userIds = alerts.map(a => a.userId).filter(Boolean);

    // 2. Find all active push tokens for these users OR devices directly subscribed to this productId
    const tokenQuery = {
      isActive: true,
      $or: [
        { subscribedProductIds: productId },
        ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : [])
      ]
    };

    const pushTokens = await PushToken.find(tokenQuery);
    if (!pushTokens || pushTokens.length === 0) return 0;

    const priceDiff = previousPrice && previousPrice > livePrice ? previousPrice - livePrice : 0;
    const formattedPrice = country === 'US' ? `$${Number(livePrice).toFixed(2)}` : `₹${Math.round(livePrice).toLocaleString('en-IN')}`;
    const savingsText = priceDiff > 0
      ? (country === 'US' ? ` (Save $${priceDiff.toFixed(2)}!)` : ` (Save ₹${Math.round(priceDiff).toLocaleString('en-IN')}!)`)
      : '';

    const payload = {
      title: `⚡ Price Drop: ${formattedPrice}!`,
      body: `${title.slice(0, 65)}... dropped to ${formattedPrice}${savingsText} on ${(merchant || 'Store').toUpperCase()}.`,
      icon: imageUrl || 'https://shoppersdeals.in/icons/icon-192.png',
      imageUrl,
      productId,
      price: livePrice,
      url: `https://shoppersdeals.in/product/${productId}`,
    };

    let sentCount = 0;
    for (const tokenDoc of pushTokens) {
      const sent = await sendNotificationToToken(tokenDoc, payload);
      if (sent) sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[Web Push] 🚀 Successfully sent ${sentCount} browser push notifications for product "${title.slice(0, 40)}"`);
    }

    return sentCount;
  } catch (err) {
    console.error(`[Web Push Broadcast Error] Failed for ${productId}:`, err.message);
    return 0;
  }
}
