import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  author: { type: String },
  headline: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: mongoose.Schema.Types.Mixed },
  verifiedPurchase: { type: Boolean, default: false }
}, { _id: false });

const priceHistorySchema = new mongoose.Schema({
  date: { type: String }, // 'YYYY-MM-DD'
  price: { type: Number },
  originalPrice: { type: Number },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const variantSkuSchema = new mongoose.Schema({
  skuId: { type: String },
  shadeName: { type: String, default: null },
  size: { type: String, default: null },
  price: { type: Number },
  previousPrice: { type: Number, default: null },
  inStock: { type: Boolean, default: true },
  url: { type: String, default: null }
}, { _id: false });

const bankOfferSchema = new mongoose.Schema({
  bank: { type: String },
  discountAmount: { type: Number },
  effectivePrice: { type: Number },
  description: { type: String }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { 
    type: String, 
    required: true
  },
  cleanUrl: { 
    type: String, 
    required: true 
  },
  merchant: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String 
  },
  brand: {
    type: String,
    default: null
  },
  images: [{ 
    type: String 
  }],
  imageUrl: {
    type: String
  },
  aboutThisItem: [{
    type: String
  }],
  technicalSpecifications: {
    type: Map,
    of: String,
    default: {}
  },
  aiSummary: {
    type: String,
    default: null
  },
  metadataUpdatedAt: {
    type: Date,
    default: Date.now
  },
  rating: { 
    type: Number 
  },
  reviews: [reviewSchema],
  price: {
    type: Number
  },
  // Substitute-MRP baseline for the price-history discount fallback (see backend/src/listener/
  // verifier.js) — only set on a genuine (>=5%) drop against our own last recorded price, used
  // when no real scraped/text MRP was available. Distinct from originalPrice.
  previousPrice: {
    type: Number
  },
  priceSource: {
    type: String,
    enum: ['scraped', 'ai_text', 'price_history', 'extension', 'user_search']
  },
  originalPrice: {
    type: Number
  },
  priceUpdatedAt: {
    type: Date,
    default: Date.now
  },
  priceHistory: [priceHistorySchema],
  // No hardcoded enum — valid values are managed dynamically via the Master collection
  // (type: 'category'). A stale hardcoded list here would reject any category added
  // after this schema was written (electronics/fashion/home/beauty all postdate it).
  category: {
    type: String,
    default: 'home'
  },
  // Same story as category — no hardcoded enum, values managed via the Master collection
  // (type: 'subcategory', metadata.parentCategory pointing at the category id). Empty string
  // means "not yet classified" (older products backfilled after this field was introduced, or
  // the AI classifier didn't find a confident subcategory match).
  subcategory: {
    type: String,
    default: 'decor'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Mirrors backend/src/db/models/product.js — true for a product seen mentioned but not yet
  // fully verified (missing image/price/genuine discount). Must be declared here too or
  // Mongoose strips it from API responses (this service is what the admin dashboard and app
  // actually read from).
  needsEnrichment: {
    type: Boolean,
    default: false
  },
  // Admin-facing "this record looks wrong" flag — a human judgment call (bad title, wrong
  // image, garbage price, mismatched product), distinct from needsEnrichment (which is the
  // pipeline's own "I don't have enough data yet" signal). Mirrors backend/src/db/models/
  // product.js — must be declared here too or Mongoose strips it from API responses.
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    default: ''
  },
  flaggedAt: {
    type: Date
  },
  // Extracted variant/size information (weight, volume, pack size).
  // Used to detect mismatches when comparing prices across stores —
  // e.g. Amazon 2 kg vs Flipkart 1 kg should NOT be compared directly.
  variant: {
    raw: { type: String, default: null },       // raw matched text, e.g. "8 GB RAM / 256 GB • Blue"
    display: { type: String, default: null },   // formatted label, e.g. "256 GB • Blue" or "Shade: 128 Warm Nude"
    weightGrams: { type: Number, default: null }, // single-unit weight in grams
    packSize: { type: Number, default: 1 },       // number of units in pack
    totalGrams: { type: Number, default: null }, // weightGrams * packSize
    storageGb: { type: Number, default: null },  // tech storage in GB
    ramGb: { type: Number, default: null },      // tech RAM in GB
    color: { type: String, default: null },      // tech/fashion color
    shade: { type: String, default: null },      // cosmetic/beauty shade
    type: { type: String, default: null },       // 'weight'|'volume'|'count'|'piece'|'tech_storage'|'shade'
  },
  // Multi-shade/size SKUs for beauty & fashion
  variants: [variantSkuSchema],
  // Active bank & card promotions
  bankOffers: [bankOfferSchema],
  // Discovery engine source tracking
  productSource: {
    type: String,
    enum: ['telegram', 'top20_catalog', 'user_search', 'bestseller', 'extension', 'extension_discovered', 'web_user'],
    default: 'telegram'
  },
  // Extension & User attribution tracking
  discoveredBy: {
    source: {
      type: String,
      default: null,
    },
    userId: {
      type: String,
      default: null,
    },
    sourceUrl: {
      type: String,
      default: null,
    },
    extensionVersion: {
      type: String,
      default: null,
    },
    discoveredAt: {
      type: Date,
      default: null,
    },
  },
  isTrackedByExtension: {
    type: Boolean,
    default: false,
    index: true,
  },
  extensionUsers: {
    type: [String],
    default: [],
  },
  extensionViewsCount: {
    type: Number,
    default: 0,
  },
  lastExtensionViewAt: {
    type: Date,
    default: null,
  },
  // Engine 2: Top-20 core product tracking
  isTop20: {
    type: Boolean,
    default: false,
    index: true
  },
  // Admin manual override protecting product from crawler rotation
  isPinned: {
    type: Boolean,
    default: false
  },
  top20Category: {
    type: String,
    default: null
  },
  top20Subcategory: {
    type: String,
    default: null
  },
  top20Rank: {
    type: Number,
    default: null
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  lightningDealEndsAt: {
    type: Date,
    default: null
  },
  lastChecked: {
    type: Date,
    default: Date.now
  },
  // lastStoreSyncAt: only updated when a real merchant network scrape happens (not on cache hits)
  lastStoreSyncAt: {
    type: Date,
    default: null
  },
  // lastTelegramSeenAt: updated every time any Telegram channel posts this product URL
  lastTelegramSeenAt: {
    type: Date,
    default: null
  },
  lastHistoryBackfillAt: {
    type: Date,
    default: null
  },
  lastBuyhatkeSyncAt: {
    type: Date,
    default: null
  },
  country: {
    type: String,
    default: 'IN'
  },
  sourceChannelName: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false,
  optimisticConcurrency: false
});

productSchema.index({ productId: 1, country: 1 }, { unique: true });
productSchema.index({ cleanUrl: 1 });
productSchema.index({ isActive: 1, country: 1, lastChecked: -1 });
productSchema.index({ category: 1, isActive: 1, lastChecked: -1 });
productSchema.index({ merchant: 1, category: 1 });
productSchema.index({ lastChecked: 1 });
productSchema.index({ lastStoreSyncAt: 1 });
productSchema.index({ updatedAt: -1 });
productSchema.index({ productSource: 1 });
productSchema.index({ isTrackedByExtension: 1, lastExtensionViewAt: -1 });
productSchema.index({ 'discoveredBy.userId': 1 });
productSchema.index({ country: 1, lastBuyhatkeSyncAt: 1 });
productSchema.index({ extensionUsers: 1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');

export default Product;
