const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Course = require('../models/Course');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const User = require('../models/User');

// Multer setup for course PDFs
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/courses';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    if (!isPdf) {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

// ==================== GET COURSES ====================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;

    let query = { isActive: true };

    if (userRole === 'faculty') {
      query['createdBy.userId'] = userId;
    } else if (userRole === 'student') {
      const student = await Student.findOne({ prn: referenceId });
      if (!student) {
        return res.json({ courses: [] });
      }
      query.year = student.year;
      query.branch = student.branch;
      query.division = student.division;
    }

    const courses = await Course.find(query).sort({ createdAt: -1 });
    res.json({ courses });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== CREATE COURSE (FACULTY) ====================
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const username = req.user.username;
    const referenceId = req.user.referenceId || null;

    if (userRole !== 'faculty') {
      return res.status(403).json({ message: 'Only faculty can create courses' });
    }

    const { title, code, description, year, branch, division, semester } = req.body;

    if (!title || !code || !year || !branch || !division) {
      return res.status(400).json({ message: 'Title, code, year, branch, and division are required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Course PDF is required' });
    }

    const faculty = await Faculty.findOne({ facultyId: referenceId });

    const course = new Course({
      title,
      code,
      description,
      attachmentUrl: `/${req.file.path.replace(/\\/g, '/')}`,
      year,
      branch,
      division,
      semester,
      createdBy: {
        userId,
        username,
        facultyId: referenceId,
        name: faculty?.facultyName || username
      }
    });

    await course.save();
    res.status(201).json({ message: 'Course created successfully', course });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
