import cron from 'node-cron';
import PriceAlert from '../db/models/priceAlert.js';
import Deal from '../db/models/deal.js';
import Product from '../db/models/product.js';
import { broadcastPriceDropPush } from '../utils/webPushNotifier.js';

/**
 * Decision 21: Autonomous Replenishment Tracker & Nudge Engine
 * Tracks estimated depletion cycles for consumables (supplements, skincare, staples)
 * and dispatches timely re-order deal alerts via Telegram bot & WebPush before stock runs out.
 */

const CONSUMABLE_DEPLETION_DAYS = {
  'fitness:supplements': 30,       // Whey protein 1kg, Creatine, BCAA (~30 servings)
  'fitness:vitamins': 45,          // Multivitamins, Fish oil (60 capsules)
  'beauty:skincare': 45,           // Sunscreen 50g, Face wash, Serum 30ml
  'beauty:bath-body': 35,          // Body wash, body lotion
  'beauty:haircare': 40,           // Shampoo 250ml, Hair oil
  'grocery:staples': 25,           // Diapers, Coffee, Tea, Detergent
  'grocery:snacks-beverages': 20,  // Health drinks, oats
  'personal-care:grooming': 45,    // Shaving blades, beard oil
};

function getDepletionDays(category, subcategory) {
  const key = `${category}:${subcategory}`;
  return CONSUMABLE_DEPLETION_DAYS[key] || (category === 'grocery' ? 25 : null);
}

async function sendReplenishmentTelegramAlert({ chatId, productTitle, dealPrice, originalPrice, discountPct, dealUrl, categoryName }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;

  const priceStr = `₹${Math.round(dealPrice).toLocaleString('en-IN')}`;
  const origStr = originalPrice ? `<s>₹${Math.round(originalPrice).toLocaleString('en-IN')}</s> ` : '';
  const text = `📦 <b>RUNNING LOW ON YOUR ${categoryName.toUpperCase()}?</b> ⏳\n\n` +
    `Your consumable stock is estimated to run out soon. We found an active price drop for you:\n\n` +
    `<b>${productTitle}</b>\n\n` +
    `💰 <b>Price: ${priceStr}</b> ${origStr}(<b>${discountPct}% OFF</b>)\n\n` +
    `<i>⚡ Re-order today to get it delivered before you run out!</i>`;

  const payload = {
    chat_id: chatId,
    parse_mode: 'HTML',
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: `🛒 RE-ORDER NOW AT ${priceStr}`, url: dealUrl }],
        [{ text: `🌐 View All Live Deals`, url: 'https://www.shoppersdeals.in' }]
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

/**
 * Evaluates all user-tracked consumables for upcoming depletion and triggers re-order deal alerts.
 */
export async function runReplenishmentCycle() {
  console.log('[Replenishment Tracker] 🔄 Checking consumables depletion cycles...');
  const now = new Date();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  try {
    // 1. Find price alerts on products that could be consumables
    const candidates = await PriceAlert.find({
      $or: [
        { lastReplenishmentNudgeAt: { $lt: fourteenDaysAgo } },
        { lastReplenishmentNudgeAt: null },
        { lastReplenishmentNudgeAt: { $exists: false } }
      ]
    }).limit(200);

    let nudgesSent = 0;

    for (const alert of candidates) {
      const product = await Product.findOne({ productId: alert.productId });
      if (!product) continue;

      const depletionDays = getDepletionDays(product.category, product.subcategory);
      if (!depletionDays) continue; // Not a recognized consumable

      const referenceDate = alert.createdAt || product.createdAt || now;
      const daysSinceTracking = Math.floor((now - referenceDate) / (24 * 60 * 60 * 1000));

      // Nudge window: within 5 days before or 5 days after estimated depletion
      const isInNudgeWindow = daysSinceTracking >= (depletionDays - 5) && daysSinceTracking <= (depletionDays + 15);
      if (!isInNudgeWindow) continue;

      // 2. Find an active deal for this exact product OR same subcategory
      let deal = await Deal.findOne({
        productId: alert.productId,
        isExpired: false,
        discountPercentage: { $gte: 10 }
      });

      if (!deal && product.subcategory) {
        deal = await Deal.findOne({
          category: product.category,
          subcategory: product.subcategory,
          isExpired: false,
          discountPercentage: { $gte: 15 }
        }).sort({ discountPercentage: -1 });
      }

      if (deal) {
        const dealUrl = `https://www.shoppersdeals.in/r/${deal._id}?src=replenishment_nudge`;
        const categoryLabel = product.subcategory || product.category || 'Supplies';

        if (alert.telegramChatId) {
          await sendReplenishmentTelegramAlert({
            chatId: alert.telegramChatId,
            productTitle: deal.title,
            dealPrice: deal.dealPrice,
            originalPrice: deal.originalPrice,
            discountPct: deal.discountPercentage,
            dealUrl,
            categoryName: categoryLabel
          });
          nudgesSent++;
        }

        // WebPush Broadcast for product followers
        broadcastPriceDropPush({
          productId: product.productId,
          title: `Replenishment Reminder: ${deal.title.slice(0, 40)}`,
          livePrice: deal.dealPrice,
          previousPrice: deal.originalPrice,
          dealUrl,
          imageUrl: deal.imageUrl || product.imageUrl,
          merchant: deal.merchant,
          country: deal.country || 'IN'
        }).catch(() => {});

        alert.lastReplenishmentNudgeAt = now;
        await alert.save();
      }
    }

    console.log(`[Replenishment Tracker] ✓ Cycle complete. Sent ${nudgesSent} replenishment nudge(s).`);
  } catch (err) {
    console.error('[Replenishment Tracker Error]:', err.message);
  }
}

/**
 * Initializes daily scheduler (runs every day at 10:00 AM IST: '30 4 * * *')
 */
export function startReplenishmentScheduler() {
  console.log('[Replenishment Tracker] Initializing Daily Consumables Replenishment Scheduler ("30 4 * * *")...');
  cron.schedule('30 4 * * *', async () => {
    try {
      await runReplenishmentCycle();
    } catch (err) {
      console.error('[Replenishment Cron Error]:', err.message);
    }
  });

  // Run initial lightweight pass after 45s on boot
  setTimeout(() => {
    runReplenishmentCycle().catch(() => {});
  }, 45000);
}
