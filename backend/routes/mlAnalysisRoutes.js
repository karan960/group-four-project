const express = require('express');
const router = express.Router();
const axios = require('axios');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const RAW_ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001/api/ml/performance';
const ML_API_URL = RAW_ML_API_URL.includes('/api/ml/performance')
  ? RAW_ML_API_URL.replace(/\/$/, '')
  : `${RAW_ML_API_URL.replace(/\/$/, '')}/api/ml/performance`;

const buildStudentQuery = ({ year, branch, division }) => {
  const query = { isActive: true };
  if (year) query.year = year;
  if (branch) query.branch = branch;
  if (division) query.division = division;
  return query;
};

const ensureAdmin = (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return false;
  }
  return true;
};

// ==================== HELPER FUNCTION ====================

/**
 * Format student data for ML model
 */
const formatStudentData = (student) => {
  return {
    prn: student.prn,
    studentName: student.studentName,
    rollNo: student.rollNo,
    cgpa: student.cgpa || 0,
    overallAttendance: student.overallAttendance || 0,
    semesterMarks: student.semesterMarks || [],
    attendance: student.attendance || [],
    backlogs: student.backlogs || 0,
    year: student.year,
    branch: student.branch,
    division: student.division
  };
};

// ==================== PERFORMANCE ANALYSIS ROUTES ====================

/**
 * GET individual student performance analysis
 * GET /api/ml-analysis/student/:id
 */
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Fetch student data from database
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const studentData = formatStudentData(student);
    
    // Call ML API
    const response = await axios.post(
      `${ML_API_URL}/individual/${studentId}`,
      studentData
    );
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Error in individual performance analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze student performance',
      details: error.message 
    });
  }
});

/**
 * GET subject-wise performance for a student
 * GET /api/ml-analysis/student/:id/subjects
 */
router.get('/student/:studentId/subjects', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const studentData = formatStudentData(student);
    
    // Call ML API for subject-wise analysis
    const response = await axios.post(
      `${ML_API_URL}/subject-wise/${studentId}`,
      studentData
    );
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Error in subject-wise analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze subject-wise performance',
      details: error.message 
    });
  }
});

/**
 * GET improvement trend for a student
 * GET /api/ml-analysis/student/:id/improvement
 */
router.get('/student/:studentId/improvement', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const student = await Student.findById(studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const studentData = formatStudentData(student);
    
    // Call ML API for improvement analysis
    const response = await axios.post(
      `${ML_API_URL}/improvement-analysis/${studentId}`,
      studentData
    );
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Error in improvement analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze improvement trend',
      details: error.message 
    });
  }
});

/**
 * POST faculty-wide statistics for a class/section
 * POST /api/ml-analysis/class-statistics
 */
router.post('/class-statistics', async (req, res) => {
  try {
    const { year, branch, division } = req.body;

    // Fetch students with optional filters
    const students = await Student.find(buildStudentQuery({ year, branch, division }));
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found for this class' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Call ML API for faculty statistics
    const response = await axios.post(
      `${ML_API_URL}/faculty-statistics`,
      { students: studentsData }
    );
    
    res.json({
      ...response.data,
      class_info: { year, branch, division, total_students: students.length }
    });
    
  } catch (error) {
    console.error('Error in class statistics:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch class statistics',
      details: error.message 
    });
  }
});

/**
 * POST at-risk students analysis for a class
 * POST /api/ml-analysis/at-risk-students
 */
router.post('/at-risk-students', async (req, res) => {
  try {
    const { year, branch, division } = req.body;

    // Fetch students with optional filters
    const students = await Student.find(buildStudentQuery({ year, branch, division }));
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found for this class' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Call ML API for at-risk analysis
    const response = await axios.post(
      `${ML_API_URL}/at-risk-students`,
      { students: studentsData }
    );
    
    res.json({
      ...response.data,
      class_info: { year, branch, division }
    });
    
  } catch (error) {
    console.error('Error in at-risk analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze at-risk students',
      details: error.message 
    });
  }
});

/**
 * POST compare multiple students performance
 * POST /api/ml-analysis/compare-students
 */
router.post('/compare-students', async (req, res) => {
  try {
    const { studentIds } = req.body;
    
    if (!studentIds || studentIds.length === 0) {
      return res.status(400).json({ error: 'No student IDs provided' });
    }
    
    // Fetch student data
    const students = await Student.find({ 
      _id: { $in: studentIds },
      isActive: true 
    });
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Call ML API for comparison
    const response = await axios.post(
      `${ML_API_URL}/compare-students`,
      { students: studentsData }
    );
    
    res.json(response.data);
    
  } catch (error) {
    console.error('Error in student comparison:', error.message);
    res.status(500).json({ 
      error: 'Failed to compare students',
      details: error.message 
    });
  }
});

/**
 * POST subject performance analysis
 * POST /api/ml-analysis/subject-analysis
 */
router.post('/subject-analysis', async (req, res) => {
  try {
    const { subject_name, year, branch, division } = req.body;

    // Fetch students with optional filters
    const students = await Student.find(buildStudentQuery({ year, branch, division }));
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found for this class' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Call ML API for subject analysis
    const response = await axios.post(
      `${ML_API_URL}/subject-analysis`,
      { 
        subject_name: subject_name || 'All Subjects',
        students: studentsData 
      }
    );
    
    res.json({
      ...response.data,
      class_info: { year, branch, division }
    });
    
  } catch (error) {
    console.error('Error in subject analysis:', error.message);
    res.status(500).json({ 
      error: 'Failed to analyze subject performance',
      details: error.message 
    });
  }
});

/**
 * GET faculty dashboard analytics
 * GET /api/ml-analysis/faculty/:facultyId/dashboard
 */
router.get('/faculty/:facultyId/dashboard', async (req, res) => {
  try {
    const { facultyId } = req.params;
    
    // Fetch faculty information
    const faculty = await Faculty.findById(facultyId);
    
    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }
    
    // Get all classes taught by faculty
    const subjects = faculty.subjectsTaught || [];
    
    // Fetch students enrolled in those subjects
    const students = await Student.find({
      isActive: true
    });
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Get faculty statistics
    const statsResponse = await axios.post(
      `${ML_API_URL}/faculty-statistics`,
      { students: studentsData }
    );
    
    // Get at-risk students
    const atRiskResponse = await axios.post(
      `${ML_API_URL}/at-risk-students`,
      { students: studentsData }
    );
    
    res.json({
      faculty_name: faculty.facultyName,
      overall_statistics: statsResponse.data.statistics,
      at_risk_analysis: atRiskResponse.data,
      subjects_taught: subjects,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in faculty dashboard:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch faculty dashboard',
      details: error.message 
    });
  }
});

/**
 * GET overall institution statistics
 * GET /api/ml-analysis/institution-stats
 */
router.get('/institution-stats', async (req, res) => {
  try {
    // Fetch all active students
    const students = await Student.find({ isActive: true });
    
    if (students.length === 0) {
      return res.status(404).json({ error: 'No students found' });
    }
    
    const studentsData = students.map(formatStudentData);
    
    // Get institution-wide statistics
    const response = await axios.post(
      `${ML_API_URL}/faculty-statistics`,
      { students: studentsData }
    );
    
    res.json({
      institution_name: 'Campus Connect',
      total_students: students.length,
      statistics: response.data.statistics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in institution stats:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch institution statistics',
      details: error.message 
    });
  }
});

/**
 * GET current ML model metadata
 * GET /api/ml-analysis/model-info
 */
router.get('/model-info', async (req, res) => {
  try {
    const response = await axios.get(`${ML_API_URL}/model-info`);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching model info:', error.message);
    res.status(500).json({
      error: 'Failed to fetch model info',
      details: error.message
    });
  }
});

/**
 * POST train model from database students
 * POST /api/ml-analysis/train-model
 */
router.post('/train-model', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { year, branch, division } = req.body || {};
    const students = await Student.find(buildStudentQuery({ year, branch, division }));

    if (!students.length) {
      return res.status(404).json({ error: 'No students found for training' });
    }

    const studentsData = students.map(formatStudentData);
    const response = await axios.post(`${ML_API_URL}/train-db`, { students: studentsData });

    res.json({
      ...response.data,
      trainingScope: {
        totalStudents: students.length,
        year: year || 'All',
        branch: branch || 'All',
        division: division || 'All'
      }
    });
  } catch (error) {
    console.error('Error training model:', error.message);
    res.status(500).json({
      error: 'Failed to train model',
      details: error.message
    });
  }
});

/**
 * POST save model artifact (admin only)
 * POST /api/ml-analysis/save-model
 */
router.post('/save-model', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { path: modelPath = 'models/performance_model.joblib' } = req.body || {};
    const response = await axios.post(`${ML_API_URL}/save-model`, { path: modelPath });
    res.json(response.data);
  } catch (error) {
    console.error('Error saving model:', error.message);
    res.status(500).json({
      error: 'Failed to save model',
      details: error.message
    });
  }
});

/**
 * POST load model artifact (admin only)
 * POST /api/ml-analysis/load-model
 */
router.post('/load-model', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { path: modelPath = 'models/performance_model.joblib' } = req.body || {};
    const response = await axios.post(`${ML_API_URL}/load-model`, { path: modelPath });
    res.json(response.data);
  } catch (error) {
    console.error('Error loading model:', error.message);
    res.status(500).json({
      error: 'Failed to load model',
      details: error.message
    });
  }
});

/**
 * GET student ML analysis by PRN (for student dashboard)
 * GET /api/ml-analysis/student-prn/:prn
 */
router.get('/student-prn/:prn', async (req, res) => {
  try {
    const { prn } = req.params;
    const student = await Student.findOne({ prn, isActive: true });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentData = formatStudentData(student);

    const [individual, subjects, improvement] = await Promise.all([
      axios.post(`${ML_API_URL}/individual/${student._id}`, studentData),
      axios.post(`${ML_API_URL}/subject-wise/${student._id}`, studentData),
      axios.post(`${ML_API_URL}/improvement-analysis/${student._id}`, studentData).catch(() => ({ data: null }))
    ]);

    res.json({
      success: true,
      student: {
        _id: student._id,
        prn: student.prn,
        studentName: student.studentName
      },
      individual: individual.data,
      subjects: subjects.data,
      improvement: improvement?.data || null
    });
  } catch (error) {
    console.error('Error fetching student PRN analysis:', error.message);
    res.status(500).json({
      error: 'Failed to fetch student analysis',
      details: error.message
    });
  }
});

/**
 * GET faculty subject analysis based on assigned subjects and department
 * GET /api/ml-analysis/faculty/:facultyId/subject-analysis
 */
router.get('/faculty/:facultyId/subject-analysis', async (req, res) => {
  try {
    const { facultyId } = req.params;
    let faculty = null;
    if (facultyId.match(/^[0-9a-fA-F]{24}$/)) {
      faculty = await Faculty.findById(facultyId);
    }
    if (!faculty) {
      faculty = await Faculty.findOne({ facultyId: facultyId.toUpperCase() });
    }

    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const query = { isActive: true };
    if (faculty.department) {
      query.$or = [{ branch: faculty.department }, { department: faculty.department }];
    }

    const students = await Student.find(query);

    if (!students.length) {
      return res.status(404).json({ error: 'No students found for this faculty scope' });
    }

    const studentsData = students.map(formatStudentData);
    const subjects = faculty.assignedSubjects || [];

    const subjectResults = [];
    for (const subject of subjects) {
      const subjectName = subject.subjectName || 'All Subjects';
      const response = await axios.post(`${ML_API_URL}/subject-analysis`, {
        subject_name: subjectName,
        students: studentsData
      });
      subjectResults.push({
        subject: subjectName,
        stats: response.data?.statistics || {}
      });
    }

    if (!subjectResults.length) {
      const fallback = await axios.post(`${ML_API_URL}/subject-analysis`, {
        subject_name: 'All Subjects',
        students: studentsData
      });
      subjectResults.push({
        subject: 'All Subjects',
        stats: fallback.data?.statistics || {}
      });
    }

    res.json({
      success: true,
      faculty: {
        _id: faculty._id,
        facultyName: faculty.facultyName,
        department: faculty.department
      },
      subjects: subjectResults
    });
  } catch (error) {
    console.error('Error fetching faculty subject analysis:', error.message);
    res.status(500).json({
      error: 'Failed to fetch faculty subject analysis',
      details: error.message
    });
  }
});

/**
 * GET faculty-wide student analysis summary list
 * GET /api/ml-analysis/faculty/:facultyId/students-analysis
 */
router.get('/faculty/:facultyId/students-analysis', async (req, res) => {
  try {
    const { facultyId } = req.params;
    const { year, division } = req.query;
    let faculty = null;
    if (facultyId.match(/^[0-9a-fA-F]{24}$/)) {
      faculty = await Faculty.findById(facultyId);
    }
    if (!faculty) {
      faculty = await Faculty.findOne({ facultyId: facultyId.toUpperCase() });
    }

    if (!faculty) {
      return res.status(404).json({ error: 'Faculty not found' });
    }

    const scopedQuery = { isActive: true };
    if (faculty.department) {
      scopedQuery.$or = [{ branch: faculty.department }, { department: faculty.department }];
    }
    if (year) scopedQuery.year = year;
    if (division) scopedQuery.division = division;

    let students = await Student.find(scopedQuery).sort({ studentName: 1 });

    // If faculty department mapping doesn't match stored student branch values,
    // fall back to all active students so the Students tab is always populated.
    if (!students.length) {
      const fallbackQuery = { isActive: true };
      if (year) fallbackQuery.year = year;
      if (division) fallbackQuery.division = division;
      students = await Student.find(fallbackQuery).sort({ studentName: 1 });
    }

    if (!students.length) {
      return res.status(404).json({ error: 'No students found for this faculty scope' });
    }

    const analyzedStudents = await Promise.all(
      students.map(async (student) => {
        const studentData = formatStudentData(student);
        try {
          const response = await axios.post(`${ML_API_URL}/individual/${student._id}`, studentData);
          const perf = response.data?.performance || {};
          return {
            _id: student._id,
            prn: student.prn,
            studentName: student.studentName,
            year: student.year,
            division: student.division,
            cgpa: student.cgpa || 0,
            overallAttendance: student.overallAttendance || 0,
            status: perf.performance_category || 'Average',
            riskLevel: perf.risk_level || 'Medium Risk'
          };
        } catch (error) {
          return {
            _id: student._id,
            prn: student.prn,
            studentName: student.studentName,
            year: student.year,
            division: student.division,
            cgpa: student.cgpa || 0,
            overallAttendance: student.overallAttendance || 0,
            status: 'Analysis Pending',
            riskLevel: 'Unknown'
          };
        }
      })
    );

    res.json({
      success: true,
      faculty: {
        _id: faculty._id,
        facultyName: faculty.facultyName,
        department: faculty.department
      },
      totalStudents: analyzedStudents.length,
      students: analyzedStudents
    });
  } catch (error) {
    console.error('Error fetching faculty students analysis list:', error.message);
    res.status(500).json({
      error: 'Failed to fetch faculty students analysis',
      details: error.message
    });
  }
});

/**
 * GET complete analysis payload for a student
 * GET /api/ml-analysis/student/:studentId/full-analysis
 */
router.get('/student/:studentId/full-analysis', async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentData = formatStudentData(student);
    const [individual, subjects, improvement] = await Promise.all([
      axios.post(`${ML_API_URL}/individual/${studentId}`, studentData),
      axios.post(`${ML_API_URL}/subject-wise/${studentId}`, studentData),
      axios.post(`${ML_API_URL}/improvement-analysis/${studentId}`, studentData).catch(() => ({ data: null }))
    ]);

    res.json({
      success: true,
      student: {
        _id: student._id,
        prn: student.prn,
        studentName: student.studentName,
        year: student.year,
        division: student.division
      },
      individual: individual.data,
      subjects: subjects.data,
      improvement: improvement?.data || null
    });
  } catch (error) {
    console.error('Error fetching full student analysis:', error.message);
    res.status(500).json({
      error: 'Failed to fetch full student analysis',
      details: error.message
    });
  }
});

module.exports = router;
