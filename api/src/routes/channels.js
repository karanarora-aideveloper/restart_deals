import express from 'express';
import Channel from '../db/models/channel.js';
import Master from '../db/models/master.js';

const router = express.Router();

const RELEVANCE_VALUES = ['unreviewed', 'relevant', 'not_relevant'];

// 'auto' means "let the per-message AI classifier decide"; anything else must be a live
// Master category slug, so a typo can't silently route a channel to a category that
// doesn't exist. Deliberately not a hardcoded list — Master is the source of truth.
async function isValidCategory(value) {
  if (!value) return false;
  if (value === 'auto') return true;
  const exists = await Master.findOne({ type: 'category', value, isActive: { $ne: false } });
  return Boolean(exists);
}

/**
 * GET /api/channels
 * Retrieve monitored channels with tokenized multi-field search and stats summary.
 */
router.get('/', async (req, res) => {
  try {
    const query = {};
    // Several filters need an $or of their own (to also match documents predating a field).
    // They're collected into $and so they compose instead of overwriting each other's $or.
    const andConditions = [];

    if (req.query.status && req.query.status !== 'all') {
      if (req.query.status === 'active') query.isActive = true;
      if (req.query.status === 'paused') query.isActive = false;
      if (req.query.status === 'inactive') query.isActive = false;
    }

    if (req.query.country && req.query.country !== 'all') {
      if (req.query.country === 'IN') {
        andConditions.push({ $or: [{ country: 'IN' }, { country: { $exists: false } }, { country: null }] });
      } else {
        query.country = req.query.country;
      }
    }

    if (req.query.category && req.query.category !== 'all') {
      // Channels created before `category` existed have no such field — treat them as 'auto'
      // so filtering by Auto doesn't hide them.
      if (req.query.category === 'auto') {
        andConditions.push({ $or: [{ category: 'auto' }, { category: { $exists: false } }, { category: null }] });
      } else {
        query.category = req.query.category;
      }
    }

    if (req.query.relevance && req.query.relevance !== 'all' && RELEVANCE_VALUES.includes(req.query.relevance)) {
      if (req.query.relevance === 'unreviewed') {
        andConditions.push({ $or: [{ relevance: 'unreviewed' }, { relevance: { $exists: false } }, { relevance: null }] });
      } else {
        query.relevance = req.query.relevance;
      }
    } else if (req.query.hideNotRelevant === 'true') {
      // Declutters the default view without being a real filter selection — an explicit
      // relevance=not_relevant above always wins over this (you asked to see them).
      andConditions.push({ relevance: { $ne: 'not_relevant' } });
    }

    if (req.query.q) {
      const qStr = req.query.q.trim();
      if (qStr.length > 0) {
        const searchTokens = qStr.split(/\s+/).filter(Boolean);
        for (const token of searchTokens) {
          const regex = new RegExp(token, 'i');
          andConditions.push({
            $or: [
              { name: regex },
              { username: regex },
              { channelId: regex },
              { category: regex }
            ]
          });
        }
      }
    }

    if (andConditions.length > 0) query.$and = andConditions;

    const totalMatching = await Channel.countDocuments(query);
    const channels = await Channel.find(query).sort({ isActive: -1, dealsProducedCount: -1, createdAt: -1 });

    const totalChannels = await Channel.countDocuments();
    const activeChannels = await Channel.countDocuments({ isActive: true });

    const statsAgg = await Channel.aggregate([
      {
        $group: {
          _id: null,
          totalCaptured: { $sum: '$messagesCapturedCount' },
          totalDeals: { $sum: '$dealsProducedCount' }
        }
      }
    ]);

    const totalCaptured = statsAgg[0]?.totalCaptured || 0;
    const totalDeals = statsAgg[0]?.totalDeals || 0;

    // Relevance review progress — lets the admin see how much of the source list is still
    // unvetted without pulling every document client-side.
    const relevantChannels = await Channel.countDocuments({ relevance: 'relevant' });
    const notRelevantChannels = await Channel.countDocuments({ relevance: 'not_relevant' });
    const unreviewedChannels = totalChannels - relevantChannels - notRelevantChannels;

    res.json({
      success: true,
      channels,
      matchingCount: totalMatching,
      stats: {
        totalChannels,
        activeChannels,
        pausedChannels: totalChannels - activeChannels,
        totalCaptured,
        totalDeals,
        relevantChannels,
        notRelevantChannels,
        unreviewedChannels
      }
    });
  } catch (error) {
    console.error('[API Error] GET /api/channels failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels
 */
router.post('/', async (req, res) => {
  try {
    const { target, name } = req.body;
    if (!target) return res.status(400).json({ success: false, error: 'Channel username or ID is required' });

    const cleanTarget = target.replace('@', '').trim();
    let channel = await Channel.findOne({
      $or: [{ username: cleanTarget }, { channelId: cleanTarget }]
    });

    if (channel) {
      channel.isActive = true;
      await channel.save();
    } else {
      channel = await Channel.create({
        channelId: cleanTarget,
        username: cleanTarget,
        name: name || cleanTarget,
        isActive: true
      });
    }

    res.json({ success: true, channel });
  } catch (error) {
    console.error('[API Error] POST /api/channels failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/channels/:id and PATCH /api/channels/:id/status
 * Toggle channel active state
 */
const handleToggleChannel = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    if (req.body && typeof req.body.isActive === 'boolean') {
      channel.isActive = req.body.isActive;
    } else {
      channel.isActive = !channel.isActive;
    }
    await channel.save();
    res.json({ success: true, channel });
  } catch (error) {
    console.error('[API Error] PATCH /api/channels failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

router.patch('/:id', handleToggleChannel);
router.patch('/:id/status', handleToggleChannel);

/**
 * PATCH /api/channels/:id/category
 * Assign this channel's deal category. Accepts 'auto' (AI classifier decides per message)
 * or any live Master category slug — validated against Master, not a hardcoded list.
 */
router.patch('/:id/category', async (req, res) => {
  try {
    // `categoryPreference` accepted as an alias so older callers keep working.
    const category = req.body.category ?? req.body.categoryPreference;
    if (!(await isValidCategory(category))) {
      return res.status(400).json({ success: false, error: `Unknown category "${category}". Use 'auto' or a category defined in Master.` });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    channel.category = category;
    await channel.save();
    res.json({ success: true, channel });
  } catch (error) {
    console.error('[API Error] PATCH /api/channels category failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/channels/:id/relevance
 * Record the editorial judgement of whether this channel is worth monitoring.
 * Marking not_relevant also stops monitoring, so no further scrape/AI budget is spent on it.
 */
router.patch('/:id/relevance', async (req, res) => {
  try {
    const { relevance, note } = req.body;
    if (!RELEVANCE_VALUES.includes(relevance)) {
      return res.status(400).json({ success: false, error: `relevance must be one of: ${RELEVANCE_VALUES.join(', ')}` });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    channel.relevance = relevance;
    channel.relevanceNote = note || undefined;
    channel.relevanceReviewedAt = relevance === 'unreviewed' ? undefined : new Date();
    // Judgement drives state: irrelevant channels stop being monitored. Marking relevant
    // does NOT auto-enable — the admin still opts in explicitly via the Status switch.
    if (relevance === 'not_relevant') channel.isActive = false;

    await channel.save();
    res.json({ success: true, channel });
  } catch (error) {
    console.error('[API Error] PATCH /api/channels relevance failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/channels/:id/country
 * Update channel country
 */
router.patch('/:id/country', async (req, res) => {
  try {
    const { country } = req.body;
    if (!country) {
      return res.status(400).json({ success: false, error: 'Country code is required' });
    }

    const channel = await Channel.findById(req.params.id);
    if (!channel) return res.status(404).json({ success: false, error: 'Channel not found' });

    channel.country = country;
    await channel.save();
    res.json({ success: true, channel });
  } catch (error) {
    console.error('[API Error] PATCH /api/channels country failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/disable-all
 * Deactivate all monitored channels (set isActive = false)
 */
router.post('/disable-all', async (req, res) => {
  try {
    const result = await Channel.updateMany({}, { isActive: false });
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/disable-all failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/enable-deals
 * Enable all shopping & deal channels
 */
router.post('/enable-deals', async (req, res) => {
  try {
    const result = await Channel.updateMany({}, { isActive: true });
    res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/enable-deals failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/channels/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    res.json({ success: true, deleted: !!channel });
  } catch (error) {
    console.error('[API Error] DELETE /api/channels failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/bulk-delete
 */
router.post('/bulk-delete', async (req, res) => {
  try {
    const { channelIds } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'channelIds array is required' });
    }
    const result = await Channel.deleteMany({ _id: { $in: channelIds } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/bulk-delete failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/bulk-status
 */
router.post('/bulk-status', async (req, res) => {
  try {
    const { channelIds, isActive } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0 || typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'channelIds array and isActive boolean are required' });
    }
    const result = await Channel.updateMany(
      { _id: { $in: channelIds } },
      { $set: { isActive } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/bulk-status failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/bulk-country
 */
router.post('/bulk-country', async (req, res) => {
  try {
    const { channelIds, country } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0 || !country) {
      return res.status(400).json({ success: false, error: 'channelIds array and country string are required' });
    }
    const result = await Channel.updateMany(
      { _id: { $in: channelIds } },
      { $set: { country } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/bulk-country failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/bulk-category
 */
router.post('/bulk-category', async (req, res) => {
  try {
    const { channelIds, category } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'channelIds array is required' });
    }
    if (!(await isValidCategory(category))) {
      return res.status(400).json({ success: false, error: `Unknown category "${category}". Use 'auto' or a category defined in Master.` });
    }
    const result = await Channel.updateMany(
      { _id: { $in: channelIds } },
      { $set: { category } }
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/bulk-category failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channels/bulk-relevance
 * Same judgement→state rule as the single-channel route: not_relevant also stops monitoring.
 */
router.post('/bulk-relevance', async (req, res) => {
  try {
    const { channelIds, relevance } = req.body;
    if (!Array.isArray(channelIds) || channelIds.length === 0) {
      return res.status(400).json({ success: false, error: 'channelIds array is required' });
    }
    if (!RELEVANCE_VALUES.includes(relevance)) {
      return res.status(400).json({ success: false, error: `relevance must be one of: ${RELEVANCE_VALUES.join(', ')}` });
    }

    const set = { relevance };
    if (relevance === 'unreviewed') {
      set.relevanceReviewedAt = null;
    } else {
      set.relevanceReviewedAt = new Date();
    }
    if (relevance === 'not_relevant') set.isActive = false;

    const result = await Channel.updateMany({ _id: { $in: channelIds } }, { $set: set });
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('[API Error] POST /api/channels/bulk-relevance failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
