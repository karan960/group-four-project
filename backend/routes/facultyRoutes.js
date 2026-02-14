const express = require('express');
const router = express.Router();
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ==================== FACULTY CRUD OPERATIONS ====================

// GET all faculty with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      department,
      designation,
      search,
      sortBy = 'facultyName',
      order = 'asc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (department) query.department = department;
    if (designation) query.designation = designation;
    if (search) {
      query.$or = [
        { facultyName: { $regex: search, $options: 'i' } },
        { facultyId: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    const faculty = await Faculty.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Faculty.countDocuments(query);

    res.json({
      faculty,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET faculty by ID
router.get('/:facultyId', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ facultyId: req.params.facultyId });
    
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.json({ faculty });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET faculty profile with details
router.get('/:facultyId/profile', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ facultyId: req.params.facultyId });
    
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.json({ 
      faculty,
      summary: {
        totalSubjects: faculty.assignedSubjects?.length || 0,
        totalPublications: faculty.publications?.length || 0,
        experience: faculty.experience || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create new faculty
router.post('/', async (req, res) => {
  try {
    const facultyData = req.body;

    // Check if faculty already exists
    const existingFaculty = await Faculty.findOne({ facultyId: facultyData.facultyId });
    if (existingFaculty) {
      return res.status(400).json({ message: 'Faculty with this ID already exists' });
    }

    // Create faculty
    const faculty = new Faculty(facultyData);
    await faculty.save();

    // Auto-create user account with Faculty ID as username
    const defaultPassword = await bcrypt.hash(facultyData.facultyId, 10);
    const user = new User({
      username: facultyData.facultyId,
      password: defaultPassword,
      role: 'faculty',
      referenceId: facultyData.facultyId
    });
    await user.save();

    res.status(201).json({ 
      message: 'Faculty created successfully',
      faculty,
      credentials: {
        username: facultyData.facultyId,
        defaultPassword: facultyData.facultyId,
        note: 'Faculty should change password on first login'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update faculty
router.put('/:facultyId', async (req, res) => {
  try {
    const faculty = await Faculty.findOneAndUpdate(
      { facultyId: req.params.facultyId },
      { ...req.body, lastUpdated: Date.now() },
      { new: true, runValidators: true }
    );

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    res.json({ message: 'Faculty updated successfully', faculty });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE faculty (soft delete)
router.delete('/:facultyId', async (req, res) => {
  try {
    const faculty = await Faculty.findOneAndUpdate(
      { facultyId: req.params.facultyId },
      { isActive: false, lastUpdated: Date.now() },
      { new: true }
    );

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Also deactivate user account
    await User.findOneAndUpdate(
      { username: req.params.facultyId },
      { isActive: false }
    );

    res.json({ message: 'Faculty deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SUBJECT ASSIGNMENT ====================

// POST assign subject to faculty
router.post('/:facultyId/subjects', async (req, res) => {
  try {
    const { subjectCode, subjectName, year, division, semester } = req.body;
    
    const faculty = await Faculty.findOne({ facultyId: req.params.facultyId });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Check if subject already assigned
    const existingAssignment = faculty.assignedSubjects.find(
      s => s.subjectCode === subjectCode && s.division === division
    );

    if (existingAssignment) {
      return res.status(400).json({ message: 'Subject already assigned to this faculty for this division' });
    }

    faculty.assignedSubjects.push({
      subjectCode,
      subjectName,
      year,
      division,
      semester
    });

    await faculty.save();

    res.json({ 
      message: 'Subject assigned successfully',
      assignedSubjects: faculty.assignedSubjects
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE remove subject assignment
router.delete('/:facultyId/subjects/:subjectCode', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ facultyId: req.params.facultyId });
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    faculty.assignedSubjects = faculty.assignedSubjects.filter(
      s => s.subjectCode !== req.params.subjectCode
    );

    await faculty.save();

    res.json({ 
      message: 'Subject assignment removed successfully',
      assignedSubjects: faculty.assignedSubjects
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== STATISTICS ====================

// GET faculty statistics by department
router.get('/stats/summary', async (req, res) => {
  try {
    const { department } = req.query;
    const query = { isActive: true };

    if (department) query.department = department;

    const faculty = await Faculty.find(query);

    const stats = {
      total: faculty.length,
      byDepartment: {},
      byDesignation: {},
      totalPublications: faculty.reduce((sum, f) => sum + (f.publications?.length || 0), 0),
      avgExperience: faculty.reduce((sum, f) => sum + (f.experience || 0), 0) / faculty.length || 0
    };

    // Group by department
    faculty.forEach(f => {
      stats.byDepartment[f.department] = (stats.byDepartment[f.department] || 0) + 1;
      stats.byDesignation[f.designation] = (stats.byDesignation[f.designation] || 0) + 1;
    });

    stats.avgExperience = parseFloat(stats.avgExperience.toFixed(2));

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
