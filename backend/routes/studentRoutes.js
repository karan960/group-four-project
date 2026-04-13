const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { ensureAttendanceInterventionItem } = require('../utils/erpWorkflowService');

const ensureAdmin = (req, res) => {
  if (String(req.user?.role || '').toLowerCase() !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return false;
  }
  return true;
};

// ==================== STUDENT CRUD OPERATIONS ====================

// GET placement records with year-wise filters (admin)
router.get('/placements', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { year, placementStatus, search } = req.query;
    const query = { isActive: true };

    if (year) query.year = year;
    if (placementStatus) query.placementStatus = placementStatus;
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { prn: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(query)
      .select('prn rollNo studentName year branch division placementStatus companyName package offerLetterDate')
      .sort({ year: 1, studentName: 1 });

    const yearWiseSummary = students.reduce((acc, student) => {
      const studentYear = student.year || 'Unknown';
      if (!acc[studentYear]) {
        acc[studentYear] = { total: 0, placed: 0, eligible: 0, notEligible: 0, higherStudies: 0 };
      }

      acc[studentYear].total += 1;
      if (student.placementStatus === 'Placed') acc[studentYear].placed += 1;
      if (student.placementStatus === 'Eligible') acc[studentYear].eligible += 1;
      if (student.placementStatus === 'Not Eligible') acc[studentYear].notEligible += 1;
      if (student.placementStatus === 'Higher Studies') acc[studentYear].higherStudies += 1;

      return acc;
    }, {});

    res.json({
      students,
      total: students.length,
      yearWiseSummary
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update student placement details (admin)
router.put('/placements/:prn', async (req, res) => {
  try {
    if (!ensureAdmin(req, res)) return;

    const { placementStatus, companyName, package: offeredPackage, offerLetterDate } = req.body;

    if (!placementStatus) {
      return res.status(400).json({ message: 'placementStatus is required' });
    }

    const student = await Student.findOne({ prn: req.params.prn, isActive: true });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const normalizedStatus = String(placementStatus).trim();
    const normalizedCompany = String(companyName || '').trim();
    const parsedPackage = offeredPackage === '' || offeredPackage === null || offeredPackage === undefined
      ? null
      : Number(offeredPackage);

    if (normalizedStatus === 'Placed') {
      if (!normalizedCompany) {
        return res.status(400).json({ message: 'companyName is required when student is placed' });
      }
      if (!Number.isFinite(parsedPackage) || parsedPackage <= 0) {
        return res.status(400).json({ message: 'Valid package is required when student is placed' });
      }
    }

    student.placementStatus = normalizedStatus;
    student.companyName = normalizedStatus === 'Placed' ? normalizedCompany : (normalizedCompany || '');
    student.package = normalizedStatus === 'Placed' ? parsedPackage : null;
    student.offerLetterDate = offerLetterDate ? new Date(offerLetterDate) : null;
    student.lastUpdated = Date.now();
    student.updatedBy = req.user?.username || 'admin';

    await student.save();

    res.json({
      message: 'Placement details updated successfully',
      student: {
        prn: student.prn,
        studentName: student.studentName,
        year: student.year,
        placementStatus: student.placementStatus,
        companyName: student.companyName,
        package: student.package,
        offerLetterDate: student.offerLetterDate
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET all students with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      year,
      branch,
      division,
      search,
      placementStatus,
      sortBy = 'rollNo',
      order = 'asc'
    } = req.query;

    const query = { isActive: true };

    // Apply filters
    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (division) query.division = division;
    if (placementStatus) query.placementStatus = placementStatus;
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: 'i' } },
        { prn: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    const students = await Student.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Student.countDocuments(query);

    res.json({
      students,
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

// GET student by PRN
router.get('/:prn', async (req, res) => {
  try {
    const student = await Student.findOne({ prn: req.params.prn });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ student });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET student profile with full details (for logged-in student)
router.get('/:prn/profile', async (req, res) => {
  try {
    const student = await Student.findOne({ prn: req.params.prn });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Calculate current semester attendance
    const currentAttendance = student.attendance.length > 0 
      ? student.attendance[student.attendance.length - 1].overallPercentage 
      : 0;

    // Get latest semester marks
    const latestMarks = student.semesterMarks.length > 0
      ? student.semesterMarks[student.semesterMarks.length - 1]
      : null;

    res.json({ 
      student,
      summary: {
        cgpa: student.cgpa,
        currentSemester: student.currentSemester,
        backlogs: student.backlogs,
        attendance: currentAttendance,
        placementStatus: student.placementStatus,
        latestSemesterSGPA: latestMarks?.sgpa || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST create new student
router.post('/', async (req, res) => {
  try {
    const studentData = req.body;

    // Check if student already exists
    const existingStudent = await Student.findOne({ prn: studentData.prn });
    if (existingStudent && existingStudent.isActive !== false) {
      return res.status(400).json({ message: 'Student with this PRN already exists' });
    }

    if (existingStudent && existingStudent.isActive === false) {
      // Reactivate previously soft-deleted student and refresh profile data.
      Object.assign(existingStudent, studentData, {
        isActive: true,
        lastUpdated: Date.now()
      });
      await existingStudent.save();

      const defaultPassword = await bcrypt.hash(studentData.prn, 10);
      const existingUser = await User.findOne({ username: studentData.prn });
      if (existingUser) {
        existingUser.password = defaultPassword;
        existingUser.role = 'student';
        existingUser.referenceId = studentData.prn;
        existingUser.isActive = true;
        await existingUser.save();
      } else {
        await User.create({
          username: studentData.prn,
          password: defaultPassword,
          role: 'student',
          referenceId: studentData.prn,
          isActive: true
        });
      }

      return res.status(201).json({
        message: 'Student reactivated successfully',
        student: existingStudent,
        credentials: {
          username: studentData.prn,
          defaultPassword: studentData.prn,
          note: 'Student should change password on first login'
        }
      });
    }

    // Create student
    const student = new Student(studentData);
    await student.save();

    // Auto-create or reactivate user account with PRN as username
    const defaultPassword = await bcrypt.hash(studentData.prn, 10);
    const existingUser = await User.findOne({ username: studentData.prn });
    if (existingUser) {
      existingUser.password = defaultPassword;
      existingUser.role = 'student';
      existingUser.referenceId = studentData.prn;
      existingUser.isActive = true;
      await existingUser.save();
    } else {
      const user = new User({
        username: studentData.prn,
        password: defaultPassword,
        role: 'student',
        referenceId: studentData.prn
      });
      await user.save();
    }

    res.status(201).json({ 
      message: 'Student created successfully',
      student,
      credentials: {
        username: studentData.prn,
        defaultPassword: studentData.prn,
        note: 'Student should change password on first login'
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT update student
router.put('/:prn', async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { prn: req.params.prn },
      { ...req.body, lastUpdated: Date.now() },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ message: 'Student updated successfully', student });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE student (hard delete with linked user cleanup)
router.delete('/:prn', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ prn: req.params.prn });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Also remove linked user account from user management.
    await User.findOneAndDelete(
      { username: req.params.prn },
    );

    res.json({ message: 'Student and linked user deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ACADEMIC DATA OPERATIONS ====================

// POST add semester marks
router.post('/:prn/marks', async (req, res) => {
  try {
    const { semester, year, academicYear, subjects } = req.body;
    
    const student = await Student.findOne({ prn: req.params.prn });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Calculate SGPA
    let totalCredits = 0;
    let totalGradePoints = 0;
    
    const gradePoints = {
      'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6,
      'C': 5, 'P': 4, 'F': 0
    };

    subjects.forEach(subject => {
      totalCredits += subject.credits || 0;
      totalGradePoints += (gradePoints[subject.grade] || 0) * (subject.credits || 0);
    });

    const sgpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;

    // Add semester marks
    const semesterData = {
      year: year || student.year || 'First',
      semester,
      academicYear: academicYear || '',
      subjects,
      sgpa: parseFloat(sgpa),
      totalCredits,
      status: subjects.every(s => s.grade !== 'F') ? 'Pass' : 'Fail'
    };

    student.semesterMarks.push(semesterData);

    // Recalculate CGPA
    const totalSGPA = student.semesterMarks.reduce((sum, sem) => sum + sem.sgpa, 0);
    student.cgpa = (totalSGPA / student.semesterMarks.length).toFixed(2);

    // Count backlogs
    student.backlogs = student.semesterMarks.reduce((count, sem) => {
      return count + sem.subjects.filter(s => s.grade === 'F').length;
    }, 0);

    await student.save();

    res.json({ 
      message: 'Semester marks added successfully',
      cgpa: student.cgpa,
      sgpa: semesterData.sgpa,
      backlogs: student.backlogs
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST add/update attendance
router.post('/:prn/attendance', async (req, res) => {
  try {
    const { month, year, subjects } = req.body;
    
    const student = await Student.findOne({ prn: req.params.prn });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Calculate overall percentage
    let totalClasses = 0;
    let totalAttended = 0;

    subjects.forEach(subject => {
      subject.percentage = ((subject.attendedClasses / subject.totalClasses) * 100).toFixed(2);
      totalClasses += subject.totalClasses;
      totalAttended += subject.attendedClasses;
    });

    const overallPercentage = ((totalAttended / totalClasses) * 100).toFixed(2);

    // Add or update attendance record
    const existingIndex = student.attendance.findIndex(
      a => a.month === month && a.year === year
    );

    const attendanceData = {
      month,
      year,
      subjects,
      overallPercentage: parseFloat(overallPercentage)
    };

    if (existingIndex >= 0) {
      student.attendance[existingIndex] = attendanceData;
    } else {
      student.attendance.push(attendanceData);
    }

    // Update overall attendance
    const totalAttendancePercentage = student.attendance.reduce(
      (sum, record) => sum + record.overallPercentage, 0
    );
    student.overallAttendance = (totalAttendancePercentage / student.attendance.length).toFixed(2);

    await student.save();

    await ensureAttendanceInterventionItem({
      student,
      month,
      year,
      actor: req.user?.username || req.user?.referenceId || 'system'
    });

    res.json({ 
      message: 'Attendance updated successfully',
      overallAttendance: student.overallAttendance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== STATISTICS & ANALYTICS ====================

// GET student statistics by year/branch/division
router.get('/stats/summary', async (req, res) => {
  try {
    const { year, branch, division } = req.query;
    const query = { isActive: true };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (division) query.division = division;

    const students = await Student.find(query);

    const stats = {
      total: students.length,
      avgCGPA: students.reduce((sum, s) => sum + (s.cgpa || 0), 0) / students.length || 0,
      avgAttendance: students.reduce((sum, s) => sum + (s.overallAttendance || 0), 0) / students.length || 0,
      placementStats: {
        placed: students.filter(s => s.placementStatus === 'Placed').length,
        eligible: students.filter(s => s.placementStatus === 'Eligible').length,
        notEligible: students.filter(s => s.placementStatus === 'Not Eligible').length,
        higherStudies: students.filter(s => s.placementStatus === 'Higher Studies').length
      },
      withBacklogs: students.filter(s => s.backlogs > 0).length,
      cgpaDistribution: {
        above9: students.filter(s => s.cgpa >= 9).length,
        above8: students.filter(s => s.cgpa >= 8 && s.cgpa < 9).length,
        above7: students.filter(s => s.cgpa >= 7 && s.cgpa < 8).length,
        above6: students.filter(s => s.cgpa >= 6 && s.cgpa < 7).length,
        below6: students.filter(s => s.cgpa < 6).length
      }
    };

    stats.avgCGPA = parseFloat(stats.avgCGPA.toFixed(2));
    stats.avgAttendance = parseFloat(stats.avgAttendance.toFixed(2));

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
