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
  // Substitute-MRP baseline for the price-history discount fallback (see backend/src/listener/
  // verifier.js) — only set on a genuine (>=5%) drop against our own last recorded price, used
  // when no real scraped/text MRP was available. Distinct from originalPrice.
  previousPrice: {
    type: Number
  },
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
  // No hardcoded enum — valid values are managed dynamically via the Master collection
  // (type: 'category'). A stale hardcoded list here would reject any category added
  // after this schema was written (electronics/fashion/home/beauty all postdate it).
  category: {
    type: String,
    default: 'general'
  },
  // Same story as category — no hardcoded enum, values managed via the Master collection
  // (type: 'subcategory', metadata.parentCategory pointing at the category id). Empty string
  // means "not yet classified" (older products backfilled after this field was introduced, or
  // the AI classifier didn't find a confident subcategory match).
  subcategory: {
    type: String,
    default: ''
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
  lastChecked: {
    type: Date,
    default: Date.now
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
});

productSchema.index({ cleanUrl: 1 });
productSchema.index({ isActive: 1, country: 1, lastChecked: -1 });
productSchema.index({ category: 1, isActive: 1, lastChecked: -1 });
productSchema.index({ merchant: 1, category: 1 });
productSchema.index({ lastChecked: 1 });
productSchema.index({ updatedAt: -1 });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema, 'products');

export default Product;
