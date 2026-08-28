import express from 'express';
import mongoose from 'mongoose';
import PriceAlert from '../db/models/priceAlert.js';
import Product from '../db/models/product.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

/**
 * Optional token authentication middleware helper
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const JWT_SECRET = process.env.JWT_SECRET || 'shoppers_deals_jwt_secret_key_2026';
    const jwt = req.app.get('jwt') || null;
    if (jwt) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Ignore invalid token in optional auth
  }
  next();
}

/**
 * POST /api/alerts
 * Subscribe to a price drop alert on a product.
 * Body: { productId, merchant, targetPrice, email, phone }
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { productId, merchant, targetPrice, email, phone } = req.body;

    if (!productId || !targetPrice) {
      return res.status(400).json({ success: false, error: 'productId and targetPrice are required' });
    }

    const numericTarget = Number(targetPrice);
    if (isNaN(numericTarget) || numericTarget <= 0) {
      return res.status(400).json({ success: false, error: 'targetPrice must be a positive number' });
    }

    const userId = req.user?.id || null;
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : null;

    if (!userId && !cleanEmail && !cleanPhone) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email address or phone number to receive price drop alerts.',
      });
    }

    // Lookup product to snapshot current details
    let product = await Product.findOne({ productId });
    if (!product && mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    }

    const initialPrice = product?.price || numericTarget;
    const resolvedMerchant = merchant || product?.merchant || 'amazon';
    const title = product?.title || '';
    const imageUrl = product?.imageUrl || (product?.images && product.images[0]) || '';
    const cleanUrl = product?.cleanUrl || '';

    // Check if an identical active alert already exists
    const query = {
      productId: product?.productId || productId,
      status: 'active',
      $or: [
        ...(userId ? [{ userId }] : []),
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ...(cleanPhone ? [{ phone: cleanPhone }] : []),
      ],
    };

    let alert = await PriceAlert.findOne(query);

    if (alert) {
      alert.targetPrice = numericTarget;
      alert.initialPrice = initialPrice;
      alert.title = title || alert.title;
      alert.imageUrl = imageUrl || alert.imageUrl;
      alert.updatedAt = new Date();
      await alert.save();
    } else {
      alert = new PriceAlert({
        productId: product?.productId || productId,
        merchant: resolvedMerchant,
        title,
        imageUrl,
        cleanUrl,
        targetPrice: numericTarget,
        initialPrice,
        userId: userId || undefined,
        email: cleanEmail || undefined,
        phone: cleanPhone || undefined,
        status: 'active',
      });
      await alert.save();
    }

    res.json({
      success: true,
      message: `Price drop alert set for ₹${numericTarget.toLocaleString('en-IN')}`,
      data: alert,
    });
  } catch (err) {
    console.error('[API Error] POST /api/alerts failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create price alert: ' + err.message });
  }
});

/**
 * GET /api/alerts
 * List user's active alerts (requires user auth or email query param)
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = req.query.email ? req.query.email.trim().toLowerCase() : null;

    if (!userId && !email) {
      return res.status(400).json({ success: false, error: 'Authentication token or email query parameter is required' });
    }

    const filter = {
      status: 'active',
      ...(userId ? { userId } : { email }),
    };

    const alerts = await PriceAlert.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: alerts });
  } catch (err) {
    console.error('[API Error] GET /api/alerts failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Cancel an active alert
 */
router.delete('/:id', async (req, res) => {
  try {
    const alert = await PriceAlert.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'cancelled', updatedAt: new Date() } },
      { new: true }
    );
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Price alert not found' });
    }
    res.json({ success: true, message: 'Price alert cancelled successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/alerts/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to cancel price alert' });
  }
});

export default router;
