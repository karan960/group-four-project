const express = require('express');
const Timetable = require('../models/Timetable');

const router = express.Router();

router.get('/public/timetable/active', async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ isPublished: true, isActive: true }).sort({ updatedAt: -1 });
    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable found' });
    }

    res.json({ timetable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch active timetable', error: error.message });
  }
});

router.get('/public/batches', async (req, res) => {
  try {
    const timetable = await Timetable.findOne({ isPublished: true, isActive: true }).sort({ updatedAt: -1 });
    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable found' });
    }

    res.json({
      className: timetable.className,
      division: timetable.division,
      batches: timetable.batchDetails || []
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch batch details', error: error.message });
  }
});

module.exports = router;
