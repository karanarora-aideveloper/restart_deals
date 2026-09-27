import PriceAlert from '../db/models/priceAlert.js';
import { defaultRedis } from './redis.js';
import { formatPriceCurrency } from './affiliate.js';

/**
 * Real-time Price Drop Alert Evaluator for Engine 1.
 * Called immediately whenever an incoming Telegram deal is verified and saved.
 *
 * @param {object} params
 * @param {string} params.productId - Canonical merchant product ID (ASIN / Flipkart PID)
 * @param {number} params.livePrice - Current verified deal price
 * @param {string} params.title - Product title
 * @param {string} params.dealUrl - Clean merchant deal URL
 * @param {string} params.imageUrl - Product image URL
 * @param {string} params.merchant - Merchant name (amazon, flipkart, etc.)
 * @param {string} params.country - Country code (IN, US, etc.)
 * @returns {Promise<number>} Number of alerts triggered
 */
export async function evaluateAndTriggerPriceAlerts({
  productId,
  livePrice,
  title = '',
  dealUrl = '',
  imageUrl = '',
  merchant = 'generic',
  country = 'IN',
}) {
  if (!productId || livePrice == null || isNaN(livePrice)) {
    return 0;
  }

  try {
    // 1. Instant indexed lookup for active user alerts where targetPrice >= livePrice
    const matchingAlerts = await PriceAlert.find({
      productId,
      status: 'active',
      targetPrice: { $gte: livePrice },
    });

    if (matchingAlerts.length === 0) {
      return 0;
    }

    const now = new Date();
    let triggeredCount = 0;

    for (const alert of matchingAlerts) {
      alert.status = 'triggered';
      alert.triggeredAt = now;
      alert.triggeredPrice = livePrice;
      alert.title = title || alert.title;
      alert.imageUrl = imageUrl || alert.imageUrl;
      alert.cleanUrl = dealUrl || alert.cleanUrl;
      await alert.save();
      triggeredCount++;

      const recipient = alert.email || alert.phone || alert.userId || 'Anonymous User';
      const targetStr = formatPriceCurrency(alert.targetPrice, country);
      const liveStr = formatPriceCurrency(livePrice, country);
      console.log(
        `[Price Alert] 🔔 TRIGGERED for "${alert.title || title}"! Target: ${targetStr}, Live Deal: ${liveStr} (Recipient: ${recipient})`
      );

      // 2. Broadcast event to Redis so real-time WebSocket / SSE / Admin dashboard can react
      try {
        await defaultRedis.publish(
          'events:price_alert',
          JSON.stringify({
            alertId: alert._id,
            productId,
            targetPrice: alert.targetPrice,
            livePrice,
            title: alert.title || title,
            dealUrl: alert.cleanUrl || dealUrl,
            imageUrl: alert.imageUrl || imageUrl,
            merchant,
            country,
            recipient,
            email: alert.email,
            phone: alert.phone,
            userId: alert.userId,
            triggeredAt: now.toISOString(),
          })
        );
      } catch (pubErr) {
        // Non-fatal if Redis pub fails
      }
    }

    return triggeredCount;
  } catch (err) {
    console.warn(`[Price Alert Error] Failed to evaluate alerts for product ${productId}:`, err.message);
    return 0;
  }
}
