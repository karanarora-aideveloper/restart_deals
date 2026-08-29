import Deal from '../../db/models/deal.js';
import OutputChannel from '../../db/models/outputChannel.js';

export function formatTelegramMessage(deal, channelUsername) {
  const title = deal.title || 'Special Deal';
  const dealPriceStr = deal.dealPrice 
    ? `₹${deal.dealPrice.toLocaleString('en-IN')}` 
    : 'Special Price';

  // A price_history deal has no originalPrice (that's precisely why it took this path — see
  // verifier.js) so this used to render nothing at all: a bare price with zero drop context,
  // even though we know exactly what it fell from (deal.previousPrice). Show that instead.
  let originalPriceLine = '';
  if (deal.priceSource === 'price_history' && deal.previousPrice && deal.dealPrice && deal.previousPrice > deal.dealPrice) {
    const priorPriceStr = `₹${deal.previousPrice.toLocaleString('en-IN')}`;
    originalPriceLine = `📉 Price Dropped: <s>${priorPriceStr}</s> (<b>${deal.discountPercentage}% OFF</b>)\n`;
  } else if (deal.originalPrice && deal.dealPrice && deal.originalPrice > deal.dealPrice) {
    const origPriceStr = `₹${deal.originalPrice.toLocaleString('en-IN')}`;
    originalPriceLine = `❌ Original Price: <s>${origPriceStr}</s> (<b>${deal.discountPercentage}% OFF</b>)\n`;
  }

  const ratingLine = deal.rating ? `⭐ Rating: <b>${deal.rating}/5</b>\n` : '';
  // Extra coupon the shopper applies on the merchant page, on top of the deal price
  const couponLine = deal.coupon?.label ? `🎟️ <b>${deal.coupon.label}</b>\n` : '';
  const cleanUrl = deal.dealUrl;
  
  // Invisible link for image preview at top of post
  const imagePreviewLink = deal.imageUrl ? `<a href="${deal.imageUrl}">&#8203;</a>` : '';

  return `${imagePreviewLink}🔥 <b>${title}</b> 🔥

💰 Deal Price: <b>${dealPriceStr}</b>
${originalPriceLine}${couponLine}${ratingLine}
🛒 <b>Buy Link:</b> <a href="${cleanUrl}">Click Here to Shop</a>

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
