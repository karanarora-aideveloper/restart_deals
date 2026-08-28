import express from 'express';
import Master from '../db/models/master.js';

const router = express.Router();

/**
 * GET /api/master/:type
 * Returns master data for a specific type (e.g. 'category', 'country')
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { activeOnly } = req.query;
    
    const query = { type };
    if (activeOnly === 'true') {
      query.isActive = true;
    }
    
    const data = await Master.find(query).sort({ label: 1 });
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[API Error] GET /api/master/${req.params.type} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/master/:type
 * Adds a new master data entry
 */
router.post('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { value, label, metadata, isActive } = req.body;
    
    if (!value || !label) {
      return res.status(400).json({ success: false, error: 'Value and label are required' });
    }
    
    const item = new Master({
      type,
      value: value.trim(),
      label: label.trim(),
      metadata: metadata || {},
      isActive: isActive !== undefined ? isActive : true
    });
    
    await item.save();
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error(`[API Error] POST /api/master/${req.params.type} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/master/:type/:id
 * Updates an existing master data entry
 */
router.put('/:type/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id; // prevent updating ID
    delete updateData.type; // prevent changing type
    
    const item = await Master.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!item) return res.status(404).json({ success: false, error: 'Item not found' });
    
    res.json({ success: true, item });
  } catch (error) {
    console.error(`[API Error] PUT /api/master/${req.params.type}/${req.params.id} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/master/:type/:id
 * Deletes a master data entry
 */
router.delete('/:type/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Master.findByIdAndDelete(id);
    if (!result) return res.status(404).json({ success: false, error: 'Item not found' });
    
    res.json({ success: true });
  } catch (error) {
    console.error(`[API Error] DELETE /api/master/${req.params.type}/${req.params.id} failed:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
