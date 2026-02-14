const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const User = require('../models/User');

// ==================== SEND NOTIFICATION ====================
// Admin/Faculty can send notifications to students/faculty
router.post('/send', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const username = req.user.username;

    const { title, message, type, priority, targetRole, targetYear, targetBranch, targetDivision, scheduledFor } = req.body;

    // Validate sender role (only admin and faculty can send notifications)
    if (!['admin', 'faculty'].includes(userRole)) {
      return res.status(403).json({ message: 'Only admin and faculty can send notifications' });
    }

    // Validate target role based on sender role
    if (userRole === 'faculty' && targetRole !== 'student') {
      return res.status(400).json({ message: 'Faculty can only send notifications to students' });
    }

    if (!title || !message || !targetRole) {
      return res.status(400).json({ message: 'Title, message, and targetRole are required' });
    }

    // Get sender information
    const sender = await User.findById(userId).select('username role');

    // Build recipient list based on target role
    let recipients = [];

    if (targetRole === 'all') {
      // Send to all students and faculty (based on User records)
      const users = await User.find({ role: { $in: ['student', 'faculty'] } })
        .select('_id role referenceId');
      recipients = users.map(u => ({
        userId: u._id,
        role: u.role,
        recipientId: u.referenceId || null
      }));
    } else if (targetRole === 'student') {
      // Send to specific students or all students (filtered via Student, mapped to User)
      const query = { isActive: true };
      if (targetYear) query.year = targetYear;
      if (targetBranch) query.branch = targetBranch;
      if (targetDivision) query.division = targetDivision;

      const students = await Student.find(query).select('prn');
      const prnList = students.map(s => s.prn).filter(Boolean);
      const users = await User.find({ role: 'student', referenceId: { $in: prnList } })
        .select('_id role referenceId');
      recipients = users.map(u => ({
        userId: u._id,
        role: 'student',
        recipientId: u.referenceId || null
      }));
    } else if (targetRole === 'faculty') {
      // Send to all faculty (admin only)
      if (userRole !== 'admin') {
        return res.status(403).json({ message: 'Only admin can send notifications to faculty' });
      }

      const faculties = await Faculty.find({ isActive: true }).select('facultyId');
      const facultyIds = faculties.map(f => f.facultyId).filter(Boolean);
      const users = await User.find({ role: 'faculty', referenceId: { $in: facultyIds } })
        .select('_id role referenceId');
      recipients = users.map(u => ({
        userId: u._id,
        role: 'faculty',
        recipientId: u.referenceId || null
      }));
    }

    // Create notification
    const notification = new Notification({
      sender: {
        userId,
        username,
        role: userRole,
        name: sender?.username || username
      },
      recipients,
      title,
      message,
      type: type || 'announcement',
      priority: priority || 'normal',
      targetRole,
      targetYear,
      targetBranch,
      targetDivision,
      isPublished: true,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null
    });

    await notification.save();

    res.status(201).json({
      message: 'Notification sent successfully',
      notification,
      recipientCount: recipients.length
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET NOTIFICATIONS FOR USER ====================
router.get('/inbox', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;
    const { limit = 20, page = 1, unreadOnly = false } = req.query;

    // Find notifications where user is a recipient
    const recipientMatch = {
      $or: [
        { 'recipients.userId': userId },
        ...(referenceId ? [{ 'recipients.recipientId': referenceId }] : []),
        { 'recipients.role': userRole, 'recipients.recipientId': null }
      ]
    };

    const query = {
      isPublished: true,
      ...recipientMatch
    };

    let notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-recipients'); // Exclude full recipients list for privacy

    // Add read status for current user
    notifications = notifications.map(notif => {
      const isRead = notif.readBy?.some(r => r.userId?.toString() === userId);
      return {
        ...notif.toObject(),
        isRead
      };
    });

    // Filter unread if requested
    if (unreadOnly === 'true') {
      notifications = notifications.filter(n => !n.isRead);
    }

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET SENT NOTIFICATIONS (ADMIN/FACULTY) ====================
router.get('/sent', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const { limit = 20, page = 1 } = req.query;

    // Only admin and faculty can view sent notifications
    if (!['admin', 'faculty'].includes(userRole)) {
      return res.status(403).json({ message: 'Only admin and faculty can view sent notifications' });
    }

    const query = { 'sender.userId': userId };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);

    res.json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching sent notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== MARK NOTIFICATION AS READ ====================
router.put('/:notificationId/read', async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user.userId;
    const username = req.user.username;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if user is in recipients
    const isRecipient = notification.recipients.some(r => {
      if (r.userId?.toString() === userId) return true;
      if (referenceId && r.recipientId === referenceId) return true;
      if (r.role === userRole && r.recipientId == null) return true;
      return false;
    });
    if (!isRecipient) {
      return res.status(403).json({ message: 'You are not a recipient of this notification' });
    }

    // Check if already read
    const alreadyRead = notification.readBy?.some(r => r.userId?.toString() === userId);

    if (!alreadyRead) {
      notification.readBy = notification.readBy || [];
      notification.readBy.push({
        userId,
        username,
        readAt: new Date()
      });
      await notification.save();
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== DELETE NOTIFICATION ====================
router.delete('/:notificationId', async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Only sender or admin can delete
    if (notification.sender.userId.toString() !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own notifications' });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET UNREAD COUNT ====================
router.get('/unread/count', async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;
    const recipientMatch = {
      $or: [
        { 'recipients.userId': userId },
        ...(referenceId ? [{ 'recipients.recipientId': referenceId }] : []),
        { 'recipients.role': userRole, 'recipients.recipientId': null }
      ]
    };

    const unreadCount = await Notification.countDocuments({
      isPublished: true,
      ...recipientMatch,
      'readBy.userId': { $ne: userId }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== MARK ALL AS READ ====================
router.put('/mark-all/read', async (req, res) => {
  try {
    const userId = req.user.userId;
    const username = req.user.username;
    const userRole = (req.user.role || '').toLowerCase();
    const referenceId = req.user.referenceId || null;

    const recipientMatch = {
      $or: [
        { 'recipients.userId': userId },
        ...(referenceId ? [{ 'recipients.recipientId': referenceId }] : []),
        { 'recipients.role': userRole, 'recipients.recipientId': null }
      ]
    };

    await Notification.updateMany(
      {
        isPublished: true,
        ...recipientMatch,
        'readBy.userId': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId,
            username,
            readAt: new Date()
          }
        }
      }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== GET NOTIFICATION STATISTICS (ADMIN) ====================
router.get('/admin/statistics', async (req, res) => {
  try {
    const userRole = (req.user.role || '').toLowerCase();

    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Only admin can view notification statistics' });
    }

    const totalSent = await Notification.countDocuments({ isPublished: true });
    const totalRead = await Notification.countDocuments({
      isPublished: true,
      'readBy': { $exists: true, $ne: [] }
    });

    const byType = await Notification.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const byPriority = await Notification.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.json({
      totalSent,
      totalRead,
      readPercentage: totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(2) : 0,
      byType,
      byPriority
    });
  } catch (error) {
    console.error('Error getting notification statistics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
