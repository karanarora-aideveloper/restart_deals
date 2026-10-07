import mongoose from 'mongoose';

// Logins are hidden on native for now (see frontend/src/context/AuthContext.js), so a push
// token isn't tied to a user account — it's tied to an installed app instance instead,
// identified by deviceId (a locally-generated id persisted in AsyncStorage — see
// frontend/src/utils/pushNotifications.js).
const pushTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    sparse: true,
  },
  endpoint: {
    type: String,
    sparse: true,
    index: true,
  },
  keys: {
    p256dh: { type: String },
    auth: { type: String },
  },
  platform: {
    type: String,
    enum: ['web', 'android', 'ios'],
    default: 'web',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  deviceId: {
    type: String,
    index: true,
  },
  subscribedProductIds: [{
    type: String,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastSeenAt: {
    type: Date,
    default: Date.now,
  },
});

pushTokenSchema.index({ platform: 1, isActive: 1 });
pushTokenSchema.index({ userId: 1, isActive: 1 });
pushTokenSchema.index({ subscribedProductIds: 1, isActive: 1 });

const PushToken = mongoose.models.PushToken || mongoose.model('PushToken', pushTokenSchema, 'push_tokens');

export default PushToken;
