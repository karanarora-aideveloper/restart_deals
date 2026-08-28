import mongoose from 'mongoose';

// Mirrors the WAHA "connection" concept for X/Twitter: one managed X account's login +
// API credentials + billing, kept separate from OutputChannel routing rows so several
// output channels can post as the same account without duplicating secrets per row.
// See api/src/db/models/xAccount.js — this is the backend-service copy of the same schema
// (same dual-copy pattern already used for Channel/OutputChannel/Deal in this codebase).
const xAccountSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true
  },
  handle: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Reference only — no automated login flow reads this. Plain text, no field-level
  // encryption in this codebase; prefer a password manager over filling loginPassword here.
  login: {
    email: { type: String },
    password: { type: String },
    notes: { type: String }
  },

  // OAuth 1.0a — required for posting and for media upload (see twitterPublisher.js for why
  // the newer split /2/media/upload/{initialize,append,finalize} endpoints aren't used).
  oauth1: {
    apiKey: { type: String },
    apiSecret: { type: String },
    accessToken: { type: String },
    accessSecret: { type: String }
  },

  oauth2: {
    clientId: { type: String },
    clientSecret: { type: String }
  },

  bearerToken: { type: String },

  billing: {
    cardLabel: { type: String },
    monthlySpendLimitUsd: { type: Number },
    lastKnownBalanceUsd: { type: Number },
    lastKnownBalanceAt: { type: Date },
    notes: { type: String }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const XAccount = mongoose.models.XAccount || mongoose.model('XAccount', xAccountSchema, 'x_accounts');

export default XAccount;
