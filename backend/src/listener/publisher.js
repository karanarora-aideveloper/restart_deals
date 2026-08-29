import config from '../config.js';
import Deal from '../db/models/deal.js';
import OutputChannel from '../db/models/outputChannel.js';
import { publishTelegram, formatTelegramMessage } from './publishers/telegramPublisher.js';
import { publishTwitter } from './publishers/twitterPublisher.js';
import { publishWhatsApp } from './publishers/whatsappPublisher.js';

// Re-export for backward compatibility
export { formatTelegramMessage as formatDealMessage };

// A channel with rateLimitMinutes set only accepts one send per cooldown window — a deal
// that arrives mid-cooldown is skipped for that channel (not queued for later), trading a
// dropped deal for not tripping WhatsApp's (or any provider's) spam/rate-limit detection.
function isRateLimited(channelDoc) {
  const limitMinutes = channelDoc.rateLimitMinutes;
  if (!limitMinutes || limitMinutes <= 0) return false;
  const lastPublishedAt = channelDoc.stats?.lastPublishedAt;
  if (!lastPublishedAt) return false;
  const elapsedMs = Date.now() - new Date(lastPublishedAt).getTime();
  return elapsedMs < limitMinutes * 60 * 1000;
}

/**
 * A stable identity for "where this deal was actually sent", independent of which code
 * path sent it or whether a real OutputChannel document exists for it.
 *
 * This is the dedup key idempotency is built on, rather than OutputChannel._id, because
 * the fallback .env channel (used when zero DB channels match) has no _id at all — and,
 * critically, can point at the exact same physical Telegram channel a real OutputChannel
 * doc also points at (that's the normal case here: the fallback username and the "General
 * Deals" channel's username are the same handle). An admin editing a channel's country/
 * category to match more deals — the ordinary, expected kind of config change — otherwise
 * makes every deal that channel is a coincidental fallback-match for start matching it for
 * real, and an ID-only check can't see they already reached the same destination.
 */
function destinationKey(platform, channelDoc) {
  if (platform === 'telegram') {
    const handle = (channelDoc.credentials?.channelUsername || '').toLowerCase().replace(/^@/, '');
    return `telegram:${handle}`;
  }
  // Twitter/WhatsApp have no fallback path (see below), so a real OutputChannel doc always
  // exists for them and its _id is a stable, sufficient identity.
  return `${platform}:${channelDoc._id}`;
}

/**
 * Publish deal to all active OutputChannels matching the deal's country and category.
 * Falls back to default .env config if no OutputChannels exist in DB.
 *
 * @param {TelegramClient} client
 * @param {object} deal
 * @returns {Promise<boolean>}
 */
export async function publishToTelegram(client, deal) {
  try {
    const dealCountry = deal.country || 'IN';
    const dealCategory = deal.category || 'general';

    // Find all matching active channels
    const activeOutputChannels = await OutputChannel.find({
      isActive: true,
      country: { $in: [dealCountry, 'all'] },
      category: { $in: [dealCategory, 'all'] }
    });

    console.log(`[Publisher] Found ${activeOutputChannels.length} active output channels matching Country="${dealCountry}", Category="${dealCategory}".`);

    // Idempotency: verifyAndProcessMessage() returns a deal both when it creates a NEW one
    // and when it re-verifies and UPDATES an existing one (the same product re-seen more
    // than 60min after last processing — e.g. reposted from a different source channel, or
    // just seen again later, or newly matching a channel whose country/category an admin
    // just edited). The caller in telegram.js publishes on any truthy return, with no
    // distinction between the two, so without this every re-verification re-sent the deal
    // to every destination it resolves to — see destinationKey() above for why that has to
    // be checked by actual destination, not by OutputChannel._id or a single boolean.
    const alreadySent = new Set(deal.publishedStatus?.publishedTo || []);

    // Fallback: If DB output_channels collection is empty, publish to default Telegram channel from .env
    if (activeOutputChannels.length === 0) {
      console.log('[Publisher] No custom OutputChannels found in DB. Falling back to default .env Telegram channel configuration.');
      const fallbackUsername = dealCategory === 'fitness'
        ? config.telegram.fitnessChannel
        : config.telegram.generalChannel;

      const fallbackDoc = {
        _id: null,
        name: `Default Telegram (${dealCategory})`,
        platform: 'telegram',
        credentials: { channelUsername: fallbackUsername }
      };
      const key = destinationKey('telegram', fallbackDoc);

      if (alreadySent.has(key)) {
        console.log(`[Publisher] Deal "${deal.title}" already published to ${key}. Skipping re-publish.`);
        return true;
      }

      const success = await publishTelegram(client, deal, fallbackDoc);
      if (success) {
        await Deal.findByIdAndUpdate(deal._id, {
          'publishedStatus.telegram': true,
          $addToSet: { 'publishedStatus.publishedTo': key },
          updatedAt: new Date()
        });
      }
      return success;
    }

    const channelsToPublish = activeOutputChannels.filter(
      c => !alreadySent.has(destinationKey(c.platform, c))
    );

    if (channelsToPublish.length === 0) {
      console.log(`[Publisher] Deal "${deal.title}" already published to all ${activeOutputChannels.length} matching destination(s). Skipping re-publish.`);
      return true;
    }
    if (channelsToPublish.length < activeOutputChannels.length) {
      console.log(`[Publisher] Deal "${deal.title}" already published to ${activeOutputChannels.length - channelsToPublish.length} destination(s); publishing to ${channelsToPublish.length} new match(es) only.`);
    }

    let anySuccess = false;
    let anyTelegramSuccess = false;
    const publishedChannelIds = [];
    const publishedKeys = [];

    // Publish to all matching, not-yet-published destinations
    for (const channelDoc of channelsToPublish) {
      let success = false;

      if (isRateLimited(channelDoc)) {
        const sinceMin = Math.round((Date.now() - new Date(channelDoc.stats.lastPublishedAt).getTime()) / 60000);
        console.log(`[Publisher] Skipping "${channelDoc.name}" — rate limit of ${channelDoc.rateLimitMinutes}min set, only ${sinceMin}min since last send.`);
        continue;
      }

      if (channelDoc.platform === 'telegram') {
        success = await publishTelegram(client, deal, channelDoc);
      } else if (channelDoc.platform === 'twitter') {
        success = await publishTwitter(deal, channelDoc);
      } else if (channelDoc.platform === 'whatsapp') {
        success = await publishWhatsApp(deal, channelDoc);
      }

      if (success) {
        anySuccess = true;
        if (channelDoc.platform === 'telegram') anyTelegramSuccess = true;
        publishedChannelIds.push(channelDoc._id);
        publishedKeys.push(destinationKey(channelDoc.platform, channelDoc));
      }
    }

    // Mark published status in Deal record
    if (anySuccess) {
      await Deal.findByIdAndUpdate(deal._id, {
        ...(anyTelegramSuccess ? { 'publishedStatus.telegram': true } : {}),
        $addToSet: {
          'publishedStatus.outputChannels': { $each: publishedChannelIds },
          'publishedStatus.publishedTo': { $each: publishedKeys }
        },
        updatedAt: new Date()
      });
    }

    return anySuccess;
  } catch (err) {
    console.error('[Publisher Main Error] Execution failed:', err.message);
    return false;
  }
}
