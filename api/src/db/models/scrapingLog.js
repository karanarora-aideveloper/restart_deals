import mongoose from 'mongoose';

const scrapingLogSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    index: true,
  },
  domain: {
    type: String,
    default: '',
    index: true,
  },
  merchant: {
    type: String,
    enum: ['amazon', 'flipkart', 'myntra', 'nykaa', 'ajio', 'shopsy', 'meesho', 'unknown'],
    default: 'unknown',
    index: true,
  },
  source: {
    type: String,
    enum: ['interactive', 'telegram', 'daily_refresh', 'bestseller_crawler', 'other'],
    default: 'other',
    index: true,
  },
  mode: {
    type: String,
    enum: ['direct', 'scrapingant_proxy'],
    default: 'direct',
    index: true,
  },
  tokenUsed: {
    type: String,
    default: null,
    index: true,
  },
  status: {
    type: String,
    enum: ['success', 'error', '409_concurrency', '403_exhausted', 'blocked'],
    default: 'success',
    index: true,
  },
  statusCode: {
    type: Number,
    default: 200,
  },
  durationMs: {
    type: Number,
    default: 0,
  },
  extractedData: {
    title: { type: String, default: null },
    price: { type: Number, default: null },
    originalPrice: { type: Number, default: null },
    rating: { type: Number, default: null },
    itemsCount: { type: Number, default: null },
  },
  errorMessage: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

scrapingLogSchema.index({ createdAt: -1 });
scrapingLogSchema.index({ source: 1, createdAt: -1 });
scrapingLogSchema.index({ status: 1, createdAt: -1 });
scrapingLogSchema.index({ mode: 1, createdAt: -1 });

const ScrapingLog = mongoose.model('ScrapingLog', scrapingLogSchema, 'scraping_logs');

export default ScrapingLog;
