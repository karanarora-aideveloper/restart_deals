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
    const { productId, merchant, targetPrice, email, phone, source = 'web', extensionUserId, telegramChatId, telegramUsername } = req.body;

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

    if (!userId && !cleanEmail && !cleanPhone && !extensionUserId && !telegramChatId) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an email address, phone number, or Telegram Chat ID to receive price drop alerts.',
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
        ...(extensionUserId ? [{ extensionUserId }] : []),
        ...(telegramChatId ? [{ telegramChatId }] : []),
      ],
    };

    let alert = await PriceAlert.findOne(query);

    if (alert) {
      alert.targetPrice = numericTarget;
      alert.initialPrice = initialPrice;
      alert.title = title || alert.title;
      alert.imageUrl = imageUrl || alert.imageUrl;
      if (source) alert.source = source;
      if (extensionUserId) alert.extensionUserId = extensionUserId;
      if (telegramChatId) alert.telegramChatId = telegramChatId;
      if (telegramUsername) alert.telegramUsername = telegramUsername;
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
        telegramChatId: telegramChatId || undefined,
        telegramUsername: telegramUsername || undefined,
        source: source || 'web',
        extensionUserId: extensionUserId || undefined,
        status: 'active',
      });
      await alert.save();
    }

    // If alert came from extension, ensure product has extension tracking flagged
    if (product && (source === 'extension' || extensionUserId)) {
      product.isTrackedByExtension = true;
      if (extensionUserId && Array.isArray(product.extensionUsers) && !product.extensionUsers.includes(extensionUserId)) {
        product.extensionUsers.push(extensionUserId);
      }
      product.save().catch(() => {});
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
    const phone = req.query.phone ? req.query.phone.replace(/[^0-9+]/g, '') : null;
    const telegramChatId = req.query.telegramChatId ? String(req.query.telegramChatId) : null;
    const extensionUserId = req.query.extensionUserId ? String(req.query.extensionUserId).trim() : null;

    if (!userId && !email && !phone && !telegramChatId && !extensionUserId) {
      return res.status(400).json({ success: false, error: 'Authentication token, email, phone, telegramChatId, or extensionUserId is required' });
    }

    const filter = {
      status: 'active',
      $or: [
        ...(userId ? [{ userId }] : []),
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
        ...(telegramChatId ? [{ telegramChatId }] : []),
        ...(extensionUserId ? [{ extensionUserId }] : []),
      ],
    };

    const rawAlerts = await PriceAlert.find(filter).sort({ createdAt: -1 }).lean();

    // Enrich alerts with current live price and fresh assets from products collection
    const enrichedAlerts = await Promise.all(
      rawAlerts.map(async (alert) => {
        let prod = null;
        if (alert.productId) {
          prod = await Product.findOne({ productId: alert.productId }).select('price previousPrice originalPrice imageUrl images cleanUrl title merchant').lean();
          if (!prod && mongoose.Types.ObjectId.isValid(alert.productId)) {
            prod = await Product.findById(alert.productId).select('price previousPrice originalPrice imageUrl images cleanUrl title merchant').lean();
          }
        }
        const currentPrice = prod?.price != null ? prod.price : alert.initialPrice;
        const targetMet = currentPrice != null && currentPrice <= alert.targetPrice;
        const priceDrop = alert.initialPrice && currentPrice ? alert.initialPrice - currentPrice : 0;

        return {
          ...alert,
          currentPrice,
          originalPrice: prod?.originalPrice || null,
          title: alert.title || prod?.title || 'Tracked Product',
          imageUrl: alert.imageUrl || prod?.imageUrl || (prod?.images && prod.images[0]) || '',
          cleanUrl: alert.cleanUrl || prod?.cleanUrl || '',
          merchant: alert.merchant || prod?.merchant || 'amazon',
          targetMet,
          priceDrop: Math.max(0, priceDrop),
          linkedProductId: prod?._id ? prod._id.toString() : null,
        };
      })
    );

    res.json({ success: true, data: enrichedAlerts });
  } catch (err) {
    console.error('[API Error] GET /api/alerts failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

/**
 * PATCH /api/alerts/:id
 * Update target price or details of an active alert
 */
router.patch('/:id', async (req, res) => {
  try {
    const { targetPrice } = req.body;
    const numericTarget = Number(targetPrice);
    if (isNaN(numericTarget) || numericTarget <= 0) {
      return res.status(400).json({ success: false, error: 'targetPrice must be a positive number' });
    }

    const alert = await PriceAlert.findByIdAndUpdate(
      req.params.id,
      { $set: { targetPrice: numericTarget, updatedAt: new Date() } },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({ success: false, error: 'Price alert not found' });
    }

    res.json({
      success: true,
      message: `Target price updated to ₹${numericTarget.toLocaleString('en-IN')}`,
      data: alert,
    });
  } catch (err) {
    console.error(`[API Error] PATCH /api/alerts/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Failed to update alert: ' + err.message });
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
