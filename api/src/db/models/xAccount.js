import mongoose from 'mongoose';

// Mirrors the WAHA "connection" concept for X/Twitter: one managed X account's login +
// API credentials + billing, kept separate from OutputChannel routing rows so several
// output channels can post as the same account without duplicating secrets per row (see
// admin/src/app/network/connections/page.js's WAHA section for the equivalent pattern).
const xAccountSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true // e.g. "India Deals Bot" — your own name for this account, not the @handle
  },
  handle: {
    type: String // e.g. "indiadealsbot" (without @) — display only, not used for auth
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // Human login for x.com itself — reference only, never used by any automated login flow
  // (X has no supported username/password API login; this is purely so you have it on hand
  // for the developer portal / support / 2FA recovery). Stored as plain text — there is no
  // field-level encryption in this codebase today. Prefer a password manager; only fill
  // loginPassword here if you've accepted that whoever can read this Mongo collection can
  // read it too.
  login: {
    email: { type: String },
    password: { type: String },
    notes: { type: String } // e.g. "2FA via authenticator app on Karan's phone"
  },

  // OAuth 1.0a — required for posting (POST /2/tweets) and for media upload, since the
  // newer split /2/media/upload/{initialize,append,finalize} endpoints reject OAuth 1.0a.
  // Same 4 values previously entered per-output-channel; now centralized here.
  oauth1: {
    apiKey: { type: String },
    apiSecret: { type: String },
    accessToken: { type: String },
    accessSecret: { type: String }
  },

  // OAuth 2.0 — not used by the current posting code path (OAuth 1.0a covers it), but kept
  // so it's on hand if a future feature needs user-context OAuth 2.0 (e.g. features gated
  // behind scopes OAuth 1.0a can't request).
  oauth2: {
    clientId: { type: String },
    clientSecret: { type: String }
  },

  // App-only bearer token — read-only, no posting capability. Optional; lets a future
  // feature call read endpoints (e.g. GET /2/usage/tweets) without touching the user's
  // OAuth 1.0a posting credentials.
  bearerToken: { type: String },

  // Real balance/spend are only visible on console.x.com — X does not expose a credits-
  // remaining endpoint. This section is a manual ledger the admin keeps in sync themselves;
  // estimatedSpend (computed in the API route, not stored) fills the gap between check-ins
  // using this project's own dealsPublished counts × the known per-post price.
  billing: {
    cardLabel: { type: String }, // e.g. "Amex ...4471" — last 4 only, never a full card number
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
