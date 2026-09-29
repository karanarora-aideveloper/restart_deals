import mongoose from 'mongoose';

const cachedReviewSchema = new mongoose.Schema({
  author: { type: String },
  headline: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: mongoose.Schema.Types.Mixed },
  verifiedPurchase: { type: Boolean, default: false }
}, { _id: false });

const verifiedLinkSchema = new mongoose.Schema({
  originalUrl: { 
    type: String, 
    required: true 
  },
  cleanUrl: { 
    type: String, 
    required: true 
  }, // Canonical URL
  productId: { 
    type: String, 
    required: true 
  }, // ASIN or product ID
  title: { 
    type: String 
  }, // Actual product title from webpage
  brand: {
    type: String,
    default: null
  },
  merchant: { 
    type: String, 
    required: true 
  }, // amazon, flipkart, etc.
  images: [{ 
    type: String 
  }],
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
  rating: { 
    type: Number 
  },
  reviews: [cachedReviewSchema],
  price: { 
    type: Number 
  },
  originalPrice: {
    type: Number
  },
  variant: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastChecked: { 
    type: Date, 
    default: Date.now 
  }
});

verifiedLinkSchema.index({ productId: 1 });

const VerifiedLink = mongoose.model('VerifiedLink', verifiedLinkSchema, 'verified_links');

export default VerifiedLink;
