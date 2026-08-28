import mongoose from 'mongoose';

// Every attempt the X-bot scheduler (or a manual admin trigger) makes to post a deal via
// src/utils/xBot.js — including skipped/failed attempts, not just successes, so the admin
// history view explains gaps (e.g. "device was offline all day") rather than just going silent.
const xPostLogSchema = new mongoose.Schema({
  deal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  dealTitle: { type: String },
  dealUrl: { type: String },
  publishedContent: { type: String, default: '' },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'CANCELLED', 'SKIPPED_DEVICE_OFFLINE', 'SKIPPED_NO_DEAL'],
    required: true,
  },
  errorMessage: { type: String, default: null },
  // Step-by-step trace from src/utils/xBot.js (unlock, force-stop, launch, each button search/
  // tap, typing, submit) — collected regardless of outcome, so a FAILED row shows exactly which
  // step broke instead of just the final error. Powers the admin history's expandable log view.
  steps: { type: [String], default: [] },
  // 'scheduled' (the 3x/day cron job) vs 'manual' (an admin clicking "Post Now" on a deal).
  trigger: { type: String, enum: ['scheduled', 'manual'], default: 'scheduled' },
  timestamp: { type: Date, default: Date.now },
});

const XPostLog = mongoose.models.XPostLog || mongoose.model('XPostLog', xPostLogSchema, 'x_post_logs');

export default XPostLog;
