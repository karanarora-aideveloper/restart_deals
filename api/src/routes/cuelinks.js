import express from 'express';
import cuelinksService from '../services/cuelinksService.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = express.Router();

/**
 * GET / or /api/cuelinks or /api/coupons
 * When accessed via /api/coupons, directly returns coupons list.
 * When accessed via /api/cuelinks, returns integration status.
 */
router.get('/', async (req, res) => {
  try {
    if (req.baseUrl.includes('coupons')) {
      const { page = 1, per_page = 20, campaign_id, q } = req.query;
      const data = await cuelinksService.getCoupons({
        page: Number(page),
        per_page: Number(per_page),
        campaign_id,
        search: q,
      });
      return res.json(data);
    }
    const status = await cuelinksService.checkStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cuelinks/status
 * Public status check for Cuelinks integration
 */
router.get('/status', async (req, res) => {
  try {
    const status = await cuelinksService.checkStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cuelinks/convert
 * Converts a merchant URL into a monetized Cuelinks tracking link
 * Body: { url, subid, shorten }
 */
router.post('/convert', async (req, res) => {
  try {
    const { url, subid = 'shoppersdeals', shorten = false } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'Merchant url is required' });
    }

    const affiliateUrl = await cuelinksService.convertUrl(url, subid, shorten);
    res.json({
      success: true,
      originalUrl: url,
      affiliateUrl,
      subid,
      isApiPowered: cuelinksService.isCuelinksConfigured(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cuelinks/campaigns
 * Retrieves active merchant campaigns and commission percentages
 */
router.get('/campaigns', async (req, res) => {
  try {
    const { page = 1, per_page = 20, access_status = 'open', sort = 'epc_7d' } = req.query;
    const data = await cuelinksService.getCampaigns({
      page: Number(page),
      per_page: Number(per_page),
      access_status,
      sort,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cuelinks/offers
 * Retrieves live promotional offers, discounts, and deals
 */
router.get('/offers', async (req, res) => {
  try {
    const { page = 1, per_page = 20, campaign_id, offer_type, q } = req.query;
    const data = await cuelinksService.getOffers({
      page: Number(page),
      per_page: Number(per_page),
      campaign_id,
      offer_type,
      search: q,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/cuelinks/coupons
 * Retrieves active verified merchant coupons with promo codes
 */
router.get('/coupons', async (req, res) => {
  try {
    const { page = 1, per_page = 20, campaign_id, q } = req.query;
    const data = await cuelinksService.getCoupons({
      page: Number(page),
      per_page: Number(per_page),
      campaign_id,
      search: q,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/cuelinks/set-key (Admin Only)
 * Allows dynamically setting or rotating the Cuelinks API key
 * Body: { apiKey, pubId }
 */
router.post('/set-key', requireAdminAuth, async (req, res) => {
  try {
    const { apiKey, pubId } = req.body;
    if (apiKey) {
      process.env.CUELINKS_API_KEY = apiKey.trim();
    }
    if (pubId) {
      process.env.CUELINKS_PUB_ID = pubId.trim();
    }

    const status = await cuelinksService.checkStatus();
    res.json({
      success: true,
      message: 'Cuelinks credentials updated successfully',
      status,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
