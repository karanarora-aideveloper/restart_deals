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

      const success = await publishTelegram(client, deal, fallbackDoc);
      if (success) {
        await Deal.findByIdAndUpdate(deal._id, {
          'publishedStatus.telegram': true,
          updatedAt: new Date()
        });
      }
      return success;
    }

    let anySuccess = false;
    const publishedChannelIds = [];

    // Publish to all matching channels concurrently
    for (const channelDoc of activeOutputChannels) {
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
        publishedChannelIds.push(channelDoc._id);
      }
    }

    // Mark published status in Deal record
    if (anySuccess) {
      await Deal.findByIdAndUpdate(deal._id, {
        'publishedStatus.telegram': true,
        $addToSet: {
          'publishedStatus.outputChannels': { $each: publishedChannelIds }
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
