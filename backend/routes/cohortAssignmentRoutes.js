const express = require('express');
const router = express.Router();

const CohortAssignment = require('../models/CohortAssignment');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const ensureAdmin = (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
};

router.get('/', async (req, res) => {
  try {
    const { year, division } = req.query;
    const query = { isActive: true };
    if (year) query.year = year;
    if (division) query.division = String(division).toUpperCase();

    const assignments = await CohortAssignment.find(query).sort({ year: 1, division: 1 });
    res.json({ assignments, total: assignments.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:year/:division', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { year, division } = req.params;
    const normalizedDivision = String(division || '').trim().toUpperCase();
    const { primaryFacultyId, supportFacultyIds = [], coordinatorFacultyId = '', notes = '' } = req.body || {};

    if (!primaryFacultyId) {
      return res.status(400).json({ message: 'primaryFacultyId is required' });
    }

    const primary = await Faculty.findOne({ facultyId: primaryFacultyId, isActive: true }).lean();
    if (!primary) {
      return res.status(404).json({ message: 'Primary faculty not found' });
    }

    const assignment = await CohortAssignment.findOneAndUpdate(
      { year, division: normalizedDivision },
      {
        year,
        division: normalizedDivision,
        primaryFacultyId,
        supportFacultyIds: Array.from(new Set((supportFacultyIds || []).filter(Boolean))),
        coordinatorFacultyId: coordinatorFacultyId || '',
        notes,
        isActive: true,
        updatedBy: req.user?.username || req.user?.referenceId || 'admin'
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ message: 'Cohort assignment saved successfully', assignment });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:year/:division', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { year, division } = req.params;
    const normalizedDivision = String(division || '').trim().toUpperCase();

    const assignment = await CohortAssignment.findOneAndUpdate(
      { year, division: normalizedDivision },
      { isActive: false, updatedBy: req.user?.username || 'admin' },
      { new: true }
    );

    if (!assignment) {
      return res.status(404).json({ message: 'Cohort assignment not found' });
    }

    res.json({ message: 'Cohort assignment deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/faculty/:facultyId', async (req, res) => {
  try {
    const { facultyId } = req.params;
    const assignments = await CohortAssignment.find({
      isActive: true,
      $or: [
        { primaryFacultyId: facultyId },
        { supportFacultyIds: facultyId },
        { coordinatorFacultyId: facultyId }
      ]
    }).sort({ year: 1, division: 1 });

    res.json({ assignments, total: assignments.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/student/:prn', async (req, res) => {
  try {
    const student = await Student.findOne({ prn: req.params.prn, isActive: true }).lean();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const assignment = await CohortAssignment.findOne({
      isActive: true,
      year: student.year,
      division: student.division
    }).lean();

    res.json({
      student: {
        prn: student.prn,
        studentName: student.studentName,
        year: student.year,
        division: student.division
      },
      assignment: assignment || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
