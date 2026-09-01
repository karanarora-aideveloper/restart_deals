import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  author: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: Date }
}, { _id: false });

const priceHistorySchema = new mongoose.Schema({
  date: { type: String }, // 'YYYY-MM-DD'
  price: { type: Number },
  originalPrice: { type: Number },
  timestamp: { type: Date, default: Date.now }
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
  images: [{ 
    type: String 
  }],
  imageUrl: {
    type: String
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
    type: { type: String, default: null },
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
});

productSchema.index({ cleanUrl: 1 });
productSchema.index({ isActive: 1, country: 1, lastChecked: -1 });
productSchema.index({ category: 1, isActive: 1, lastChecked: -1 });
productSchema.index({ merchant: 1, category: 1 });
productSchema.index({ lastChecked: 1 });
productSchema.index({ updatedAt: -1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');

export default Product;
