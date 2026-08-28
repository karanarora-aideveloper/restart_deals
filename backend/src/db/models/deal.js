import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  author: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: Date }
}, { _id: false });

// Declared as its own schema rather than a nested object literal: a field literally named "type"
// is ambiguous to Mongoose inside a plain nested object, and _id:false only applies to a schema.
const couponSchema = new mongoose.Schema({
  type: { type: String, enum: ['percent', 'flat', 'code'] },
  value: { type: Number },  // percent (e.g. 2) or flat currency amount (e.g. 50); null if code-only
  code: { type: String },   // literal code to enter, when there is one
  label: { type: String }   // short display string, e.g. "Apply 2% coupon"
}, { _id: false });

const dealSchema = new mongoose.Schema({
  sourceChannelId: { 
    type: String, 
    required: true 
  },
  sourceMessageId: { 
    type: String, 
    required: true 
  },
  country: {
    type: String,
    default: 'IN'
  },
  sourceChannelName: {
    type: String
  },
  originalText: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String 
  },
  description: { 
    type: String 
  },
  imageUrl: { 
    type: String 
  },
  images: [{ 
    type: String 
  }],
  rating: { 
    type: Number 
  },
  reviews: [reviewSchema],
  dealUrl: {
    type: String,
    required: true
  },
  // Canonical merchant product ID (ASIN / Flipkart PID) — the real identity of "same product",
  // since dealUrl/cleanUrl can legitimately differ between posts of the same product (e.g. Flipkart
  // resolves the same pid through different landing-page slugs depending on the source link).
  productId: {
    type: String
  },
  merchant: {
    type: String
  },
  originalPrice: {
    type: Number
  },
  dealPrice: {
    type: Number
  },
  // Substitute-MRP baseline when the price-history fallback found a genuine (>=5%) drop against
  // our own last recorded price for this product — see verifier.js. Null when the discount came
  // from a real scraped/text MRP instead (originalPrice covers that case).
  previousPrice: {
    type: Number
  },
  discountPercentage: {
    type: Number
  },
  // How this deal's discount was established: 'scraped' (a live page confirmed it this run),
  // 'ai_text' (AI found both prices directly in the message text, or cache-hit without a fresh
  // scrape), or 'price_history' (no MRP anywhere — compared against our own last known price).
  priceSource: {
    type: String,
    enum: ['scraped', 'ai_text', 'price_history']
  },
  // An extra coupon the shopper applies on the merchant page for a further saving on top of
  // dealPrice. Lives on the Deal, not the Product — it's advertised per-post and expires, unlike
  // the product's own identity. Null when the source message advertised no coupon.
  coupon: {
    type: couponSchema,
    default: null
  },
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
  isVerified: { 
    type: Boolean, 
    default: false 
  },
  isExpired: {
    type: Boolean,
    default: false
  },
  expiredAt: {
    type: Date,
    default: null
  },
  lastVerifiedAt: {
    type: Date,
    default: Date.now
  },
  publishedStatus: {
    mobileApp: { type: Boolean, default: false },
    webApp: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false }
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

dealSchema.index({ sourceChannelId: 1, sourceMessageId: 1 }, { unique: true });
dealSchema.index({ dealUrl: 1 });
dealSchema.index({ productId: 1, merchant: 1 });
dealSchema.index({ isExpired: 1, country: 1, createdAt: -1 });
dealSchema.index({ category: 1, isExpired: 1, createdAt: -1 });
dealSchema.index({ isExpired: 1, discountPercentage: -1, createdAt: -1 });

const Deal = mongoose.models.Deal || mongoose.model('Deal', dealSchema, 'deals');

export default Deal;
