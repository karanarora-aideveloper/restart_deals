import mongoose from 'mongoose';

const outputChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  platform: {
    type: String,
    enum: ['telegram', 'twitter', 'whatsapp'],
    required: true
  },
  country: {
    type: String,
    default: 'IN' // 'IN', 'US', 'UK', 'CA', 'AU', 'all'
  },
  // No hardcoded enum — valid values are managed dynamically via the Master collection
  // (type: 'category'). A stale hardcoded list here would silently block creating an
  // OutputChannel for any category added after this schema was written (this already
  // happened: electronics/fashion/home/beauty exist in Master but weren't in this enum).
  category: {
    type: String,
    default: 'all'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Minimum minutes between sends on this channel — protects against WhatsApp (or any
  // provider) flagging the account for spam when the deal pipeline fires rapidly. null/0
  // means unlimited. Enforced in backend/src/listener/publisher.js against stats.lastPublishedAt;
  // a deal that arrives mid-cooldown is skipped for this channel, not queued for later.
  rateLimitMinutes: {
    type: Number,
    default: null
  },
  credentials: {
    // Telegram: { channelUsername: 'amazondeallovers' }
    // Twitter: { apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' }
    // WhatsApp — `provider` selects which of these three shapes the rest of the object uses:
    //   waha:    { provider: 'waha', wahaBaseUrl: 'http://localhost:3000', wahaApiKey: '', wahaSession: 'default', recipientPhoneNumber: '' }
    //   meta:    { provider: 'meta', phoneNumberId: '', accessToken: '', recipientPhoneNumber: '' }
    //   webhook: { provider: 'webhook', webhookUrl: '' }
    // See backend/src/listener/publishers/whatsappPublisher.js.
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  stats: {
    dealsPublished: { type: Number, default: 0 },
    lastPublishedAt: { type: Date }
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

const OutputChannel = mongoose.model('OutputChannel', outputChannelSchema, 'output_channels');

export default OutputChannel;
