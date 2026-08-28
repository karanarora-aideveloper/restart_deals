import mongoose from 'mongoose';

// One row per admin-triggered send — the admin's Notifications page reads this for history.
const notificationLogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  // Opaque payload merged into the push message's `data` field — e.g. a deep link to a specific
  // deal. Not interpreted by the backend at all, just passed through to FCM.
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  platform: {
    type: String,
    enum: ['android', 'ios', 'all'],
    default: 'android',
  },
  recipientCount: {
    type: Number,
    default: 0,
  },
  successCount: {
    type: Number,
    default: 0,
  },
  failureCount: {
    type: Number,
    default: 0,
  },
  // A short sample of failure reasons (e.g. "InvalidRegistration") — enough to spot a systemic
  // problem at a glance without dumping every individual FCM response into this log.
  errorSample: [{
    type: String,
  }],
  sentAt: {
    type: Date,
    default: Date.now,
  },
});

const NotificationLog = mongoose.models.NotificationLog || mongoose.model('NotificationLog', notificationLogSchema, 'notification_logs');

export default NotificationLog;
