import Deal from '../../db/models/deal.js';
import OutputChannel from '../../db/models/outputChannel.js';
import { buildAffiliateUrl, getWebsiteDealUrl, formatPriceCurrency } from '../../utils/affiliate.js';

export function formatTelegramMessage(deal, channelUsername) {
  const title = deal.title || 'Special Deal';
  const country = deal.country || 'IN';
  const dealPriceFormatted = formatPriceCurrency(deal.dealPrice, country);
  const dealPriceStr = dealPriceFormatted || 'Special Price';

  let originalPriceLine = '';
  if (deal.priceSource === 'price_history' && deal.previousPrice && deal.dealPrice && deal.previousPrice > deal.dealPrice) {
    const priorPriceStr = formatPriceCurrency(deal.previousPrice, country);
    originalPriceLine = `📉 Price Dropped: <s>${priorPriceStr}</s> (<b>${deal.discountPercentage}% OFF</b>)\n`;
  } else if (deal.originalPrice && deal.dealPrice && deal.originalPrice > deal.dealPrice) {
    const origPriceStr = formatPriceCurrency(deal.originalPrice, country);
    originalPriceLine = `❌ Original Price: <s>${origPriceStr}</s> (<b>${deal.discountPercentage}% OFF</b>)\n`;
  }

  const ratingLine = deal.rating ? `⭐ Rating: <b>${deal.rating}/5</b>\n` : '';
  const couponLine = deal.coupon?.label ? `🎟️ <b>${deal.coupon.label}</b>\n` : '';
  
  // Format monetized affiliate link
  const affiliateBuyUrl = buildAffiliateUrl(deal.dealUrl, country, deal.merchant);
  const merchantName = (deal.merchant || 'Store').charAt(0).toUpperCase() + (deal.merchant || 'Store').slice(1);

  // Link to website product/deal page for price history charts & alerts
  const webDealUrl = getWebsiteDealUrl(deal);
  
  // Invisible link for image preview at top of post
  const imagePreviewLink = deal.imageUrl ? `<a href="${deal.imageUrl}">&#8203;</a>` : '';

  return `${imagePreviewLink}🔥 <b>${title}</b> 🔥

💰 Deal Price: <b>${dealPriceStr}</b>
${originalPriceLine}${couponLine}${ratingLine}
🛒 <b>Buy on ${merchantName}:</b> <a href="${affiliateBuyUrl}">Click Here to Shop</a>
📊 <b>Price History & Alerts:</b> <a href="${webDealUrl}">View on ShoppersDeals</a>

${channelUsername ? `<i>Join @${channelUsername} for more premium loot deals!</i>` : ''}`;
}

export async function publishTelegram(client, deal, channelDoc) {
  if (!client) {
    console.error('[Telegram Publisher Error] TelegramClient instance is undefined.');
    return false;
  }

  const targetChannel = (channelDoc.credentials?.channelUsername || '').replace('@', '').trim();
  if (!targetChannel) {
    console.error(`[Telegram Publisher Error] Channel ${channelDoc.name} has no channelUsername configured.`);
    return false;
  }

  console.log(`[Publisher:Telegram] Posting "${deal.title}" to @${targetChannel}...`);
  const formattedMessage = formatTelegramMessage(deal, targetChannel);

  try {
    await client.sendMessage(targetChannel, {
      message: formattedMessage,
      parseMode: 'html',
    });

    // Update OutputChannel stats
    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });

    return true;
  } catch (err) {
    console.error(`[Publisher:Telegram Error] Failed to publish to @${targetChannel}:`, err.message);
    return false;
  }
}
