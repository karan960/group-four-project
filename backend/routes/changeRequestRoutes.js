const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

// In-memory storage for change requests (you can create a model for this)
let changeRequests = [];
let requestIdCounter = 1;

const enrichRequest = async (request) => {
  if (request.requesterRole === 'faculty' || request.facultyId) {
    const faculty = await Faculty.findOne({ facultyId: request.facultyId || request.studentPRN });
    return {
      ...request,
      studentName: faculty?.facultyName,
      year: faculty?.department,
      branch: faculty?.designation
    };
  }

  const student = await Student.findOne({ prn: request.studentPRN });
  return {
    ...request,
    studentName: student?.studentName,
    year: student?.year,
    branch: student?.branch
  };
};

// ==================== CHANGE REQUESTS (STUDENT + FACULTY) ====================

// POST submit profile change request
router.post('/profile', async (req, res) => {
  try {
    const { studentPRN, facultyId, requestedBy, requesterRole, currentData, requestedData } = req.body;
    const role = requesterRole || (facultyId ? 'faculty' : 'student');

    if (role === 'faculty') {
      const faculty = await Faculty.findOne({ facultyId });
      if (!faculty) {
        return res.status(404).json({ message: 'Faculty not found' });
      }

      const changeRequest = {
        id: requestIdCounter++,
        requesterRole: 'faculty',
        facultyId,
        studentPRN: facultyId,
        requestedBy,
        changeType: 'profile',
        currentData,
        requestedData,
        status: 'pending',
        requestedAt: new Date(),
        approvedBy: null,
        approvedAt: null
      };

      changeRequests.push(changeRequest);

      return res.status(201).json({
        message: 'Profile change request submitted successfully',
        requestId: changeRequest.id
      });
    }

    const student = await Student.findOne({ prn: studentPRN });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const changeRequest = {
      id: requestIdCounter++,
      requesterRole: 'student',
      studentPRN,
      requestedBy,
      changeType: 'profile',
      currentData,
      requestedData,
      status: 'pending',
      requestedAt: new Date(),
      approvedBy: null,
      approvedAt: null
    };

    changeRequests.push(changeRequest);

    res.status(201).json({
      message: 'Profile change request submitted successfully',
      requestId: changeRequest.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST submit password change request
router.post('/password', async (req, res) => {
  try {
    const { studentPRN, facultyId, requestedBy, requesterRole, currentPassword, newPassword } = req.body;
    const role = requesterRole || (facultyId ? 'faculty' : 'student');

    let requesterId = studentPRN;

    if (role === 'faculty') {
      const faculty = await Faculty.findOne({ facultyId });
      if (!faculty) {
        return res.status(404).json({ message: 'Faculty not found' });
      }
      requesterId = facultyId;
    } else {
      const student = await Student.findOne({ prn: studentPRN });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
    }

    const user = await User.findOne({
      role,
      $or: [{ username: requesterId }, { referenceId: requesterId }]
    });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    const changeRequest = {
      id: requestIdCounter++,
      requesterRole: role,
      studentPRN: requesterId,
      facultyId: role === 'faculty' ? requesterId : undefined,
      requestedBy,
      changeType: 'password',
      newPasswordHash: hashedNewPassword,
      status: 'pending',
      requestedAt: new Date(),
      approvedBy: null,
      approvedAt: null
    };

    changeRequests.push(changeRequest);

    res.status(201).json({
      message: 'Password change request submitted successfully',
      requestId: changeRequest.id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN APPROVAL ENDPOINTS ====================

// GET all pending change requests (for admin)
router.get('/pending', async (req, res) => {
  try {
    const pendingRequests = changeRequests.filter((request) => request.status === 'pending');
    const enrichedRequests = await Promise.all(pendingRequests.map(enrichRequest));

    res.json({ requests: enrichedRequests, total: enrichedRequests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET all change requests (for admin)
router.get('/all', async (req, res) => {
  try {
    const enrichedRequests = await Promise.all(changeRequests.map(enrichRequest));
    res.json({ requests: enrichedRequests, total: enrichedRequests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT approve change request
router.put('/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { approvedBy } = req.body;

    const request = changeRequests.find((item) => item.id === parseInt(requestId));
    if (!request) {
      return res.status(404).json({ message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    if (request.changeType === 'profile') {
      if (request.requesterRole === 'faculty' || request.facultyId) {
        await Faculty.findOneAndUpdate(
          { facultyId: request.facultyId || request.studentPRN },
          request.requestedData
        );
      } else {
        await Student.findOneAndUpdate(
          { prn: request.studentPRN },
          request.requestedData
        );
      }
    } else if (request.changeType === 'password') {
      await User.findOneAndUpdate(
        {
          role: request.requesterRole || 'student',
          $or: [{ username: request.studentPRN }, { referenceId: request.studentPRN }]
        },
        { password: request.newPasswordHash }
      );
    }

    request.status = 'approved';
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();

    res.json({
      message: 'Change request approved and applied successfully',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT reject change request
router.put('/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectedBy, reason } = req.body;

    const request = changeRequests.find((item) => item.id === parseInt(requestId));
    if (!request) {
      return res.status(404).json({ message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    request.status = 'rejected';
    request.rejectedBy = rejectedBy;
    request.rejectedAt = new Date();
    request.rejectionReason = reason;

    res.json({
      message: 'Change request rejected',
      request
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
