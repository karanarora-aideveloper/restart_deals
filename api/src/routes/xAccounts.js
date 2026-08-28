import express from 'express';
import XAccount from '../db/models/xAccount.js';
import OutputChannel from '../db/models/outputChannel.js';

const router = express.Router();

// Kept in one place so the "estimated spend" math below and the cost-transparency box in
// admin/src/app/network/output/page.js stay in sync if X changes pricing again.
const COST_PER_POST_WITH_LINK_USD = 0.20;

/**
 * GET /api/x-accounts
 * List managed X accounts with derived usage stats (from every OutputChannel that posts
 * as this account) and an estimated spend since the last manual balance check-in.
 */
router.get('/', async (req, res) => {
  try {
    const accounts = await XAccount.find().sort({ createdAt: -1 });

    // One aggregate covering every Twitter output channel, grouped by which account it
    // posts as — cheaper than N queries (one per account) for the same result.
    const usageAgg = await OutputChannel.aggregate([
      { $match: { platform: 'twitter', 'credentials.xAccountId': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$credentials.xAccountId',
          dealsPublished: { $sum: '$stats.dealsPublished' },
          channelCount: { $sum: 1 },
          channelNames: { $push: '$name' }
        }
      }
    ]);
    const usageByAccount = new Map(usageAgg.map(u => [String(u._id), u]));

    const enriched = accounts.map(acc => {
      const usage = usageByAccount.get(String(acc._id));
      const dealsPublished = usage?.dealsPublished || 0;
      const lastCheckAt = acc.billing?.lastKnownBalanceAt || acc.createdAt;
      // Deliberately not trying to isolate "posts since lastKnownBalanceAt" — we don't
      // retain per-post timestamps, only a running total. This is a labeled estimate, not
      // a ledger; console.x.com remains the source of truth for actual balance.
      const estimatedSpendUsd = Math.round(dealsPublished * COST_PER_POST_WITH_LINK_USD * 100) / 100;
      const estimatedRemainingUsd = acc.billing?.lastKnownBalanceUsd != null
        ? Math.round((acc.billing.lastKnownBalanceUsd - estimatedSpendUsd) * 100) / 100
        : null;

      return {
        ...acc.toObject(),
        usage: {
          dealsPublished,
          channelCount: usage?.channelCount || 0,
          channelNames: usage?.channelNames || [],
          estimatedSpendUsd,
          estimatedRemainingUsd,
          lastCheckAt,
          costPerPostUsd: COST_PER_POST_WITH_LINK_USD
        }
      };
    });

    res.json({ success: true, accounts: enriched });
  } catch (error) {
    console.error('[API Error] GET /api/x-accounts failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/x-accounts
 */
router.post('/', async (req, res) => {
  try {
    const { label, handle, login, oauth1, oauth2, bearerToken, billing, isActive } = req.body;
    if (!label) return res.status(400).json({ success: false, error: 'label is required' });

    const account = await XAccount.create({
      label,
      handle,
      login,
      oauth1,
      oauth2,
      bearerToken,
      billing,
      isActive: isActive !== undefined ? isActive : true
    });
    res.status(201).json({ success: true, account });
  } catch (error) {
    console.error('[API Error] POST /api/x-accounts failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/x-accounts/:id
 */
router.patch('/:id', async (req, res) => {
  try {
    const { label, handle, login, oauth1, oauth2, bearerToken, billing, isActive } = req.body;
    const update = { updatedAt: new Date() };
    if (label !== undefined) update.label = label;
    if (handle !== undefined) update.handle = handle;
    if (login !== undefined) update.login = login;
    if (oauth1 !== undefined) update.oauth1 = oauth1;
    if (oauth2 !== undefined) update.oauth2 = oauth2;
    if (bearerToken !== undefined) update.bearerToken = bearerToken;
    if (billing !== undefined) update.billing = billing;
    if (isActive !== undefined) update.isActive = isActive;

    const account = await XAccount.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!account) return res.status(404).json({ success: false, error: 'X account not found' });
    res.json({ success: true, account });
  } catch (error) {
    console.error('[API Error] PATCH /api/x-accounts failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/x-accounts/:id
 * Blocked while any output channel still posts as this account — deleting out from under
 * a live channel would silently break its next send instead of failing loudly here.
 */
router.delete('/:id', async (req, res) => {
  try {
    const inUse = await OutputChannel.countDocuments({ 'credentials.xAccountId': req.params.id });
    if (inUse > 0) {
      return res.status(409).json({ success: false, error: `${inUse} output channel(s) still post as this account. Repoint or delete them first.` });
    }
    const account = await XAccount.findByIdAndDelete(req.params.id);
    res.json({ success: true, deleted: !!account });
  } catch (error) {
    console.error('[API Error] DELETE /api/x-accounts failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/x-accounts/:id/test
 * Posts a real test tweet as this account, independent of any output channel — lets you
 * verify OAuth 1.0a credentials work before wiring a routing row to them. Billed by X like
 * any other post (~$0.20, since the test message includes a link).
 */
router.post('/:id/test', async (req, res) => {
  try {
    const account = await XAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, error: 'X account not found' });

    const { apiKey, apiSecret, accessToken, accessSecret } = account.oauth1 || {};
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return res.status(400).json({ success: false, error: 'This account is missing one or more OAuth 1.0a credentials.' });
    }

    const { TwitterApi } = await import('twitter-api-v2');
    const twitterClient = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret });
    const text = `Test post from ShoppersDeals Admin — verifying "${account.label}" credentials.\nhttps://www.amazon.in/dp/B00TEST123`;

    const tweet = await twitterClient.v2.tweet(text);
    res.json({
      success: true,
      message: `Test post published as "${account.label}" (post id ${tweet.data.id}). Billed ~$${COST_PER_POST_WITH_LINK_USD.toFixed(2)} (contains a link).`
    });
  } catch (error) {
    console.error(`[API Error] POST /api/x-accounts/${req.params.id}/test failed:`, error.message);
    res.status(502).json({ success: false, error: `X API call failed: ${error.message}` });
  }
});

export default router;
