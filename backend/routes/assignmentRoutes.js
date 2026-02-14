const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const Course = require('../models/Course');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

// Multer setup for assignment submissions/attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/assignments';
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

// ==================== GET ASSIGNMENTS ====================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;
    const { courseId } = req.query;

    let query = { isPublished: true };

    if (courseId) {
      query.courseId = courseId;
    }

    if (userRole === 'faculty') {
      query['createdBy.userId'] = userId;
    } else if (userRole === 'student') {
      const student = await Student.findOne({ prn: referenceId });
      if (!student) {
        return res.json({ assignments: [] });
      }
      query.targetYear = student.year;
      query.targetBranch = student.branch;
      query.targetDivision = student.division;
    }

    const assignments = await Assignment.find(query)
      .sort({ createdAt: -1 })
      .lean();

    if (userRole === 'student' && assignments.length > 0) {
      const assignmentIds = assignments.map(a => a._id);
      const submissions = await AssignmentSubmission.find({
        assignmentId: { $in: assignmentIds },
        'student.userId': userId
      }).lean();

      const submissionMap = new Map(submissions.map(s => [s.assignmentId.toString(), s]));

      const enriched = assignments.map(a => ({
        ...a,
        mySubmission: submissionMap.get(a._id.toString()) || null
      }));

      return res.json({ assignments: enriched });
    }

    if (userRole === 'faculty' && assignments.length > 0) {
      const assignmentIds = assignments.map(a => a._id);
      const counts = await AssignmentSubmission.aggregate([
        { $match: { assignmentId: { $in: assignmentIds } } },
        { $group: { _id: '$assignmentId', count: { $sum: 1 } } }
      ]);
      const countMap = new Map(counts.map(c => [c._id.toString(), c.count]));
      const enriched = assignments.map(a => ({
        ...a,
        submissionCount: countMap.get(a._id.toString()) || 0
      }));
      return res.json({ assignments: enriched });
    }

    res.json({ assignments });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== CREATE ASSIGNMENT (FACULTY) ====================
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const username = req.user.username;
    const referenceId = req.user.referenceId || null;

    if (userRole !== 'faculty') {
      return res.status(403).json({ message: 'Only faculty can create assignments' });
    }

    const { courseId, title, description, dueDate, totalMarks } = req.body;

    if (!courseId || !title || !dueDate) {
      return res.status(400).json({ message: 'Course, title, and due date are required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Assignment PDF is required' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const faculty = await Faculty.findOne({ facultyId: referenceId });

    const assignment = new Assignment({
      courseId,
      title,
      description,
      dueDate: new Date(dueDate),
      totalMarks,
      attachmentUrl: `/${req.file.path.replace(/\\/g, '/')}`,
      targetYear: course.year,
      targetBranch: course.branch,
      targetDivision: course.division,
      createdBy: {
        userId,
        username,
        facultyId: referenceId,
        name: faculty?.facultyName || username
      },
      isPublished: true
    });

    await assignment.save();
    res.status(201).json({ message: 'Assignment created successfully', assignment });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET SUBMISSIONS FOR ASSIGNMENT (FACULTY) ====================
router.get('/:assignmentId/submissions', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const assignmentId = req.params.assignmentId;

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    if (userRole !== 'faculty' && userRole !== 'admin') {
      return res.status(403).json({ message: 'Only faculty can view submissions' });
    }

    if (userRole === 'faculty' && assignment.createdBy.userId.toString() !== userId) {
      return res.status(403).json({ message: 'You can only view your own assignment submissions' });
    }

    const submissions = await AssignmentSubmission.find({ assignmentId })
      .sort({ submittedAt: -1 });

    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SUBMIT ASSIGNMENT (STUDENT) ====================
router.post('/:assignmentId/submissions', upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const username = req.user.username;
    const referenceId = req.user.referenceId || null;
    const assignmentId = req.params.assignmentId;

    if (userRole !== 'student') {
      return res.status(403).json({ message: 'Only students can submit assignments' });
    }

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const student = await Student.findOne({ prn: referenceId });

    if (!req.file) {
      return res.status(400).json({ message: 'PDF file is required for submission' });
    }

    const submissionText = req.body.submissionText || '';
    const fileUrl = `/${req.file.path.replace(/\\/g, '/')}`;

    const update = {
      assignmentId,
      student: {
        userId,
        prn: referenceId,
        name: student?.studentName || username
      },
      submissionText,
      fileUrl,
      submittedAt: new Date(),
      status: 'submitted'
    };

    const submission = await AssignmentSubmission.findOneAndUpdate(
      { assignmentId, 'student.userId': userId },
      update,
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Assignment submitted successfully', submission });
  } catch (error) {
    console.error('Error submitting assignment:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET MY SUBMISSION (STUDENT) ====================
router.get('/:assignmentId/submission/me', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const assignmentId = req.params.assignmentId;

    if (userRole !== 'student') {
      return res.status(403).json({ message: 'Only students can view their submission' });
    }

    const submission = await AssignmentSubmission.findOne({ assignmentId, 'student.userId': userId });
    res.json({ submission });
  } catch (error) {
    console.error('Error fetching my submission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
