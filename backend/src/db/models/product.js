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
    required: true,
    unique: true 
  }, // ASIN or Flipkart PID or canonical Product ID
  country: {
    type: String,
    default: 'IN'
  },
  sourceChannelName: {
    type: String
  },
  cleanUrl: { 
    type: String, 
    required: true 
  }, // Canonical clean URL
  merchant: { 
    type: String, 
    required: true 
  }, // amazon, flipkart, etc.
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
  // Substitute-MRP baseline for the price-history discount fallback (see verifier.js) — only set
  // when a genuine (>=5%) drop was detected against our own last recorded price, used when no real
  // scraped/text MRP was available. Distinct from originalPrice, which is an actual MRP/strike-
  // through price when one was found.
  previousPrice: {
    type: Number
  },
  // How the current price/discount was established — lets a future pass flip isVerified based on
  // this without another migration (only 'scraped' means a live page confirmed it this run).
  priceSource: {
    type: String,
    enum: ['scraped', 'ai_text', 'price_history']
  },
  originalPrice: {
    type: Number
  },
  priceUpdatedAt: {
    type: Date,
    default: Date.now
  },
  priceHistory: [priceHistorySchema],
  category: {
    type: String,
    default: 'general'
  },
  // Same story as category — no hardcoded enum, values managed via the Master collection
  // (type: 'subcategory', metadata.parentCategory pointing at the category id). Empty string
  // means "not yet classified".
  subcategory: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // True for a product we've seen mentioned but couldn't fully verify yet (missing an image,
  // a price, or a genuine discount — see verifyAndProcessMessage's final gate in verifier.js).
  // Recorded anyway so we have visibility into every product our channels cover, not just the
  // ones that cleared the bar for a displayable Deal. Flips to false the moment a later pass
  // (a repost, or a scheduled backfill re-scrape) completes it. Query
  // `Product.find({ needsEnrichment: true })` to find candidates for that backfill.
  needsEnrichment: {
    type: Boolean,
    default: false
  },
  // Admin-facing "this record looks wrong" flag — a human judgment call (bad title, wrong
  // image, garbage price, mismatched product), distinct from needsEnrichment above (the
  // pipeline's own "I don't have enough data yet" signal). Set/cleared only via the admin's
  // PATCH /api/products/:id/flag route — this pipeline never touches it.
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
  // Extracted variant/size information. Used for cross-store mismatch detection.
  variant: {
    raw: { type: String, default: null },
    display: { type: String, default: null },
    weightGrams: { type: Number, default: null },
    packSize: { type: Number, default: 1 },
    totalGrams: { type: Number, default: null },
    storageGb: { type: Number, default: null },
    ramGb: { type: Number, default: null },
    color: { type: String, default: null },
    shade: { type: String, default: null },
    type: { type: String, default: null },
  },
  // Multi-shade/size SKUs for beauty & fashion
  variants: [variantSkuSchema],
  // Active bank & card promotions
  bankOffers: [bankOfferSchema],
  // Discovery engine source tracking
  productSource: {
    type: String,
    enum: ['telegram', 'top20_catalog', 'user_search', 'bestseller'],
    default: 'telegram'
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
  // lastStoreSyncAt: exact moment we actually fetched fresh data from the merchant's own
  // store page (Amazon / Flipkart / etc.) — ONLY updated when a real network scrape happens,
  // never on cache hits. This is the number to use when measuring "how fresh is our listing".
  lastStoreSyncAt: {
    type: Date,
    default: null
  },
  // lastTelegramSeenAt: every time any Telegram channel posts a link to this product, we
  // stamp this. Updated on both cache hits AND fresh scrapes — it's "the last time any
  // channel talked about this product", regardless of whether we went to the store or not.
  // Lets the admin see which channels are repeatedly posting the same product.
  lastTelegramSeenAt: {
    type: Date,
    default: null
  },
  lastChecked: {
    type: Date,
    default: Date.now
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

productSchema.index({ cleanUrl: 1 });
productSchema.index({ isActive: 1, country: 1, lastChecked: -1 });
productSchema.index({ category: 1, isActive: 1, lastChecked: -1 });
productSchema.index({ merchant: 1, category: 1 });
productSchema.index({ lastChecked: 1 });
productSchema.index({ lastStoreSyncAt: 1 });
productSchema.index({ updatedAt: -1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');

export default Product;
