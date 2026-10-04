import PriceAlert from '../db/models/priceAlert.js';
import PushToken from '../db/models/pushToken.js';
import { defaultRedis } from './redis.js';
import { broadcastPriceDropPush } from './webPushNotifier.js';

function formatPriceCurrency(price, country = 'IN') {
  if (price == null || isNaN(price)) return '';
  const num = Math.round(price);
  return country === 'IN' ? `₹${num.toLocaleString('en-IN')}` : `$${num.toLocaleString('en-US')}`;
}

/**
 * Real-time Price Drop Alert Evaluator for Engine 2 and Background Refreshers.
 * Called immediately whenever an authentic price drop is confirmed.
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
    const matchingAlerts = await PriceAlert.find({
      productId,
      status: 'active',
      targetPrice: { $gte: livePrice },
    });

    // Check if any browser push tokens are subscribed to this product
    const hasPushSubscribers = await PushToken.exists({
      isActive: true,
      subscribedProductIds: productId,
    });

    if (matchingAlerts.length === 0 && !hasPushSubscribers) {
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

      // Direct Telegram notification if user subscribed via Telegram Bot
      if (alert.telegramChatId) {
        sendDirectTelegramAlert({
          chatId: alert.telegramChatId,
          title: alert.title || title,
          livePrice,
          targetPrice: alert.targetPrice,
          dealUrl: alert.cleanUrl || dealUrl,
          merchant,
        }).catch(tgErr => {
          console.warn(`[Telegram Alert] Failed to send alert to ${alert.telegramChatId}:`, tgErr.message);
        });
      }

      // Broadcast event to Redis
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
            telegramChatId: alert.telegramChatId,
            triggeredAt: now.toISOString(),
          })
        );
      } catch (pubErr) {
        // Non-fatal if Redis pub fails
      }
    }

    // Trigger instant browser push notifications for all users/devices tracking this product
    try {
      broadcastPriceDropPush({
        productId,
        title: title || matchingAlerts[0]?.title || 'Price Drop Alert',
        livePrice,
        previousPrice: matchingAlerts[0]?.targetPrice,
        dealUrl,
        imageUrl,
        merchant,
        country,
      }).catch((pushErr) => {
        console.warn(`[WebPush] Failed to broadcast push for ${productId}:`, pushErr.message);
      });
    } catch (err) {
      // Non-fatal
    }

    return triggeredCount;
  } catch (err) {
    console.warn(`[Price Alert Error] Failed to evaluate alerts for product ${productId}:`, err.message);
    return 0;
  }
}

async function sendDirectTelegramAlert({ chatId, title, livePrice, targetPrice, dealUrl, merchant = 'amazon' }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;

  const priceStr = `₹${Math.round(livePrice).toLocaleString('en-IN')}`;
  const targetStr = targetPrice ? `₹${Math.round(targetPrice).toLocaleString('en-IN')}` : '';
  const text = `🚨 <b>PRICE DROP ALERT!</b> 📉\n\n` +
    `<b>${title}</b>\n\n` +
    `💰 <b>Dropped to: ${priceStr}!</b>\n` +
    (targetStr ? `🎯 Your Target: ${targetStr}\n` : '') +
    `🏪 Store: <b>${merchant.toUpperCase()}</b>\n\n` +
    `<i>⚡ Deals expire fast! Click below to grab it:</i>`;

  const payload = {
    chat_id: chatId,
    parse_mode: 'HTML',
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: `🛒 BUY NOW AT ${priceStr}`, url: dealUrl }],
        [{ text: `🌐 View on ShoppersDeals`, url: 'https://www.shoppersdeals.in' }]
      ]
    }
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

