import mongoose from 'mongoose';

// One row per (store, category, subcategory) the Bestseller Crawler watches. Each seed is an
// Amazon (or future merchant) SEARCH page keyword query, not a single product — the crawler
// re-derives the current top-N ranked items from it on every run, which is the whole point:
// unlike a hardcoded product list, this tracks whatever is currently trending for that keyword.
const crawlerSeedSchema = new mongoose.Schema({
  store: {
    type: String,
    default: 'amazon'
  },
  category: {
    type: String,
    required: true
  },
  subcategory: {
    type: String,
    required: true
  },
  // The raw search keywords, e.g. "wireless earbuds headphones" — kept separate from the
  // constructed URL so the admin panel can edit just the words, not a full querystring.
  keywords: {
    type: String,
    required: true
  },
  // Full Amazon search URL this resolves to right now — kept in sync with `keywords`/`store`
  // by the buildSeedUrl() helper on every save (see crawlerSeed hooks below), so nothing else
  // has to remember Amazon's search URL shape.
  url: {
    type: String,
    required: true
  },
  // How many ranked results to pull off the search page per run (Amazon's page 1 typically
  // has 40-60+ results; 20 is this pipeline's existing convention — see parseAmazonBestsellerItems).
  topN: {
    type: Number,
    default: 20,
    min: 1,
    max: 60
  },
  isEnabled: {
    type: Boolean,
    default: true
  },
  lastRunAt: {
    type: Date,
    default: null
  },
  lastResult: {
    found: { type: Number, default: 0 },
    enrolled: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    error: { type: String, default: null }
  }
}, { timestamps: true });

crawlerSeedSchema.index({ isEnabled: 1 });
crawlerSeedSchema.index({ category: 1, subcategory: 1 }, { unique: true });

const CrawlerSeed = mongoose.models.CrawlerSeed || mongoose.model('CrawlerSeed', crawlerSeedSchema, 'crawler_seeds');

export default CrawlerSeed;
