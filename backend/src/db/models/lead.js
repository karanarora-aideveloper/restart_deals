import mongoose from 'mongoose';

// A potential customer identified from a WhatsApp group you administer — distinct from `User`
// (an actual signed-up app user). Sourced via the WAHA group-import flow in
// api/src/routes/outputChannels.js (GET .../waha/groups, POST .../waha/groups/:groupId/import-leads)
// or directly from Contacts.
//
// One Lead per phone number, globally — the SAME number showing up in several groups you admin
// accumulates into `sourceGroups` (structured) and `tags` (flat, includes every group name it's
// been seen in) on the same document, instead of creating a duplicate row per group.
const sourceGroupSchema = new mongoose.Schema({
  groupId: { type: String, default: '' },
  groupName: { type: String, default: '' },
  role: { type: String, default: '' } // 'participant' | 'admin' | 'superadmin' within that group
}, { _id: false });

const leadSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  name: {
    type: String,
    default: '' // best-known display name (WAHA contact name/pushname/shortName), if any
  },
  isMyContact: {
    type: Boolean,
    default: false // true if this number is already saved in the connected account's own phone contacts
  },
  isBusiness: {
    type: Boolean,
    default: false
  },
  sourceGroups: [sourceGroupSchema],
  // Flat, includes every sourceGroups[].groupName plus any manually-added tag — group names give
  // personality/context info about the lead (topic, city, interest) even without a saved name.
  tags: [{ type: String }],
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted', 'ignored'],
    default: 'new'
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

const Lead = mongoose.models.Lead || mongoose.model('Lead', leadSchema, 'leads');

export default Lead;
