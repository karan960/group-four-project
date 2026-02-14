const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  sender: {
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    role: String, // 'admin' or 'faculty'
    name: String
  },
  
  recipients: {
    type: [{
      userId: mongoose.Schema.Types.ObjectId,
      role: String, // 'student', 'faculty', or 'all'
      recipientId: String // PRN for student, Faculty ID for faculty, or null for 'all'
    }],
    default: []
  },
  
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  message: {
    type: String,
    required: true,
    trim: true
  },
  
  type: {
    type: String,
    enum: ['announcement', 'alert', 'update', 'reminder'],
    default: 'announcement'
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  targetRole: {
    type: String,
    enum: ['all', 'student', 'faculty'],
    default: 'all'
  },
  
  targetYear: String, // e.g., 'First', 'Second' - optional filter for students
  targetBranch: String, // optional filter for students
  targetDivision: String, // optional filter for students
  
  readBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    username: String,
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  isPublished: {
    type: Boolean,
    default: false
  },
  
  scheduledFor: Date, // for scheduled notifications
  
  attachments: [{
    fileName: String,
    fileUrl: String
  }],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ 'sender.userId': 1 });
NotificationSchema.index({ isPublished: 1 });

module.exports = mongoose.model('Notification', NotificationSchema);
