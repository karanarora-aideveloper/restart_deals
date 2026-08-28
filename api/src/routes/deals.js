import express from 'express';
import mongoose from 'mongoose';
import Deal from '../db/models/deal.js';
import { cacheMiddleware } from '../utils/cache.js';

const router = express.Router();

/**
 * GET /api/deals
 * Paginated, tokenized multi-field filtered deals from MongoDB deals collection.
 */
router.get('/', cacheMiddleware(15), async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip = (page - 1) * limit;

    const query = {};

    // Exclude expired deals by default to ensure only active, trusted deals are shown
    if (req.query.includeExpired !== 'true') {
      query.isExpired = { $ne: true };
    }

    if (req.query.category && req.query.category !== 'all') {
      query.category = req.query.category.toLowerCase();
    }

    if (req.query.subcategory && req.query.subcategory !== 'all') {
      query.subcategory = req.query.subcategory.toLowerCase();
    }

    if (req.query.merchant && req.query.merchant !== 'all') {
      const mStr = req.query.merchant.toLowerCase();
      query.$or = [
        { merchant: new RegExp(mStr, 'i') },
        { dealUrl: new RegExp(mStr, 'i') }
      ];
    }

    if (req.query.country && req.query.country !== 'all') {
      const cCode = req.query.country.toUpperCase();
      if (cCode === 'IN') {
        query.$or = [{ country: 'IN' }, { country: { $exists: false } }, { country: null }];
      } else {
        query.country = cCode;
      }
    }

    if (req.query.hasCoupon === 'true') {
      query['coupon.label'] = { $exists: true, $ne: '' };
    } else if (req.query.hasCoupon === 'false') {
      query.$or = [{ coupon: null }, { 'coupon.label': { $in: ['', null] } }, { coupon: { $exists: false } }];
    }

    if (req.query.q) {
      const qStr = req.query.q.trim();
      if (qStr.length > 0) {
        const searchTokens = qStr.split(/\s+/).filter(Boolean);
        const andConditions = searchTokens.map(token => {
          const regex = new RegExp(token, 'i');
          return {
            $or: [
              { title: regex },
              { dealTitle: regex },
              { description: regex },
              { dealUrl: regex },
              { productId: regex },
              { sourceChannelName: regex },
              { merchant: regex }
            ]
          };
        });
        query.$and = andConditions;
      }
    }

    if (req.query.minPrice || req.query.maxPrice) {
      query.dealPrice = {};
      if (req.query.minPrice) query.dealPrice.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) query.dealPrice.$lte = parseFloat(req.query.maxPrice);
    }

    // Deals above 90% off are overwhelmingly bad scrapes (a wrong/inflated originalPrice, not a
    // real discount) rather than genuine steals — capped out of every listing unconditionally,
    // not just the default sort, so nothing past or future in this range ever reaches the app.
    query.discountPercentage = { ...(query.discountPercentage || {}), $lte: 90 };
    if (req.query.minDiscount) {
      query.discountPercentage.$gte = parseFloat(req.query.minDiscount);
    }

    let sort = { createdAt: -1 };
    if (req.query.sort) {
      if (req.query.sort === 'discount') {
        sort = { discountPercentage: -1 };
      } else if (req.query.sort === 'price_asc') {
        sort = { dealPrice: 1 };
      } else if (req.query.sort === 'price_desc') {
        sort = { dealPrice: -1 };
      } else if (req.query.sort === 'rating') {
        sort = { rating: -1 };
      }
    }

    const total = await Deal.countDocuments(query);
    const deals = await Deal.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: deals,
      deals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[API Error] GET /api/deals failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/deals/:id
 */
router.get('/:id', cacheMiddleware(30), async (req, res) => {
  try {
    let deal = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      deal = await Deal.findById(req.params.id).lean();
    }
    if (!deal) {
      deal = await Deal.findOne({ productId: req.params.id }).sort({ createdAt: -1 }).lean();
    }
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    res.json({ success: true, data: deal });
  } catch (err) {
    console.error(`[API Error] GET /api/deals/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /api/deals/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    let deal = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      deal = await Deal.findByIdAndDelete(req.params.id);
    } else {
      deal = await Deal.findOneAndDelete({ productId: req.params.id });
    }
    if (!deal) {
      return res.status(404).json({ success: false, error: 'Deal not found' });
    }
    res.json({ success: true, message: 'Deal deleted successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/deals/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/deals/bulk-delete
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { dealIds } = req.body;
    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ success: false, error: 'dealIds array is required' });
    }
    const result = await Deal.deleteMany({ _id: { $in: dealIds } });
    res.json({ success: true, message: `${result.deletedCount} deals deleted successfully` });
  } catch (err) {
    console.error('[API Error] POST /api/deals/bulk-delete failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
