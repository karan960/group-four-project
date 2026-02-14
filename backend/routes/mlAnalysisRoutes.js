const express = require('express');
const router = express.Router();
const axios = require('axios');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001/api/ml/performance';

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
    
    // Fetch all students in the class
    const students = await Student.find({ 
      year, 
      branch, 
      division,
      isActive: true 
    });
    
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
    
    // Fetch all students in the class
    const students = await Student.find({ 
      year, 
      branch, 
      division,
      isActive: true 
    });
    
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
    
    // Fetch all students in the class
    const students = await Student.find({ 
      year, 
      branch, 
      division,
      isActive: true 
    });
    
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

module.exports = router;
