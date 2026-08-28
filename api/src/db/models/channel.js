import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  channelId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  username: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String 
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
  messagesCapturedCount: {
    type: Number,
    default: 0
  },
  dealsProducedCount: {
    type: Number,
    default: 0
  },
  lastMessageAt: {
    type: Date
  },
  // When this channel last actually produced a deal — distinct from lastMessageAt, which
  // moves on every captured message even if none of them parsed into a deal. The gap
  // between the two is the clearest signal that a channel has gone stale.
  lastDealAt: {
    type: Date
  },
  // Category this channel's deals belong to. 'auto' (the default) leaves it to the
  // per-message AI classifier in backend/src/listener/verifier.js; any other value is a
  // Master-managed category slug. No hardcoded enum on purpose — a stale list here would
  // silently block categories added to Master later (the same bug OutputChannel.category
  // and Deal.category were both fixed for).
  category: {
    type: String,
    default: 'auto'
  },
  // Superseded by `category` above. Kept so existing documents keep validating; the stale
  // ['auto','fitness','general'] enum is why it was never usable from the admin UI.
  categoryPreference: {
    type: String,
    default: 'auto'
  },
  // Manual editorial review of whether this channel is worth monitoring at all. Distinct
  // from isActive (which is the on/off switch): relevance records the *judgement*, isActive
  // records the resulting state. Marking a channel not_relevant also switches monitoring
  // off, so AI/scrape budget stops being spent on it.
  relevance: {
    type: String,
    enum: ['unreviewed', 'relevant', 'not_relevant'],
    default: 'unreviewed'
  },
  relevanceNote: {
    type: String
  },
  relevanceReviewedAt: {
    type: Date
  },
  country: {
    type: String,
    default: 'IN'
  },
  // True when the Telegram account behind TELEGRAM_SESSION is the creator/owner of this
  // channel (Telegram's `creator` flag on the dialog entity) — set by
  // scripts/sync_channel_ownership.js, not user-editable. Lets the admin separate the
  // user's own broadcast channels from third-party channels merely being scraped for deals.
  isOwner: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date, 
    default: Date.now 
  }
});

const Channel = mongoose.models.Channel || mongoose.model('Channel', channelSchema, 'monitored_channels');

export default Channel;
