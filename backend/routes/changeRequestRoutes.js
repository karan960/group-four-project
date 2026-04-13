const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const ChangeRequest = require('../models/ChangeRequest');
const { createWorkItem, closeWorkItemsByEntityRef } = require('../utils/erpWorkflowService');

const enrichRequest = async (request) => {
  const plainRequest = request?.toObject ? request.toObject() : { ...request };

  if (request.requesterRole === 'faculty' || request.facultyId) {
    const faculty = await Faculty.findOne({ facultyId: plainRequest.facultyId || plainRequest.studentPRN });
    return {
      ...plainRequest,
      studentName: faculty?.facultyName,
      year: faculty?.department,
      branch: faculty?.designation
    };
  }

  const student = await Student.findOne({ prn: plainRequest.studentPRN });
  return {
    ...plainRequest,
    studentName: student?.studentName,
    year: student?.year,
    branch: student?.branch
  };
};

const buildPublicRequest = async (request) => {
  const enriched = await enrichRequest(request);
  return {
    id: enriched.requestId,
    ...enriched
  };
};

const getNextRequestId = async () => {
  const latest = await ChangeRequest.findOne().sort({ requestId: -1 }).select('requestId').lean();
  return (latest?.requestId || 0) + 1;
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

      const requestId = await getNextRequestId();
      const changeRequest = await ChangeRequest.create({
        requestId,
        requesterRole: 'faculty',
        facultyId,
        studentPRN: facultyId,
        requestedBy,
        changeType: 'profile',
        currentData,
        requestedData,
      });

      await createWorkItem({
        module: 'change-request',
        type: 'profile-change',
        title: `Profile change request from faculty ${facultyId}`,
        description: 'Faculty profile update request awaiting admin approval.',
        priority: 'medium',
        ownerRole: 'admin',
        sourceRole: 'faculty',
        sourceRef: facultyId,
        facultyId,
        entityRef: String(changeRequest.requestId),
        metadata: { requesterRole: 'faculty' },
        actor: requestedBy || facultyId
      });

      return res.status(201).json({
        message: 'Profile change request submitted successfully',
        requestId: changeRequest.requestId
      });
    }

    const student = await Student.findOne({ prn: studentPRN });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const requestId = await getNextRequestId();
    const changeRequest = await ChangeRequest.create({
      requestId,
      requesterRole: 'student',
      studentPRN,
      requestedBy,
      changeType: 'profile',
      currentData,
      requestedData,
    });

    await createWorkItem({
      module: 'change-request',
      type: 'profile-change',
      title: `Profile change request from student ${studentPRN}`,
      description: 'Student profile update request awaiting admin approval.',
      priority: 'medium',
      ownerRole: 'admin',
      sourceRole: 'student',
      sourceRef: studentPRN,
      studentPRN,
      entityRef: String(changeRequest.requestId),
      metadata: { requesterRole: 'student' },
      actor: requestedBy || studentPRN
    });

    res.status(201).json({
      message: 'Profile change request submitted successfully',
      requestId: changeRequest.requestId
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

    const requestId = await getNextRequestId();
    const changeRequest = await ChangeRequest.create({
      requestId,
      requesterRole: role,
      studentPRN: requesterId,
      facultyId: role === 'faculty' ? requesterId : undefined,
      requestedBy,
      changeType: 'password',
      newPasswordHash: hashedNewPassword,
    });

    await createWorkItem({
      module: 'change-request',
      type: 'password-change',
      title: `Password change request from ${role} ${requesterId}`,
      description: 'Password change request awaiting admin approval.',
      priority: 'high',
      ownerRole: 'admin',
      sourceRole: role,
      sourceRef: requesterId,
      studentPRN: role === 'student' ? requesterId : '',
      facultyId: role === 'faculty' ? requesterId : '',
      entityRef: String(changeRequest.requestId),
      metadata: { requesterRole: role },
      actor: requestedBy || requesterId
    });

    res.status(201).json({
      message: 'Password change request submitted successfully',
      requestId: changeRequest.requestId
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN APPROVAL ENDPOINTS ====================

// GET all pending change requests (for admin)
router.get('/pending', async (req, res) => {
  try {
    const pendingRequests = await ChangeRequest.find({ status: 'pending' }).sort({ requestedAt: -1 });
    const enrichedRequests = await Promise.all(pendingRequests.map(buildPublicRequest));

    res.json({ requests: enrichedRequests, total: enrichedRequests.length });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET all change requests (for admin)
router.get('/all', async (req, res) => {
  try {
    const requests = await ChangeRequest.find().sort({ requestedAt: -1 });
    const enrichedRequests = await Promise.all(requests.map(buildPublicRequest));
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

    const request = await ChangeRequest.findOne({ requestId: Number(requestId) });
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
    await request.save();

    await closeWorkItemsByEntityRef({
      module: 'change-request',
      entityRef: String(request.requestId),
      actor: approvedBy || 'admin',
      note: 'Approved by admin'
    });

    res.json({
      message: 'Change request approved and applied successfully',
      request: await buildPublicRequest(request)
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

    const request = await ChangeRequest.findOne({ requestId: Number(requestId) });
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
    await request.save();

    await closeWorkItemsByEntityRef({
      module: 'change-request',
      entityRef: String(request.requestId),
      actor: rejectedBy || 'admin',
      note: reason || 'Rejected by admin'
    });

    res.json({
      message: 'Change request rejected',
      request: await buildPublicRequest(request)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
