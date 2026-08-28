import mongoose from 'mongoose';

const priceAlertSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true,
  },
  merchant: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    default: '',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  cleanUrl: {
    type: String,
    default: '',
  },
  targetPrice: {
    type: Number,
    required: true,
  },
  initialPrice: {
    type: Number,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  email: {
    type: String,
    index: true,
  },
  phone: {
    type: String,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'triggered', 'cancelled'],
    default: 'active',
    index: true,
  },
  triggeredAt: {
    type: Date,
  },
  triggeredPrice: {
    type: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

priceAlertSchema.index({ productId: 1, status: 1 });
priceAlertSchema.index({ email: 1, status: 1 });
priceAlertSchema.index({ userId: 1, status: 1 });

const PriceAlert = mongoose.models.PriceAlert || mongoose.model('PriceAlert', priceAlertSchema, 'price_alerts');

export default PriceAlert;
