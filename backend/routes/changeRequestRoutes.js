const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');

// In-memory storage for change requests (you can create a model for this)
let changeRequests = [];
let requestIdCounter = 1;

// ==================== STUDENT CHANGE REQUESTS ====================

// POST submit profile change request
router.post('/profile', async (req, res) => {
  try {
    const { studentPRN, requestedBy, changeType, currentData, requestedData } = req.body;

    // Validate student exists
    const student = await Student.findOne({ prn: studentPRN });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Create change request
    const changeRequest = {
      id: requestIdCounter++,
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
    const { studentPRN, requestedBy, changeType, currentPassword, newPassword } = req.body;

    // Validate student exists
    const student = await Student.findOne({ prn: studentPRN });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Verify current password
    const user = await User.findOne({ username: studentPRN, role: 'student' });
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password for storage in request
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Create change request
    const changeRequest = {
      id: requestIdCounter++,
      studentPRN,
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
    const pendingRequests = changeRequests.filter(req => req.status === 'pending');
    
    // Enrich with student details
    const enrichedRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const student = await Student.findOne({ prn: request.studentPRN });
        return {
          ...request,
          studentName: student?.studentName,
          year: student?.year,
          branch: student?.branch
        };
      })
    );

    res.json({ requests: enrichedRequests, total: enrichedRequests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET all change requests (for admin)
router.get('/all', async (req, res) => {
  try {
    // Enrich with student details
    const enrichedRequests = await Promise.all(
      changeRequests.map(async (request) => {
        const student = await Student.findOne({ prn: request.studentPRN });
        return {
          ...request,
          studentName: student?.studentName,
          year: student?.year,
          branch: student?.branch
        };
      })
    );

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

    const request = changeRequests.find(r => r.id === parseInt(requestId));
    if (!request) {
      return res.status(404).json({ message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Apply the changes based on type
    if (request.changeType === 'profile') {
      await Student.findOneAndUpdate(
        { prn: request.studentPRN },
        request.requestedData
      );
    } else if (request.changeType === 'password') {
      await User.findOneAndUpdate(
        { username: request.studentPRN, role: 'student' },
        { password: request.newPasswordHash }
      );
    }

    // Update request status
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

    const request = changeRequests.find(r => r.id === parseInt(requestId));
    if (!request) {
      return res.status(404).json({ message: 'Change request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request already processed' });
    }

    // Update request status
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
