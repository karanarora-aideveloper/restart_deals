import mongoose from 'mongoose';

// Logins are hidden on native for now (see frontend/src/context/AuthContext.js), so a push
// token isn't tied to a user account — it's tied to an installed app instance instead,
// identified by deviceId (a locally-generated id persisted in AsyncStorage — see
// frontend/src/utils/pushNotifications.js).
const pushTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    enum: ['android', 'ios'],
    required: true,
  },
  deviceId: {
    type: String,
  },
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

const PushToken = mongoose.models.PushToken || mongoose.model('PushToken', pushTokenSchema, 'push_tokens');

export default PushToken;
