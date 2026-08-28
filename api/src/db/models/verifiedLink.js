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
  },
  productId: { 
    type: String, 
    required: true 
  },
  merchant: { 
    type: String, 
    required: true 
  },
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

const VerifiedLink = mongoose.models.VerifiedLink || mongoose.model('VerifiedLink', verifiedLinkSchema, 'verified_links');

export default VerifiedLink;
