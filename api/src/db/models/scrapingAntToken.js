import mongoose from 'mongoose';

const scrapingAntTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    default: null
  },
  usageCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'exhausted'],
    default: 'active'
  },
  planName: {
    type: String,
    default: null
  },
  planTotalCredits: {
    type: Number,
    default: 10000
  },
  remainedCredits: {
    type: Number,
    default: null
  },
  renewalDate: {
    type: Date,
    default: null
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },
  exhaustedAt: {
    type: Date
  },
  lastUsedAt: {
    type: Date,
    default: Date.now
  }
});

scrapingAntTokenSchema.index({ status: 1, lastUsedAt: 1 });

const ScrapingAntToken = mongoose.models.ScrapingAntToken || mongoose.model('ScrapingAntToken', scrapingAntTokenSchema, 'scraping_ant_tokens');

export default ScrapingAntToken;
