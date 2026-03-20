const express = require('express');
const router = express.Router();
const PlacementShowcase = require('../models/PlacementShowcase');

const ensureAdmin = (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
};

router.get('/', async (req, res) => {
  try {
    const { year, branch, placedYear, limit = 50 } = req.query;
    const query = { isActive: true };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (placedYear) query.placedYear = Number(placedYear);

    const numericLimit = Math.min(200, Math.max(1, Number(limit) || 50));

    const placements = await PlacementShowcase.find(query)
      .sort({ placedYear: -1, createdAt: -1 })
      .limit(numericLimit);

    res.json({ placements });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const placement = new PlacementShowcase({
      ...req.body,
      createdBy: req.user?.username || 'admin',
      updatedBy: req.user?.username || 'admin'
    });

    await placement.save();
    res.status(201).json({ message: 'Placement showcase entry created', placement });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const placement = await PlacementShowcase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user?.username || 'admin' },
      { new: true, runValidators: true }
    );

    if (!placement) {
      return res.status(404).json({ message: 'Placement entry not found' });
    }

    res.json({ message: 'Placement showcase entry updated', placement });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const placement = await PlacementShowcase.findByIdAndUpdate(
      req.params.id,
      { isActive: false, updatedBy: req.user?.username || 'admin' },
      { new: true }
    );

    if (!placement) {
      return res.status(404).json({ message: 'Placement entry not found' });
    }

    res.json({ message: 'Placement showcase entry removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
