import mongoose from 'mongoose';

const contactSubSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  phoneNumbers: [{ type: String }],
  emails: [{ type: String }],
}, { _id: false });

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    sparse: true,
    index: true,
  },
  email: {
    type: String,
    sparse: true,
    lowercase: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    sparse: true,
    index: true,
    trim: true,
  },
  name: {
    type: String,
    default: 'Shopper User',
  },
  picture: {
    type: String,
    default: '',
  },
  contacts: [contactSubSchema],
  contactsSyncedAt: {
    type: Date,
  },
  deviceType: {
    type: String,
    default: '',
  },
  savedDeals: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

export const User = mongoose.model('User', userSchema);
export default User;
