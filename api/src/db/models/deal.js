import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  author: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: Date }
}, { _id: false });

// Mirrors backend/src/db/models/deal.js — the extra coupon a shopper applies on the merchant page
// for a further saving on top of dealPrice. Must be declared here too or Mongoose strips it from
// API responses (this service is what the admin dashboard and mobile app actually read from).
const couponSchema = new mongoose.Schema({
  type: { type: String, enum: ['percent', 'flat', 'code'] },
  value: { type: Number },
  code: { type: String },
  label: { type: String }
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
  // Canonical merchant product ID (ASIN / Flipkart PID / etc.)
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
  // our own last recorded price — see backend/src/listener/verifier.js. Null when the discount
  // came from a real scraped/text MRP instead (originalPrice covers that case).
  previousPrice: {
    type: Number
  },
  discountPercentage: {
    type: Number
  },
  priceSource: {
    type: String,
    enum: ['scraped', 'ai_text', 'price_history']
  },
  coupon: {
    type: couponSchema,
    default: null
  },
  // No hardcoded enum — valid values are managed dynamically via the Master collection
  // (type: 'category'). A stale hardcoded list here would reject any category added
  // after this schema was written (electronics/fashion/home/beauty all postdate it).
  category: {
    type: String,
    default: 'general'
  },
  // Same story as category — no hardcoded enum, values managed via the Master collection
  // (type: 'subcategory', metadata.parentCategory pointing at the category id). Empty string
  // means "not yet classified" (older deals backfilled after this field was introduced, or the
  // AI classifier didn't find a confident subcategory match).
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
  country: {
    type: String,
    default: 'IN'
  },
  publishedStatus: {
    mobileApp: { type: Boolean, default: false },
    webApp: { type: Boolean, default: false },
    telegram: { type: Boolean, default: false },
    twitter: { type: Boolean, default: false },
    whatsapp: { type: Boolean, default: false },
    outputChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'OutputChannel' }]
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
