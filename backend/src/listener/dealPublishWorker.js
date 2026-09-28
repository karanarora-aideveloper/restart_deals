import { Worker } from 'bullmq';
import { createRedisConnection } from '../utils/redis.js';
import Deal from '../db/models/deal.js';
import OutputChannel from '../db/models/outputChannel.js';
import { publishToTelegram } from './publisher.js';
import { getTelegramClient } from './telegram.js';

let workerInstance = null;

// Track the last time a post was published per channel (for 60-second pacing)
const lastChannelPublishTimes = new Map();

// Minimum interval between broadcasts per channel (default: 60 seconds)
const CHANNEL_PACING_MS = parseInt(process.env.BROADCAST_PACING_SECONDS || '60', 10) * 1000;

// 12-hour Yo-Yo pricing cooldown window (12 hours in ms)
const YOYO_COOLDOWN_MS = 12 * 60 * 60 * 1000;

/**
 * Check if the product was already published to the channel within the 12-hour cooldown window
 * at the same or lower price.
 */
async function isWithinYoYoCooldown(deal) {
  if (!deal.productId) return false;

  const twelveHoursAgo = new Date(Date.now() - YOYO_COOLDOWN_MS);

  // Look for any existing deal for the same product published in the last 12 hours
  const priorPublishedDeal = await Deal.findOne({
    productId: deal.productId,
    _id: { $ne: deal._id },
    createdAt: { $gte: twelveHoursAgo },
    'publishedStatus.publishedTo.0': { $exists: true },
  }).sort({ createdAt: -1 });

  if (!priorPublishedDeal) return false;

  // If prior deal was at the same or lower price, skip re-broadcasting
  if (priorPublishedDeal.dealPrice && deal.dealPrice >= priorPublishedDeal.dealPrice) {
    return true;
  }

  return false;
}

/**
 * Initialize BullMQ Deal Publish Worker
 */
export function initDealPublishWorker() {
  if (workerInstance) return workerInstance;

  console.log('[DealPublishWorker] Starting worker on "deal-publish-queue"...');
  const redisConnection = createRedisConnection();

  workerInstance = new Worker(
    'deal-publish-queue',
    async (job) => {
      const { dealId, sourceEngine } = job.data;
      console.log(`[DealPublishWorker] 📥 Processing publish job #${job.id} for deal ${dealId} (Engine: ${sourceEngine})...`);

      const deal = await Deal.findById(dealId);
      if (!deal) {
        console.warn(`[DealPublishWorker Warning] Deal ${dealId} not found in DB. Skipping.`);
        return { status: 'skipped', reason: 'deal_not_found' };
      }

      if (deal.isExpired) {
        console.log(`[DealPublishWorker] Deal ${dealId} is already marked expired. Skipping broadcast.`);
        return { status: 'skipped', reason: 'deal_expired' };
      }

      // Trust Gate: Items with poor rating (< 3.8 stars) are suppressed from public broadcast
      if (deal.rating && deal.rating < 3.8) {
        console.log(`[DealPublishWorker] Deal "${deal.title}" rating (${deal.rating}/5) is below 3.8 threshold. Skipping main broadcast.`);
        return { status: 'skipped', reason: 'rating_below_trust_gate' };
      }

      // Yo-Yo Pricing Cooldown: 12-hour cooldown for same product at same price
      const isYoYo = await isWithinYoYoCooldown(deal);
      if (isYoYo) {
        console.log(`[DealPublishWorker] ⏸️ Yo-Yo Cooldown active for "${deal.title}" (published in last 12h at <= price). Skipping broadcast.`);
        return { status: 'skipped', reason: 'yoyo_cooldown' };
      }

      // Check if TelegramClient is ready
      const client = getTelegramClient();
      if (!client || !client.connected) {
        console.warn('[DealPublishWorker Warning] TelegramClient not yet connected. Will retry job in 10s...');
        throw new Error('TelegramClient not connected');
      }

      // Pacing delay: Ensure minimum 60s gap since last publish
      const now = Date.now();
      const lastGlobalPublish = lastChannelPublishTimes.get('global') || 0;
      const elapsedMs = now - lastGlobalPublish;

      if (elapsedMs < CHANNEL_PACING_MS) {
        const waitMs = CHANNEL_PACING_MS - elapsedMs;
        console.log(`[DealPublishWorker] ⏳ Pacing broadcaster: waiting ${Math.round(waitMs / 1000)}s before posting...`);
        await new Promise((r) => setTimeout(r, waitMs));
      }

      // Publish through universal multi-channel publisher (Telegram, Twitter, WhatsApp)
      const success = await publishToTelegram(client, deal);
      lastChannelPublishTimes.set('global', Date.now());

      if (success) {
        console.log(`[DealPublishWorker] ✓ Successfully broadcast deal "${deal.title}" to output channels.`);
      }

      return { status: success ? 'published' : 'failed' };
    },
    {
      connection: redisConnection,
      concurrency: 1, // Single-flight paced dispatcher
      limiter: {
        max: 1,
        duration: 15000, // Hard ceiling: max 1 per 15s
      },
    }
  );

  workerInstance.on('completed', (job, result) => {
    console.log(`[DealPublishWorker] ✓ Job #${job.id} completed: ${result?.status || 'done'}`);
  });

  workerInstance.on('failed', (job, err) => {
    console.error(`[DealPublishWorker Error] ✕ Job #${job?.id} failed:`, err.message);
  });

  return workerInstance;
}
