const express = require('express');
const router = express.Router();
const axios = require('axios');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const AttendanceSession = require('../models/AttendanceSession');

const RAW_ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001/api/ml/performance';
const ML_ANALYSIS_API_URL = RAW_ML_API_URL.includes('/api/ml/performance')
  ? RAW_ML_API_URL.replace(/\/$/, '')
  : `${RAW_ML_API_URL.replace(/\/$/, '')}/api/ml/performance`;

const formatStudentDataForAnalysis = (student) => ({
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
});

const parseLimit = (rawValue, defaultValue = 10, maxValue = 50) => {
  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(maxValue, Math.max(1, parsed));
};

const buildClassScopeText = (scope = {}) => {
  const year = scope.year || 'ALL';
  const branch = scope.branch || 'ALL';
  const division = scope.division || 'ALL';
  return `${year} ${branch} ${division}`;
};

// ==================== ADMIN DASHBOARD STATISTICS ====================

// GET Overall system statistics
router.get('/admin/overview', async (req, res) => {
  try {
    const [studentCount, facultyCount, userCount] = await Promise.all([
      Student.countDocuments({ isActive: true }),
      Faculty.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true })
    ]);

    const stats = {
      totalStudents: studentCount,
      totalFaculty: facultyCount,
      totalUsers: userCount,
      timestamp: new Date()
    };

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Detailed admin dashboard data
router.get('/admin/dashboard', async (req, res) => {
  try {
    const students = await Student.find({ isActive: true });
    const faculty = await Faculty.find({ isActive: true });

    // Student statistics
    const studentStats = {
      total: students.length,
      byYear: {},
      byBranch: {},
      avgCGPA: 0,
      avgAttendance: 0,
      withBacklogs: 0,
      placement: {
        placed: 0,
        eligible: 0,
        notEligible: 0,
        higherStudies: 0
      },
      atRisk: 0
    };

    let totalCGPA = 0;
    let totalAttendance = 0;

    students.forEach(student => {
      // By year
      studentStats.byYear[student.year] = (studentStats.byYear[student.year] || 0) + 1;
      
      // By branch
      studentStats.byBranch[student.branch] = (studentStats.byBranch[student.branch] || 0) + 1;
      
      // CGPA and attendance
      totalCGPA += student.cgpa || 0;
      totalAttendance += student.overallAttendance || 0;
      
      // Backlogs
      if (student.backlogs > 0) studentStats.withBacklogs++;
      
      // Placement
      if (student.placementStatus === 'Placed') studentStats.placement.placed++;
      else if (student.placementStatus === 'Eligible') studentStats.placement.eligible++;
      else if (student.placementStatus === 'Higher Studies') studentStats.placement.higherStudies++;
      else studentStats.placement.notEligible++;
      
      // At risk
      if (student.riskCategory === 'High' || student.cgpa < 6 || student.overallAttendance < 75) {
        studentStats.atRisk++;
      }
    });

    studentStats.avgCGPA = students.length > 0 ? (totalCGPA / students.length).toFixed(2) : 0;
    studentStats.avgAttendance = students.length > 0 ? (totalAttendance / students.length).toFixed(2) : 0;

    // Faculty statistics
    const facultyStats = {
      total: faculty.length,
      byDepartment: {},
      byDesignation: {},
      totalPublications: 0,
      avgExperience: 0
    };

    let totalExperience = 0;

    faculty.forEach(f => {
      facultyStats.byDepartment[f.department] = (facultyStats.byDepartment[f.department] || 0) + 1;
      facultyStats.byDesignation[f.designation] = (facultyStats.byDesignation[f.designation] || 0) + 1;
      facultyStats.totalPublications += f.publications?.length || 0;
      totalExperience += f.experience || 0;
    });

    facultyStats.avgExperience = faculty.length > 0 ? (totalExperience / faculty.length).toFixed(2) : 0;

    res.json({
      studentStats,
      facultyStats,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Performance analytics
router.get('/admin/performance', async (req, res) => {
  try {
    const { year, branch, division } = req.query;
    const query = { isActive: true };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (division) query.division = division;

    const students = await Student.find(query);

    const performance = {
      cgpaDistribution: {
        above9: 0,
        between8and9: 0,
        between7and8: 0,
        between6and7: 0,
        below6: 0
      },
      attendanceDistribution: {
        above90: 0,
        between80and90: 0,
        between75and80: 0,
        below75: 0
      },
      backlogDistribution: {
        zero: 0,
        one: 0,
        two: 0,
        moreThanTwo: 0
      },
      topPerformers: [],
      needsAttention: []
    };

    students.forEach(student => {
      // CGPA distribution
      if (student.cgpa >= 9) performance.cgpaDistribution.above9++;
      else if (student.cgpa >= 8) performance.cgpaDistribution.between8and9++;
      else if (student.cgpa >= 7) performance.cgpaDistribution.between7and8++;
      else if (student.cgpa >= 6) performance.cgpaDistribution.between6and7++;
      else performance.cgpaDistribution.below6++;

      // Attendance distribution
      const att = student.overallAttendance || 0;
      if (att >= 90) performance.attendanceDistribution.above90++;
      else if (att >= 80) performance.attendanceDistribution.between80and90++;
      else if (att >= 75) performance.attendanceDistribution.between75and80++;
      else performance.attendanceDistribution.below75++;

      // Backlog distribution
      if (student.backlogs === 0) performance.backlogDistribution.zero++;
      else if (student.backlogs === 1) performance.backlogDistribution.one++;
      else if (student.backlogs === 2) performance.backlogDistribution.two++;
      else performance.backlogDistribution.moreThanTwo++;
    });

    // Top performers (CGPA >= 8 and attendance >= 80)
    performance.topPerformers = students
      .filter(s => s.cgpa >= 8 && (s.overallAttendance || 0) >= 80)
      .sort((a, b) => b.cgpa - a.cgpa)
      .slice(0, 10)
      .map(s => ({
        prn: s.prn,
        name: s.studentName,
        cgpa: s.cgpa,
        attendance: s.overallAttendance,
        branch: s.branch,
        year: s.year
      }));

    // Needs attention (CGPA < 6 or attendance < 75 or backlogs > 0)
    performance.needsAttention = students
      .filter(s => s.cgpa < 6 || (s.overallAttendance || 0) < 75 || s.backlogs > 0)
      .map(s => ({
        prn: s.prn,
        name: s.studentName,
        cgpa: s.cgpa,
        attendance: s.overallAttendance,
        backlogs: s.backlogs,
        riskCategory: s.riskCategory
      }));

    res.json({ performance });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== STUDENT DASHBOARD ====================

// GET Student-specific dashboard
router.get('/student/:prn', async (req, res) => {
  try {
    const student = await Student.findOne({ prn: req.params.prn });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Current semester data
    const currentSemester = student.semesterMarks.find(
      s => s.semester === student.currentSemester
    ) || {};

    // Latest attendance
    const latestAttendance = student.attendance.length > 0
      ? student.attendance[student.attendance.length - 1]
      : {};

    // Calculate semester-wise progress
    const semesterProgress = student.semesterMarks.map(sem => ({
      semester: sem.semester,
      sgpa: sem.sgpa,
      credits: sem.totalCredits,
      status: sem.status
    }));

    let mlPrediction = {
      predictedCGPA: student.predictedCGPA,
      placementProbability: student.placementProbability,
      riskCategory: student.riskCategory,
      recommendations: student.recommendations
    };

    try {
      const studentData = formatStudentDataForAnalysis(student);
      const analysisResponse = await axios.post(
        `${ML_ANALYSIS_API_URL}/individual/${student._id}`,
        studentData,
        { timeout: 8000 }
      );
      const performance = analysisResponse.data?.performance || {};
      mlPrediction = {
        predictedCGPA: Number(student.predictedCGPA || student.cgpa || 0),
        placementProbability: Number(performance.placement_probability || student.placementProbability || 0),
        riskCategory: performance.risk_level || student.riskCategory || 'Unknown',
        recommendations: Array.isArray(performance.recommendations)
          ? performance.recommendations
          : (student.recommendations || [])
      };
    } catch (mlError) {
      // Keep dashboard available even if ML service is temporarily unavailable.
      console.warn('Student dashboard ML enrichment failed:', mlError.message);
    }

    const dashboard = {
      profile: {
        prn: student.prn,
        name: student.studentName,
        email: student.email,
        year: student.year,
        branch: student.branch,
        division: student.division
      },
      academics: {
        cgpa: student.cgpa,
        currentSemester: student.currentSemester,
        backlogs: student.backlogs,
        totalCredits: student.totalCreditsEarned,
        semesterProgress
      },
      attendance: {
        overall: student.overallAttendance,
        current: latestAttendance.overallPercentage || 0,
        subjects: latestAttendance.subjects || []
      },
      placement: {
        status: student.placementStatus,
        companyName: student.companyName,
        package: student.package
      },
      predictions: {
        predictedCGPA: mlPrediction.predictedCGPA,
        placementProbability: mlPrediction.placementProbability,
        riskCategory: mlPrediction.riskCategory,
        recommendations: mlPrediction.recommendations
      },
      achievements: {
        internships: student.internships?.length || 0,
        projects: student.projects?.length || 0,
        certifications: student.certifications?.length || 0,
        skills: student.skills?.length || 0
      }
    };

    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== FACULTY DASHBOARD ====================

// GET Faculty-specific dashboard
router.get('/faculty/:facultyId', async (req, res) => {
  try {
    const faculty = await Faculty.findOne({ facultyId: req.params.facultyId });
    
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    // Get students for assigned subjects
    const assignedDivisions = [...new Set(faculty.assignedSubjects.map(s => s.division))];
    const assignedYears = [...new Set(faculty.assignedSubjects.map(s => s.year))];

    const students = await Student.find({
      year: { $in: assignedYears },
      division: { $in: assignedDivisions },
      isActive: true
    });

    let mlAtRiskCount = students.filter(s => s.riskCategory === 'High').length;
    try {
      if (students.length > 0) {
        const studentsData = students.map(formatStudentDataForAnalysis);
        const mlStats = await axios.post(
          `${ML_ANALYSIS_API_URL}/faculty-statistics`,
          { students: studentsData },
          { timeout: 12000 }
        );
        mlAtRiskCount = Number(mlStats.data?.statistics?.students_at_risk || 0);
      }
    } catch (mlError) {
      console.warn('Faculty dashboard ML enrichment failed:', mlError.message);
    }

    const dashboard = {
      profile: {
        facultyId: faculty.facultyId,
        name: faculty.facultyName,
        email: faculty.email,
        department: faculty.department,
        designation: faculty.designation
      },
      teaching: {
        totalSubjects: faculty.assignedSubjects?.length || 0,
        subjects: faculty.assignedSubjects || [],
        totalStudents: students.length
      },
      studentStats: {
        total: students.length,
        avgCGPA: students.reduce((sum, s) => sum + (s.cgpa || 0), 0) / students.length || 0,
        avgAttendance: students.reduce((sum, s) => sum + (s.overallAttendance || 0), 0) / students.length || 0,
        withBacklogs: students.filter(s => s.backlogs > 0).length,
        atRisk: mlAtRiskCount
      },
      research: {
        publications: faculty.publications?.length || 0,
        researchAreas: faculty.researchAreas || []
      }
    };

    dashboard.studentStats.avgCGPA = parseFloat(dashboard.studentStats.avgCGPA.toFixed(2));
    dashboard.studentStats.avgAttendance = parseFloat(dashboard.studentStats.avgAttendance.toFixed(2));

    res.json({ dashboard });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Faculty recent activities
router.get('/faculty/:facultyId/activities', async (req, res) => {
  try {
    res.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=45');

    const requestedFacultyId = String(req.params.facultyId || '').trim().toUpperCase();
    const requesterRole = String(req.user?.role || '').toLowerCase();
    const requesterFacultyId = String(req.user?.referenceId || '').trim().toUpperCase();

    // Faculty can only access their own activity stream; admins can view any stream.
    if (requesterRole === 'faculty' && requesterFacultyId !== requestedFacultyId) {
      return res.status(403).json({ message: 'You can only access your own activity stream' });
    }

    const faculty = await Faculty.findOne({ facultyId: requestedFacultyId, isActive: true })
      .select('_id facultyId facultyName');

    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }

    const limit = parseLimit(req.query.limit, 10, 50);

    let ownerUserId = req.user?.userId;
    if (requesterRole !== 'faculty' || requesterFacultyId !== requestedFacultyId) {
      const ownerUser = await User.findOne({ role: 'faculty', referenceId: faculty.facultyId, isActive: true })
        .select('_id');
      ownerUserId = ownerUser?._id;
    }

    if (!ownerUserId) {
      return res.json({ activities: [], serverTime: new Date().toISOString() });
    }

    const [latestAssignments, latestCourses, latestAttendanceSessions] = await Promise.all([
      Assignment.find({ 'createdBy.userId': ownerUserId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('_id title dueDate targetYear targetBranch targetDivision createdAt')
        .lean(),
      Course.find({ 'createdBy.userId': ownerUserId, isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('_id title code year branch division createdAt')
        .lean(),
      AttendanceSession.find({ 'createdBy.userId': ownerUserId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('_id subjectName classScope createdAt')
        .lean()
    ]);

    const assignmentActivities = latestAssignments.map((assignment) => ({
      id: `assignment-${assignment._id}`,
      type: 'assignment',
      title: `Uploaded assignment for ${assignment.title}`,
      details: assignment.dueDate ? `Due ${new Date(assignment.dueDate).toLocaleDateString('en-GB')}` : '',
      timestamp: assignment.createdAt
    }));

    const courseActivities = latestCourses.map((course) => ({
      id: `course-${course._id}`,
      type: 'course',
      title: `Created course ${course.code || course.title}`,
      details: buildClassScopeText({
        year: course.year,
        branch: course.branch,
        division: course.division
      }),
      timestamp: course.createdAt
    }));

    const attendanceActivities = latestAttendanceSessions.map((session) => ({
      id: `attendance-${session._id}`,
      type: 'attendance',
      title: `Marked attendance for ${session.subjectName}`,
      details: buildClassScopeText(session.classScope),
      timestamp: session.createdAt
    }));

    const activities = [...assignmentActivities, ...courseActivities, ...attendanceActivities]
      .filter((activity) => activity.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      activities,
      serverTime: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Placement statistics
router.get('/placement/stats', async (req, res) => {
  try {
    const { year, branch } = req.query;
    const query = { isActive: true };

    if (year) query.year = year;
    if (branch) query.branch = branch;

    const students = await Student.find(query);

    const stats = {
      total: students.length,
      placed: students.filter(s => s.placementStatus === 'Placed').length,
      eligible: students.filter(s => s.placementStatus === 'Eligible').length,
      higherStudies: students.filter(s => s.placementStatus === 'Higher Studies').length,
      avgPackage: 0,
      maxPackage: 0,
      minPackage: 0,
      companiesVisited: new Set(),
      topCompanies: {}
    };

    const placedStudents = students.filter(s => s.placementStatus === 'Placed' && s.package);

    if (placedStudents.length > 0) {
      const packages = placedStudents.map(s => s.package);
      stats.avgPackage = (packages.reduce((sum, p) => sum + p, 0) / packages.length).toFixed(2);
      stats.maxPackage = Math.max(...packages);
      stats.minPackage = Math.min(...packages);

      placedStudents.forEach(s => {
        if (s.companyName) {
          stats.companiesVisited.add(s.companyName);
          stats.topCompanies[s.companyName] = (stats.topCompanies[s.companyName] || 0) + 1;
        }
      });
    }

    stats.companiesVisited = stats.companiesVisited.size;
    stats.placementPercentage = ((stats.placed / stats.total) * 100).toFixed(2);

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
