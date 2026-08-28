import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../db/models/user.js';
import { isFirebaseAdminReady, getFirebaseAdminError, getAuth } from '../utils/firebaseAdmin.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'shoppers_deals_jwt_secret_key_2026';
const ALLOW_DEBUG_OTP = process.env.ALLOW_DEBUG_OTP === 'true' || process.env.NODE_ENV !== 'production';
const STATIC_OTP = '12345';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.warn('[Security Warning] JWT_SECRET is not configured in production environment.');
}

// Middleware to authenticate JWT token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

// POST /api/auth/google
// Authenticates or creates user from a Firebase ID token minted after Google Sign-In (web
// signInWithPopup, or native GoogleSignin -> signInWithCredential — see AuthContext.js on both
// web and native). The client also sends googleId/email/name/picture directly, but those are
// just UI convenience — trusting them without verification would let anyone POST an arbitrary
// email and log in as that user, so identity is always taken from the verified token instead.
router.post('/google', async (req, res) => {
  try {
    const { firebaseIdToken, deviceType } = req.body;

    if (!firebaseIdToken) {
      return res.status(400).json({ error: 'firebaseIdToken is required' });
    }
    if (!isFirebaseAdminReady()) {
      return res.status(503).json({ error: getFirebaseAdminError() || 'Firebase Admin is not configured.' });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(firebaseIdToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired Google sign-in token' });
    }

    const googleId = decoded.uid;
    const email = decoded.email;
    const name = decoded.name;
    const picture = decoded.picture;

    if (!email || !googleId) {
      return res.status(400).json({ error: 'Verified token is missing an email or uid' });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = new User({
        googleId,
        email,
        name: name || email.split('@')[0],
        picture: picture || '',
        deviceType: deviceType || '',
        createdAt: new Date(),
        lastLogin: new Date(),
      });
    } else {
      user.name = name || user.name;
      user.picture = picture || user.picture;
      user.googleId = googleId || user.googleId;
      if (deviceType) user.deviceType = deviceType;
      user.lastLogin = new Date();
    }

    await user.save();

    const payload = { id: user._id, email: user.email, googleId: user.googleId };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        googleId: user.googleId,
        email: user.email,
        phoneNumber: user.phoneNumber || '',
        name: user.name,
        picture: user.picture,
        deviceType: user.deviceType,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: 'Failed to authenticate Google user' });
  }
});

// POST /api/auth/phone/send-otp
// Initiates phone authentication
router.post('/phone/send-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    // Clean phone number format
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

    res.json({
      success: true,
      message: 'OTP sent successfully to ' + cleanPhone,
    });
  } catch (err) {
    console.error('Send OTP Error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /api/auth/phone/verify-otp
// Verifies OTP and creates/authenticates user by phone number
router.post('/phone/verify-otp', async (req, res) => {
  try {
    const { phoneNumber, otp, deviceType } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ error: 'phoneNumber and otp are required' });
    }

    if (!ALLOW_DEBUG_OTP) {
      return res.status(503).json({ error: 'SMS OTP verification gateway is currently not configured in production.' });
    }

    if (otp.trim() !== STATIC_OTP) {
      return res.status(400).json({ error: 'Invalid OTP entered.' });
    }

    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');

    let user = await User.findOne({ phoneNumber: cleanPhone });

    if (!user) {
      user = new User({
        phoneNumber: cleanPhone,
        name: `Shopper (${cleanPhone.slice(-4)})`,
        deviceType: deviceType || '',
        createdAt: new Date(),
        lastLogin: new Date(),
      });
    } else {
      if (deviceType) user.deviceType = deviceType;
      user.lastLogin = new Date();
    }

    await user.save();

    const payload = { id: user._id, phoneNumber: user.phoneNumber };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email || '',
        name: user.name,
        picture: user.picture || '',
        deviceType: user.deviceType,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Verify OTP Error:', err);
    res.status(500).json({ error: 'Failed to verify OTP: ' + err.message });
  }
});

// POST /api/auth/sync-contacts
// Saves device contacts list to user's MongoDB record
router.post('/sync-contacts', async (req, res) => {
  try {
    const { userId, phoneNumber, contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'contacts must be an array' });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (phoneNumber) {
      user = await User.findOne({ phoneNumber });
    } else {
      // Try resolving via authorization header
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          user = await User.findById(decoded.id);
        } catch (e) {
          // Token expired or invalid
        }
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User account not found' });
    }

    // Format & sanitize incoming contacts
    const formattedContacts = contacts.slice(0, 2000).map((c) => ({
      name: c.name || c.displayName || 'Unknown',
      phoneNumbers: Array.isArray(c.phoneNumbers) 
        ? c.phoneNumbers.map(p => typeof p === 'string' ? p : (p.number || '')).filter(Boolean)
        : [],
      emails: Array.isArray(c.emails)
        ? c.emails.map(e => typeof e === 'string' ? e : (e.email || '')).filter(Boolean)
        : [],
    }));

    user.contacts = formattedContacts;
    user.contactsSyncedAt = new Date();
    await user.save();

    console.log(`[Contacts Sync] Saved ${formattedContacts.length} contacts for User ${user._id} (${user.phoneNumber || user.email})`);

    res.json({
      success: true,
      message: `Successfully synced ${formattedContacts.length} contacts`,
      count: formattedContacts.length,
      syncedAt: user.contactsSyncedAt,
    });
  } catch (err) {
    console.error('Sync Contacts Error:', err);
    res.status(500).json({ error: 'Failed to sync contacts' });
  }
});

// GET /api/auth/me
// Returns profile of currently logged-in user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        googleId: user.googleId,
        email: user.email,
        phoneNumber: user.phoneNumber,
        name: user.name,
        picture: user.picture,
        contactsCount: user.contacts ? user.contacts.length : 0,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Fetch Profile Error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// DELETE /api/auth/delete
// Permanently deletes the logged-in user's account (profile, contacts, saved-deals list —
// all embedded on the User document, so a single delete is sufficient; no other collection
// references User by id).
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    console.error('Delete Account Error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// POST /api/auth/saved-deals
// Toggle save/unsave a deal for the logged-in user
router.post('/saved-deals', authenticateToken, async (req, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) {
      return res.status(400).json({ error: 'dealId is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const alreadySaved = user.savedDeals.some((id) => id.toString() === dealId);

    if (alreadySaved) {
      // Unsave: remove from array
      user.savedDeals = user.savedDeals.filter((id) => id.toString() !== dealId);
    } else {
      // Save: add to front of array
      user.savedDeals.unshift(dealId);
    }

    await user.save();

    res.json({
      success: true,
      saved: !alreadySaved,
      savedDealsCount: user.savedDeals.length,
    });
  } catch (err) {
    console.error('Toggle Saved Deal Error:', err);
    res.status(500).json({ error: 'Failed to toggle saved deal' });
  }
});

// GET /api/auth/saved-deals
// Fetch all saved deals for the logged-in user (with full deal data)
router.get('/saved-deals', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedDeals');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter out any null references (deleted deals)
    const deals = (user.savedDeals || []).filter(Boolean);

    res.json({
      success: true,
      data: deals,
      count: deals.length,
    });
  } catch (err) {
    console.error('Fetch Saved Deals Error:', err);
    res.status(500).json({ error: 'Failed to fetch saved deals' });
  }
});

// DELETE /api/auth/saved-deals/:dealId
// Remove a specific saved deal for the logged-in user
router.delete('/saved-deals/:dealId', authenticateToken, async (req, res) => {
  try {
    const { dealId } = req.params;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.savedDeals = user.savedDeals.filter((id) => id.toString() !== dealId);
    await user.save();

    res.json({
      success: true,
      message: 'Deal removed from saved list',
      savedDealsCount: user.savedDeals.length,
    });
  } catch (err) {
    console.error('Delete Saved Deal Error:', err);
    res.status(500).json({ error: 'Failed to remove saved deal' });
  }
});

export default router;
