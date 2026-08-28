import express from 'express';
import Lead from '../db/models/lead.js';

const router = express.Router();

/**
 * GET /api/leads
 * List potential customers imported from WhatsApp groups, with search/filter + stats.
 */
router.get('/', async (req, res) => {
  try {
    const query = {};

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }
    if (req.query.sourceGroupId && req.query.sourceGroupId !== 'all') {
      query['sourceGroups.groupId'] = req.query.sourceGroupId;
    }
    if (req.query.tag) {
      query.tags = req.query.tag;
    }
    if (req.query.q) {
      const regex = new RegExp(req.query.q.trim(), 'i');
      query.$or = [{ phoneNumber: regex }, { name: regex }, { 'sourceGroups.groupName': regex }, { notes: regex }, { tags: regex }];
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 });

    const total = await Lead.countDocuments();
    const statusAgg = await Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    const groupAgg = await Lead.aggregate([
      { $unwind: '$sourceGroups' },
      { $group: { _id: { id: '$sourceGroups.groupId', name: '$sourceGroups.groupName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      leads,
      stats: {
        total,
        byStatus: Object.fromEntries(statusAgg.map(s => [s._id, s.count])),
        groups: groupAgg.map(g => ({ id: g._id.id, name: g._id.name, count: g.count }))
      }
    });
  } catch (err) {
    console.error('[API Error] GET /api/leads failed:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/leads
 * Body: { phoneNumber, name?, isMyContact?, isBusiness?, tags? }
 * Direct add (e.g. from the Contacts tab, not tied to any group import) — still merges by
 * phoneNumber like the group-import flow, so this never duplicates an existing lead either.
 */
router.post('/', async (req, res) => {
  try {
    const { phoneNumber, name, isMyContact, isBusiness, tags } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'phoneNumber is required.' });
    }

    const existing = await Lead.findOne({ phoneNumber });
    if (existing) {
      if (name && !existing.name) existing.name = name;
      if (isMyContact) existing.isMyContact = true;
      if (isBusiness) existing.isBusiness = true;
      if (Array.isArray(tags) && tags.length) {
        existing.tags = Array.from(new Set([...(existing.tags || []), ...tags]));
      }
      existing.updatedAt = new Date();
      await existing.save();
      return res.json({ success: true, lead: existing, merged: true });
    }

    const lead = await Lead.create({
      phoneNumber,
      name: name || '',
      isMyContact: !!isMyContact,
      isBusiness: !!isBusiness,
      tags: Array.isArray(tags) ? tags : [],
      sourceGroups: []
    });
    res.status(201).json({ success: true, lead, merged: false });
  } catch (err) {
    console.error('[API Error] POST /api/leads failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/leads/:id
 * Update tags, status, or notes on a lead.
 */
router.patch('/:id', async (req, res) => {
  try {
    const { tags, status, notes, name } = req.body;
    const update = { updatedAt: new Date() };
    if (tags !== undefined) update.tags = tags;
    if (status !== undefined) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (name !== undefined) update.name = name;

    const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

    res.json({ success: true, lead });
  } catch (err) {
    console.error(`[API Error] PATCH /api/leads/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    console.error(`[API Error] DELETE /api/leads/${req.params.id} failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
