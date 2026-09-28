import mongoose from 'mongoose';

/**
 * DealChannelEvent — logged every time a product URL arrives from a Telegram channel.
 *
 * Purpose:
 *   - Track how many different channels post the same product deal.
 *   - Distinguish whether we actually went out to Amazon/Flipkart (event: 'scraped')
 *     or served from our local cache (event: 'cache_hit').
 *   - Power an admin view that shows per-channel overlap so redundant channels
 *     can be deprioritised or removed.
 *
 * NOT logged here:
 *   - dailyProductRefresher background sweeps (those come from the system, not Telegram).
 *   - bestsellerCrawler (same — internal engine, not a Telegram message).
 */
const dealChannelEventSchema = new mongoose.Schema({
  // What arrived
  productId:         { type: String, index: true },
  cleanUrl:          { type: String },
  merchant:          { type: String },

  // Where it came from
  sourceChannelId:   { type: String, index: true },
  sourceChannelName: { type: String, default: null },
  sourceMessageId:   { type: String },
  country:           { type: String, default: 'IN' },

  // Price seen in this event (from cache or fresh scrape)
  price:             { type: Number, default: null },

  // What the system did:
  //   'scraped'   — actual network request was made to the merchant store
  //   'cache_hit' — data was served from DB/cache, no store request made
  event:             { type: String, enum: ['scraped', 'cache_hit'], required: true },

  // How stale the cached data was (only meaningful when event === 'cache_hit')
  cacheAgeMinutes:   { type: Number, default: null },

  // Timestamp of this event
  createdAt:         { type: Date, default: Date.now, index: true },
}, {
  // No updatedAt — this is an append-only event log, records are never mutated.
  timestamps: false,
});

// Compound index for the most common query: "which channels posted this product?"
dealChannelEventSchema.index({ productId: 1, createdAt: -1 });
// Index for the per-channel overlap report
dealChannelEventSchema.index({ sourceChannelId: 1, createdAt: -1 });
// TTL: auto-delete events older than 90 days to keep the collection lean
dealChannelEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

const DealChannelEvent = mongoose.model('DealChannelEvent', dealChannelEventSchema, 'deal_channel_events');
export default DealChannelEvent;
