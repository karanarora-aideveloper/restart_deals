import { Queue } from 'bullmq';
import { createRedisConnection } from '../utils/redis.js';

let queueInstance = null;

export function getDealPublishQueue() {
  if (queueInstance) return queueInstance;

  try {
    const connection = createRedisConnection();
    queueInstance = new Queue('deal-publish-queue', {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
      },
    });

    console.log('[DealPublishQueue] Initialized BullMQ queue "deal-publish-queue".');
  } catch (err) {
    console.error('[DealPublishQueue Error] Failed to initialize queue:', err.message);
  }

  return queueInstance;
}

/**
 * Enqueue a deal for publication to Telegram, Twitter, and WhatsApp channels.
 *
 * @param {string|object} dealId - Deal ObjectId or string
 * @param {object} options - Optional metadata (e.g. { priority, sourceEngine })
 * @returns {Promise<object|null>} BullMQ Job
 */
export async function enqueueDealForPublishing(dealId, options = {}) {
  const queue = getDealPublishQueue();
  if (!queue) {
    console.warn('[DealPublishQueue Warning] Queue not available. Skipping enqueue.');
    return null;
  }

  const idStr = dealId?._id ? dealId._id.toString() : dealId.toString();
  const sourceEngine = options.sourceEngine || 'unknown';

  try {
    const job = await queue.add(
      'broadcast-deal',
      { dealId: idStr, sourceEngine, enqueuedAt: Date.now() },
      { priority: options.priority || 3 }
    );
    console.log(`[DealPublishQueue] 📤 Enqueued deal ${idStr} for publishing [Job #${job.id}, Engine: ${sourceEngine}]`);
    return job;
  } catch (err) {
    console.error(`[DealPublishQueue Error] Failed to enqueue deal ${idStr}:`, err.message);
    return null;
  }
}
