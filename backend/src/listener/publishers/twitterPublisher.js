import OutputChannel from '../../db/models/outputChannel.js';
import XAccount from '../../db/models/xAccount.js';

export function formatTweetMessage(deal) {
  const title = deal.title || 'Hot Deal!';
  const priceStr = deal.dealPrice ? `₹${deal.dealPrice}` : '';
  const discountStr = deal.discountPercentage ? `(${deal.discountPercentage}% OFF)` : '';
  const link = deal.dealUrl || '';

  const couponStr = deal.coupon?.label ? `\n🎟️ ${deal.coupon.label}` : '';

  // Twitter text limit is 280 chars
  let text = `🔥 ${title}\n\n💰 Price: ${priceStr} ${discountStr}${couponStr}\n🛒 Buy: ${link}\n#Deals #Loot #Discount`;
  if (text.length > 280) {
    const trimmedTitle = title.substring(0, 100) + '...';
    text = `🔥 ${trimmedTitle}\n\n💰 Price: ${priceStr} ${discountStr}${couponStr}\n🛒 Buy: ${link}\n#Deals #Loot`;
  }
  // Coupon is the first thing dropped if we're still over — the link matters more
  if (text.length > 280 && couponStr) {
    text = text.replace(couponStr, '');
  }
  return text;
}

// Deal images attach via the classic v1.1-style media/upload.json endpoint (client.v1.uploadMedia),
// NOT the newer split /2/media/upload/{initialize,append,finalize} endpoints — those reject
// OAuth 1.0a with a 401 (confirmed on X's own developer forum). uploadMedia needs a Buffer,
// so unlike WAHA (which hands WhatsApp a URL and lets it fetch), we download the image ourselves.
async function uploadDealImage(twitterClient, imageUrl) {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/jpeg';
    return await twitterClient.v1.uploadMedia(buffer, { mimeType });
  } catch (err) {
    console.warn(`[Publisher:Twitter] Image upload failed, posting text-only: ${err.message}`);
    return null;
  }
}

// Centralized accounts (credentials.xAccountId) are the current path — one XAccount's
// OAuth 1.0a keys can back several routing rows without duplicating secrets per row (same
// shape as the WAHA "connection" concept). Direct inline credentials on the channel itself
// are kept as a fallback for any row saved before this existed.
async function resolveOAuth1(channelDoc) {
  const xAccountId = channelDoc.credentials?.xAccountId;
  if (xAccountId) {
    const account = await XAccount.findById(xAccountId);
    if (!account) {
      console.warn(`[Twitter Publisher Warning] Channel "${channelDoc.name}" points at a deleted X account (${xAccountId}).`);
      return null;
    }
    if (!account.isActive) {
      console.warn(`[Twitter Publisher Warning] X account "${account.label}" is marked inactive. Skipping post.`);
      return null;
    }
    return account.oauth1 || {};
  }
  return channelDoc.credentials || {};
}

export async function publishTwitter(deal, channelDoc) {
  const oauth1 = await resolveOAuth1(channelDoc);
  const { apiKey, apiSecret, accessToken, accessSecret } = oauth1 || {};

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.warn(`[Twitter Publisher Warning] Channel "${channelDoc.name}" missing OAuth credentials. Skipping actual API post.`);
    return false;
  }

  try {
    const { TwitterApi } = await import('twitter-api-v2');
    const twitterClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessSecret,
    });

    const tweetText = formatTweetMessage(deal);
    console.log(`[Publisher:Twitter] Tweeting to channel "${channelDoc.name}"...`);

    const mediaId = deal.imageUrl ? await uploadDealImage(twitterClient, deal.imageUrl) : null;
    await twitterClient.v2.tweet(mediaId ? { text: tweetText, media: { media_ids: [mediaId] } } : tweetText);

    await OutputChannel.findByIdAndUpdate(channelDoc._id, {
      $inc: { 'stats.dealsPublished': 1 },
      $set: { 'stats.lastPublishedAt': new Date() }
    });

    console.log(`[Publisher:Twitter] ✓ Successfully tweeted deal to "${channelDoc.name}".`);
    return true;
  } catch (err) {
    console.error(`[Publisher:Twitter Error] Failed to tweet for "${channelDoc.name}":`, err.message);
    return false;
  }
}
