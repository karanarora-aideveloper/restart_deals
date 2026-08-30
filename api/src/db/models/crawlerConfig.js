import mongoose from 'mongoose';

// Singleton document (one row, always looked up with no filter / upserted) holding the
// Bestseller Crawler's admin-controlled schedule. A real cron expression can't be edited live
// from the admin panel without a redeploy, so the scheduler instead ticks frequently (every few
// minutes, see startBestsellerCrawlerScheduler()) and compares `now` against `nextRunAt`, which
// this document tracks — the admin's "run every N hours" control just changes intervalHours,
// picked up on the very next tick.
const crawlerConfigSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: true
  },
  intervalHours: {
    type: Number,
    default: 24,
    min: 1,
    max: 168
  },
  isRunning: {
    type: Boolean,
    default: false
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  lastRunStats: {
    seedsCrawled: { type: Number, default: 0 },
    productsEnrolled: { type: Number, default: 0 },
    productsUpdated: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 }
  },
  nextRunAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const CrawlerConfig = mongoose.models.CrawlerConfig || mongoose.model('CrawlerConfig', crawlerConfigSchema, 'crawler_config');

export default CrawlerConfig;
