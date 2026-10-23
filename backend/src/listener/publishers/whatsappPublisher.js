import OutputChannel from '../../db/models/outputChannel.js';
import { buildAffiliateUrl, getWebsiteDealUrl, formatPriceCurrency } from '../../utils/affiliate.js';
import { hasHindiCharacters, translateHindiToEnglish } from '../../utils/languageUtils.js';

export async function formatWhatsAppMessage(deal) {
  let title = (deal.title || 'Special Deal').replace(/[\*\_\~]/g, '').replace(/\s+/g, ' ').trim();
  if (hasHindiCharacters(title)) {
    title = await translateHindiToEnglish(title);
    title = title.replace(/[\*\_\~]/g, '').replace(/\s+/g, ' ').trim();
  }
  const country = deal.country || 'IN';
  const dealPriceFormatted = formatPriceCurrency(deal.dealPrice, country);
  const dealPriceStr = dealPriceFormatted || 'Special Price';

  const priceLines = [];

  // 1. Maximum Retail Price (MRP / List price) on top
  if (deal.originalPrice && deal.dealPrice && deal.originalPrice > deal.dealPrice) {
    const origPriceStr = formatPriceCurrency(deal.originalPrice, country);
    if (origPriceStr) {
      priceLines.push(`❌ *MRP:* ~${origPriceStr}~`);
    }
  }

  // 2. Previous tracked price before the drop (if distinct and greater than dealPrice)
  if (deal.previousPrice && deal.dealPrice && deal.previousPrice > deal.dealPrice && deal.previousPrice !== deal.originalPrice) {
    const prevPriceStr = formatPriceCurrency(deal.previousPrice, country);
    if (prevPriceStr) {
      priceLines.push(`📉 *Previous Price:* ~${prevPriceStr}~`);
    }
  }

  // 3. Deal Price
  priceLines.push(`💥 *Deal Price:* ${dealPriceStr}`);

  // 4. Price Drop percentage and total savings
  let baselinePrice = null;
  const prevDiff = (deal.previousPrice && deal.dealPrice && deal.previousPrice > deal.dealPrice)
    ? Math.abs((deal.discountPercentage || 0) - Math.round(((deal.previousPrice - deal.dealPrice) / deal.previousPrice) * 100))
    : 999;
  const origDiff = (deal.originalPrice && deal.dealPrice && deal.originalPrice > deal.dealPrice)
    ? Math.abs((deal.discountPercentage || 0) - Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100))
    : 999;

  if (prevDiff <= 1) {
    baselinePrice = deal.previousPrice;
  } else if (origDiff <= 1) {
    baselinePrice = deal.originalPrice;
  } else if (deal.originalPrice && deal.dealPrice && deal.originalPrice > deal.dealPrice) {
    baselinePrice = deal.originalPrice;
  } else if (deal.previousPrice && deal.dealPrice && deal.previousPrice > deal.dealPrice) {
    baselinePrice = deal.previousPrice;
  }

  let discountPercent = deal.discountPercentage;
  if ((!discountPercent || discountPercent <= 0) && baselinePrice && deal.dealPrice && baselinePrice > deal.dealPrice) {
    discountPercent = Math.round(((baselinePrice - deal.dealPrice) / baselinePrice) * 100);
  }

  let savingsStr = '';
  if (baselinePrice && deal.dealPrice && baselinePrice > deal.dealPrice) {
    const savingsAmount = baselinePrice - deal.dealPrice;
    const formattedSavings = formatPriceCurrency(savingsAmount, country);
    if (formattedSavings) {
      savingsStr = ` (Save ${formattedSavings})`;
    }
  }

  if (discountPercent && discountPercent > 0) {
    priceLines.push(`🏷️ *Price Drop:* *${discountPercent}% OFF*${savingsStr}`);
  }

  // 5. Extra Perks (Coupon, Bank Offer, Urgency) - Rating omitted per user request
  if (deal.coupon?.label) {
    priceLines.push(`🎟️ *Coupon:* ${deal.coupon.label}`);
  }

  if (deal.bankOfferPrice && deal.dealPrice && deal.bankOfferPrice < deal.dealPrice) {
    const bankPriceStr = formatPriceCurrency(deal.bankOfferPrice, country);
    if (bankPriceStr) {
      priceLines.push(`💳 *Bank Offer:* ${bankPriceStr} with select cards`);
    }
  }

  if (deal.stockScarcity?.rawText) {
    priceLines.push(`⚡ *Stock:* ${deal.stockScarcity.rawText}`);
  } else if (deal.stockScarcity?.unitsLeft) {
    priceLines.push(`⚡ *Stock:* Only ${deal.stockScarcity.unitsLeft} left in stock!`);
  }

  const affiliateBuyUrl = deal._id
    ? `https://www.shoppersdeals.in/r/${deal._id}?src=wa`
    : buildAffiliateUrl(deal.dealUrl, country, deal.merchant);
  const webDealUrl = getWebsiteDealUrl(deal);
  const rawMerchant = (deal.merchant || 'Store');
  const merchantName = rawMerchant.charAt(0).toUpperCase() + rawMerchant.slice(1);

  return `🔥 *${title}* 🔥

${priceLines.join('\n')}

🛒 *Buy on ${merchantName}:*
${affiliateBuyUrl}

📊 *Price History & Alerts:*
${webDealUrl}

_Shared via ShoppersDeals_`;
}

// Telegram/Meta chatIds and phone numbers are plain digits; WAHA needs the `@c.us` (user)
// or `@g.us` (group) suffix. Pass a full chatId through untouched (admin can target a group),
// otherwise treat it as a phone number and default to an individual chat.
function toWahaChatId(raw) {
  const value = (raw || '').trim();
  if (!value) return '';
  return value.includes('@') ? value : `${value.replace(/[^\d]/g, '')}@c.us`;
}

// WAHA's own docs recommend this: it doesn't send "typing" automatically, so a bot that
// never types reads as a bot. We flip the chat to "typing" for a duration roughly scaled to
// message length, then send — this is also a second, real signal to WhatsApp's anti-spam
// heuristics that the account behaves like a human client, not just a bare API caller.
// Presence is cosmetic — any failure here is swallowed so it never blocks the real send.
async function simulateTyping(baseUrl, headers, session, chatId, message) {
  // WhatsApp Newsletters / Channels do not support sendStateTyping
  if (chatId && chatId.includes('@newsletter')) return;

  try {
    await fetch(`${baseUrl}/api/${session}/presence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ chatId, presence: 'typing' })
    });
    const typingMs = Math.min(4000, Math.max(1200, (message?.length || 20) * 30));
    await new Promise((resolve) => setTimeout(resolve, typingMs));
  } catch (err) {
    console.warn(`[Publisher:WhatsApp] Typing presence call failed (non-fatal): ${err.message}`);
  }
}

async function publishViaWaha(deal, channelDoc) {
  const { wahaBaseUrl, wahaApiKey, wahaSession, recipientPhoneNumber } = channelDoc.credentials || {};
  const chatId = toWahaChatId(recipientPhoneNumber);

  if (!wahaBaseUrl || !chatId) {
    console.warn(`[Publisher:WhatsApp Warning] Channel "${channelDoc.name}" missing WAHA baseUrl or recipient. Skipping post.`);
    return false;
  }

  const baseUrl = wahaBaseUrl.replace(/\/+$/, '');
  const session = wahaSession || 'default';
  const apiKey = wahaApiKey || process.env.WAHA_API_KEY || 'shoppersdeals_waha_key_2026';
  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-Api-Key': apiKey } : {})
  };
  const message = await formatWhatsAppMessage(deal);

  try {
    await simulateTyping(baseUrl, headers, session, chatId, message);

    // Send formatted deal text with native WhatsApp link preview.
    // Avoid sending raw image file attachments which clutter followers' phone storage and cause group member churn.
    const textRes = await fetch(`${baseUrl}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session,
        chatId,
        text: message,
        linkPreview: true
      })
    });

    if (!textRes.ok) {
      const errBody = await textRes.text().catch(() => '');
      throw new Error(`WAHA sendText ${textRes.status}: ${errBody}`);
    }

    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });

    console.log(`[Publisher:WhatsApp] ✓ Sent deal with link preview via WAHA to "${channelDoc.name}".`);
    return true;
  } catch (err) {
    console.error(`[Publisher:WhatsApp Error] WAHA call failed for "${channelDoc.name}":`, err.message);
    return false;
  }
}

async function publishViaWebhook(deal, channelDoc) {
  const { webhookUrl } = channelDoc.credentials || {};
  try {
    console.log(`[Publisher:WhatsApp] Sending deal to webhook for "${channelDoc.name}"...`);
    const formattedText = await formatWhatsAppMessage(deal);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: formattedText, deal })
    });
    // Unlike the WAHA/Meta paths below, this never checked res.ok — a webhook returning
    // 4xx/5xx, or unreachable behind a since-changed URL, still reported success and
    // incremented stats.dealsPublished.
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Webhook ${res.status}: ${errBody}`);
    }
    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });
    return true;
  } catch (err) {
    console.error(`[Publisher:WhatsApp Error] Webhook post failed for "${channelDoc.name}":`, err.message);
    return false;
  }
}

async function publishViaMetaCloudApi(deal, channelDoc) {
  const { phoneNumberId, accessToken, recipientPhoneNumber } = channelDoc.credentials || {};
  if (!phoneNumberId || !accessToken || !recipientPhoneNumber) {
    console.warn(`[Publisher:WhatsApp Warning] Channel "${channelDoc.name}" missing Meta Cloud API credentials. Skipping post.`);
    return false;
  }

  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    const text = await formatWhatsAppMessage(deal);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipientPhoneNumber,
        type: 'text',
        text: { body: text }
      })
    });

    if (!res.ok) {
      const errJson = await res.json();
      throw new Error(JSON.stringify(errJson));
    }

    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });

    console.log(`[Publisher:WhatsApp] ✓ Successfully posted deal to WhatsApp for "${channelDoc.name}".`);
    return true;
  } catch (err) {
    console.error(`[Publisher:WhatsApp Error] Meta Cloud API call failed for "${channelDoc.name}":`, err.message);
    return false;
  }
}

export async function publishWhatsApp(deal, channelDoc) {
  const provider = channelDoc.credentials?.provider;

  // Explicit provider (set by the admin's channel form) always wins.
  if (provider === 'waha') return publishViaWaha(deal, channelDoc);
  if (provider === 'webhook') return publishViaWebhook(deal, channelDoc);
  if (provider === 'meta') return publishViaMetaCloudApi(deal, channelDoc);

  // Legacy channels saved before `provider` existed: infer from whichever fields are set.
  if (channelDoc.credentials?.webhookUrl) return publishViaWebhook(deal, channelDoc);
  if (channelDoc.credentials?.wahaBaseUrl) return publishViaWaha(deal, channelDoc);
  return publishViaMetaCloudApi(deal, channelDoc);
}
