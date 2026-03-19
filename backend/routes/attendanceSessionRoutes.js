const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

const AttendanceSession = require('../models/AttendanceSession');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');

const isFacultyOrAdmin = (role) => ['faculty', 'admin'].includes(String(role || '').toLowerCase());

const generateSessionCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const normalizeToken = (value) => String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');

const normalizeYearToken = (value) => {
  const token = normalizeToken(value);
  if (!token) return '';

  const yearMap = {
    '1': 'FIRST',
    'FIRST': 'FIRST',
    '2': 'SECOND',
    'SECOND': 'SECOND',
    '3': 'THIRD',
    'THIRD': 'THIRD',
    '4': 'FOURTH',
    'FOURTH': 'FOURTH',
    'ALL': 'ALL'
  };

  return yearMap[token] || token;
};

const BRANCH_ALIAS_GROUPS = [
  ['IT', 'INFORMATION TECHNOLOGY'],
  ['CS', 'CSE', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE AND ENGINEERING'],
  ['ENTC', 'E&TC', 'ELECTRONICS AND TELECOMMUNICATION', 'ELECTRONICS & TELECOMMUNICATION'],
  ['MECH', 'MECHANICAL', 'MECHANICAL ENGINEERING'],
  ['CIVIL', 'CIVIL ENGINEERING'],
  ['ELECTRICAL', 'ELECTRICAL ENGINEERING'],
  ['AIDS', 'AI DS', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE']
];

const expandBranchAliases = (value) => {
  const normalized = normalizeToken(value);
  if (!normalized) return [];

  const aliasGroup = BRANCH_ALIAS_GROUPS.find((group) => group.includes(normalized));
  return aliasGroup ? aliasGroup : [normalized];
};

const buildQrPayload = async (sessionCode) => {
  const payload = JSON.stringify({ type: 'attendance-session', sessionCode });

  try {
    const imageUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 260
    });

    return {
      raw: payload,
      imageUrl
    };
  } catch (error) {
    const encoded = encodeURIComponent(payload);

    // Fallback keeps feature functional even if data URL generation fails.
    return {
      raw: payload,
      imageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encoded}`
    };
  }

};

const sessionVisibilityForStudent = (session, student) => {
  if (!student) return false;
  if (session.status !== 'active') return false;
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) return false;

  const sessionYear = normalizeYearToken(session.classScope?.year);
  const studentYear = normalizeYearToken(student.year);
  const yearOk = !sessionYear || sessionYear === 'ALL' || sessionYear === studentYear;

  const sessionBranch = normalizeToken(session.classScope?.branch);
  const studentBranchValues = [student.branch, student.department]
    .flatMap((branchValue) => expandBranchAliases(branchValue));
  const studentBranches = new Set(studentBranchValues);
  const branchOk = !sessionBranch || sessionBranch === 'ALL' || studentBranches.has(sessionBranch);

  const sessionDivision = normalizeToken(session.classScope?.division);
  const studentDivision = normalizeToken(student.division);
  const divisionOk = !sessionDivision || sessionDivision === 'ALL' || sessionDivision === studentDivision;

  return yearOk && branchOk && divisionOk;
};

const applyPresenceToStudentAttendance = async (studentPRN, session) => {
  const student = await Student.findOne({ prn: studentPRN, isActive: true });
  if (!student) return;

  // Issue #7: Add validation for month, year, type with timezone handling
  const validMonths = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December', 'Overall'];

  const month = (session.attendanceMeta?.month && validMonths.includes(session.attendanceMeta.month))
    ? session.attendanceMeta.month 
    : 'Overall';

  let year = Number(session.attendanceMeta?.year) || new Date().getFullYear();

  // Validate year is reasonable (within last 10 and next 2 years)
  const currentYear = new Date().getFullYear();
  if (year < currentYear - 10 || year > currentYear + 2) {
    console.warn(`Attendance year ${year} is out of reasonable range. Using current year ${currentYear}`);
    year = currentYear;
  }

  const validTypes = ['theory', 'practical'];
  const type = (session.attendanceMeta?.type && validTypes.includes(session.attendanceMeta.type))
    ? session.attendanceMeta.type 
    : 'theory';

  const subjectName = session.subjectName;

  student.attendance = Array.isArray(student.attendance) ? student.attendance : [];

  let monthEntry = student.attendance.find((entry) => entry.month === month && Number(entry.year) === year);
  if (!monthEntry) {
    monthEntry = {
      month,
      year,
      subjects: [],
      overall: 0,
      overallPercentage: 0
    };
    student.attendance.push(monthEntry);
  }

  monthEntry.subjects = Array.isArray(monthEntry.subjects) ? monthEntry.subjects : [];
  let subject = monthEntry.subjects.find(
    (s) => String(s.subjectName || '').toLowerCase() === String(subjectName || '').toLowerCase() && String(s.type || 'theory') === String(type)
  );

  if (!subject) {
    subject = {
      subjectName,
      type,
      totalClasses: 0,
      attendedClasses: 0,
      percentage: 0
    };
    monthEntry.subjects.push(subject);
  }

  subject.totalClasses = Number(subject.totalClasses || 0) + 1;
  subject.attendedClasses = Number(subject.attendedClasses || 0) + 1;
  subject.percentage = subject.totalClasses > 0
    ? Number(((subject.attendedClasses / subject.totalClasses) * 100).toFixed(2))
    : 0;

  const totalClasses = monthEntry.subjects.reduce((sum, s) => sum + Number(s.totalClasses || 0), 0);
  const attendedClasses = monthEntry.subjects.reduce((sum, s) => sum + Number(s.attendedClasses || 0), 0);
  monthEntry.overall = attendedClasses;
  monthEntry.overallPercentage = totalClasses > 0
    ? Number(((attendedClasses / totalClasses) * 100).toFixed(2))
    : 0;

  const attendanceEntries = student.attendance.filter((entry) => Number(entry.overallPercentage || 0) >= 0);
  const overallAvg = attendanceEntries.length
    ? attendanceEntries.reduce((sum, entry) => sum + Number(entry.overallPercentage || 0), 0) / attendanceEntries.length
    : 0;

  student.overallAttendance = Number(overallAvg.toFixed(2));
  student.lastUpdated = new Date();
  await student.save();
};

// Faculty/Admin: create attendance QR session.
router.post('/create', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can create attendance sessions' });
    }

    const {
      subjectName,
      year,
      branch,
      division,
      month = 'Overall',
      attendanceYear,
      type = 'theory',
      expiresInMinutes = 15
    } = req.body || {};

    if (!subjectName || !String(subjectName).trim()) {
      return res.status(400).json({ message: 'subjectName is required' });
    }

    const expiresAt = new Date(Date.now() + Math.max(1, Number(expiresInMinutes || 15)) * 60 * 1000);

    let sessionCode = generateSessionCode();
    let exists = await AttendanceSession.findOne({ sessionCode });
    while (exists) {
      sessionCode = generateSessionCode();
      exists = await AttendanceSession.findOne({ sessionCode });
    }

    let facultyName = req.user.username;
    let facultyFound = false;

    if (req.user.role === 'faculty' && req.user.referenceId) {
      const faculty = await Faculty.findOne({ facultyId: req.user.referenceId });
      if (faculty && faculty.facultyName) {
        facultyName = faculty.facultyName;
        facultyFound = true;
      } else if (req.user.role === 'faculty') {
        // Issue #6: Log if faculty profile missing
        console.warn(`Faculty profile not found for ID: ${req.user.referenceId}, using username: ${req.user.username}`);
      }
    }

    const session = await AttendanceSession.create({
      sessionCode,
      subjectName: String(subjectName).trim(),
      classScope: {
        year: year || 'ALL',
        branch: branch || 'ALL',
        division: division || 'ALL'
      },
      attendanceMeta: {
        month: month || 'Overall',
        // Issue #7: Use explicit year validation
        year: Number(attendanceYear) || new Date().getFullYear(),
        type: type === 'practical' ? 'practical' : 'theory'
      },
      createdBy: {
        userId: req.user.userId,
        username: req.user.username,
        facultyId: req.user.referenceId,
        facultyName,
        facultyFound  // Issue #6: Add flag to indicate if actual faculty name was found
      },
      createdAt: new Date(),  // Issue #7: Add explicit creation timestamp
      expiresAt,
      requests: []
    });

    const qr = await buildQrPayload(session.sessionCode);

    res.status(201).json({
      message: 'Attendance session created',
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        subjectName: session.subjectName,
        classScope: session.classScope,
        attendanceMeta: session.attendanceMeta,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        pendingCount: 0,
        approvedCount: 0
      },
      qr
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create attendance session', error: error.message });
  }
});

// Faculty/Admin: get latest active session and pending list (poll for near realtime).
router.get('/active', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can view active attendance sessions' });
    }

    const query = req.user.role === 'faculty'
      ? { status: 'active', 'createdBy.userId': req.user.userId }
      : { status: 'active' };

    const session = await AttendanceSession.findOne(query).sort({ createdAt: -1 });

    if (!session) {
      return res.json({ session: null, requests: [] });
    }

    if (session.expiresAt && new Date(session.expiresAt) < new Date() && session.status === 'active') {
      session.status = 'expired';
      await session.save();
      return res.json({ session: null, requests: [] });
    }

    const pending = (session.requests || [])
      .filter((r) => r.status === 'pending')
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));

    const approvedCount = (session.requests || []).filter((r) => r.status === 'approved').length;

    const qr = await buildQrPayload(session.sessionCode);

    res.json({
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        subjectName: session.subjectName,
        classScope: session.classScope,
        attendanceMeta: session.attendanceMeta,
        status: session.status,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        pendingCount: pending.length,
        approvedCount
      },
      qr,
      requests: pending
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch active session', error: error.message });
  }
});

// Faculty/Admin: session history for table view on dashboard.
router.get('/history', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can view attendance history' });
    }

    const limit = Math.min(Math.max(Number(req.query?.limit || 20), 1), 100);
    const query = String(req.user.role).toLowerCase() === 'faculty'
      ? { 'createdBy.userId': req.user.userId }
      : {};

    const sessions = await AttendanceSession.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const sessionRows = sessions.map((session) => {
      const requests = Array.isArray(session.requests) ? session.requests : [];
      const approvedCount = requests.filter((r) => r.status === 'approved').length;
      const pendingCount = requests.filter((r) => r.status === 'pending').length;
      const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

      return {
        _id: session._id,
        sessionCode: session.sessionCode,
        subjectName: session.subjectName,
        classScope: session.classScope,
        attendanceMeta: session.attendanceMeta,
        status: session.status,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        closedAt: session.closedAt,
        approvedCount,
        pendingCount,
        rejectedCount,
        totalRequests: requests.length
      };
    });

    res.json({ sessions: sessionRows });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance history', error: error.message });
  }
});

// Faculty/Admin: approved student details for a session.
router.get('/:sessionId/approved-students', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can view approved student details' });
    }

    const session = await AttendanceSession.findById(req.params.sessionId).lean();
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(req.user.role).toLowerCase() === 'faculty' && String(session.createdBy?.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only view your own session details' });
    }

    const approvedStudents = (Array.isArray(session.requests) ? session.requests : [])
      .filter((request) => request.status === 'approved')
      .map((request) => ({
        requestId: request._id,
        studentPRN: request.studentPRN,
        studentName: request.studentName,
        requestedAt: request.requestedAt,
        approvedAt: request.decidedAt,
        approvedBy: request.decidedBy,
        note: request.note || ''
      }));

    res.json({
      session: {
        _id: session._id,
        sessionCode: session.sessionCode,
        subjectName: session.subjectName,
        status: session.status,
        createdAt: session.createdAt,
        classScope: session.classScope
      },
      approvedStudents
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch approved student details', error: error.message });
  }
});

// Student: send presence request after scanning QR/session code.
router.post('/:sessionCode/request', async (req, res) => {
  try {
    if (String(req.user?.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ message: 'Only students can send presence requests' });
    }

    const sessionCode = String(req.params.sessionCode || '').toUpperCase();
    const session = await AttendanceSession.findOne({ sessionCode });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: `Session is ${session.status}` });
    }

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({ message: 'Session expired' });
    }

    const student = await Student.findOne({ prn: req.user.referenceId, isActive: true });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    if (!sessionVisibilityForStudent(session, student)) {
      return res.status(403).json({ message: 'This attendance session is not for your class/division' });
    }

    const existing = session.requests.find((r) => String(r.studentPRN) === String(student.prn));

    if (existing) {
      if (existing.status === 'pending') {
        existing.requestedAt = new Date();
        existing.studentName = student.studentName;
      }
      await session.save();
      return res.json({
        message: existing.status === 'approved' ? 'Already approved' : 'Presence request already sent',
        request: existing
      });
    }

    session.requests.push({
      studentUserId: req.user.userId,
      studentPRN: student.prn,
      studentName: student.studentName,
      status: 'pending',
      requestedAt: new Date()
    });

    await session.save();

    const requestRecord = session.requests[session.requests.length - 1];

    res.status(201).json({
      message: 'Presence request sent. Show this screen to faculty for verification.',
      request: requestRecord
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send presence request', error: error.message });
  }
});

// Student: check request status.
router.get('/:sessionCode/status', async (req, res) => {
  try {
    if (String(req.user?.role || '').toLowerCase() !== 'student') {
      return res.status(403).json({ message: 'Only students can check request status' });
    }

    const sessionCode = String(req.params.sessionCode || '').toUpperCase();
    const session = await AttendanceSession.findOne({ sessionCode });

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const request = (session.requests || []).find((r) => String(r.studentPRN) === String(req.user.referenceId));
    if (!request) {
      return res.status(404).json({ message: 'No request found for this student' });
    }

    res.json({
      session: {
        sessionCode: session.sessionCode,
        subjectName: session.subjectName,
        status: session.status,
        expiresAt: session.expiresAt
      },
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch request status', error: error.message });
  }
});

// Faculty/Admin: approve a single request.
router.put('/:sessionId/approve/:requestId', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can approve requests' });
    }

    const session = await AttendanceSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(req.user.role).toLowerCase() === 'faculty' && String(session.createdBy.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only approve requests for your own session' });
    }

    const request = session.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = 'approved';
    request.decidedAt = new Date();
    request.decidedBy = req.user.username;

    await applyPresenceToStudentAttendance(request.studentPRN, session);
    await session.save();

    res.json({ message: 'Request approved and attendance updated', request });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve request', error: error.message });
  }
});

// Faculty/Admin: reject a single request.
router.put('/:sessionId/reject/:requestId', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can reject requests' });
    }

    const session = await AttendanceSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(req.user.role).toLowerCase() === 'faculty' && String(session.createdBy.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only reject requests for your own session' });
    }

    const request = session.requests.id(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request already ${request.status}` });
    }

    request.status = 'rejected';
    request.decidedAt = new Date();
    request.decidedBy = req.user.username;
    request.note = req.body?.note || 'Rejected by faculty';

    await session.save();

    res.json({ message: 'Request rejected', request });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject request', error: error.message });
  }
});

// Faculty/Admin: approve all pending requests.
router.put('/:sessionId/approve-all', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can approve all requests' });
    }

    const session = await AttendanceSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(req.user.role).toLowerCase() === 'faculty' && String(session.createdBy.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only approve requests for your own session' });
    }

    const pending = (session.requests || []).filter((r) => r.status === 'pending');

    for (const request of pending) {
      request.status = 'approved';
      request.decidedAt = new Date();
      request.decidedBy = req.user.username;
      await applyPresenceToStudentAttendance(request.studentPRN, session);
    }

    await session.save();

    res.json({ message: 'All pending requests approved', approvedCount: pending.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve all requests', error: error.message });
  }
});

// Faculty/Admin: close session.
router.put('/:sessionId/close', async (req, res) => {
  try {
    if (!isFacultyOrAdmin(req.user?.role)) {
      return res.status(403).json({ message: 'Only faculty or admin can close sessions' });
    }

    const session = await AttendanceSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (String(req.user.role).toLowerCase() === 'faculty' && String(session.createdBy.userId) !== String(req.user.userId)) {
      return res.status(403).json({ message: 'You can only close your own session' });
    }

    session.status = 'closed';
    session.closedAt = new Date();
    await session.save();

    res.json({ message: 'Session closed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to close session', error: error.message });
  }
});

module.exports = router;
