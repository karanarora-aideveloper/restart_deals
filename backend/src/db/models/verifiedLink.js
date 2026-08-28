import mongoose from 'mongoose';

const cachedReviewSchema = new mongoose.Schema({
  author: { type: String },
  text: { type: String },
  rating: { type: Number },
  date: { type: Date }
}, { _id: false });

const verifiedLinkSchema = new mongoose.Schema({
  originalUrl: { 
    type: String, 
    required: true 
  },
  cleanUrl: { 
    type: String, 
    required: true, 
    unique: true 
  }, // Canonical URL
  productId: { 
    type: String, 
    required: true 
  }, // ASIN or product ID
  title: { 
    type: String 
  }, // Actual product title from webpage
  merchant: { 
    type: String, 
    required: true 
  }, // amazon, flipkart, etc.
  images: [{ 
    type: String 
  }],
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
