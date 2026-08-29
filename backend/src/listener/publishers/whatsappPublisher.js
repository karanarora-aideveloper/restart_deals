import OutputChannel from '../../db/models/outputChannel.js';

export function formatWhatsAppMessage(deal) {
  const title = deal.title || 'Special Deal';
  const dealPriceStr = deal.dealPrice ? `₹${deal.dealPrice.toLocaleString('en-IN')}` : 'Special Price';
  const origPriceStr = deal.originalPrice ? `₹${deal.originalPrice.toLocaleString('en-IN')}` : null;
  const discountStr = deal.discountPercentage ? `*${deal.discountPercentage}% OFF*` : '';

  let priceLine = `*Price:* ${dealPriceStr}`;
  if (origPriceStr) {
    priceLine += ` ~${origPriceStr}~ ${discountStr}`;
  }
  // Extra coupon the shopper applies on the merchant page, on top of the deal price
  const couponLine = deal.coupon?.label ? `\n🎟️ *${deal.coupon.label}*` : '';

  return `*🔥 ${title} 🔥*

💰 ${priceLine}${couponLine}
🛒 *Buy Now:* ${deal.dealUrl}

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
  const headers = {
    'Content-Type': 'application/json',
    ...(wahaApiKey ? { 'X-Api-Key': wahaApiKey } : {})
  };
  const message = formatWhatsAppMessage(deal);

  try {
    await simulateTyping(baseUrl, headers, session, chatId, message);

    let res;
    // Deals with an image go out as a photo + caption (matches how Telegram publishes them);
    // WAHA requires the image to be reachable over HTTP(S) — it fetches file.url itself.
    if (deal.imageUrl) {
      res = await fetch(`${baseUrl}/api/sendImage`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          session,
          chatId,
          file: { url: deal.imageUrl, mimetype: 'image/jpeg', filename: 'deal.jpg' },
          caption: message
        })
      });
    } else {
      res = await fetch(`${baseUrl}/api/sendText`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session, chatId, text: message })
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`WAHA ${res.status}: ${errBody}`);
    }

    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });

    console.log(`[Publisher:WhatsApp] ✓ Sent deal via WAHA for "${channelDoc.name}".`);
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
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: formatWhatsAppMessage(deal), deal })
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
    const text = formatWhatsAppMessage(deal);

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
