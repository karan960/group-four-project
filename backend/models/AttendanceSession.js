const mongoose = require('mongoose');

const presenceRequestSchema = new mongoose.Schema({
  studentUserId: { type: mongoose.Schema.Types.ObjectId, required: true },
  studentPRN: { type: String, required: true },
  studentName: { type: String },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date },
  decidedBy: { type: String },
  note: { type: String }
}, { _id: true });

const attendanceSessionSchema = new mongoose.Schema({
  sessionCode: { type: String, required: true, unique: true, uppercase: true },
  status: {
    type: String,
    enum: ['active', 'closed', 'expired'],
    default: 'active'
  },
  subjectName: { type: String, required: true },
  classScope: {
    year: { type: String },
    branch: { type: String },
    division: { type: String }
  },
  attendanceMeta: {
    month: { type: String, default: 'Overall' },
    year: { type: Number, default: () => new Date().getFullYear() },
    type: { type: String, enum: ['theory', 'practical'], default: 'theory' }
  },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: { type: String, required: true },
    facultyId: { type: String },
    facultyName: { type: String }
  },
  requests: { type: [presenceRequestSchema], default: [] },
  expiresAt: { type: Date, required: true },
  closedAt: { type: Date }
}, { timestamps: true });

attendanceSessionSchema.index({ sessionCode: 1 });
attendanceSessionSchema.index({ status: 1, createdAt: -1 });
attendanceSessionSchema.index({ 'createdBy.userId': 1, status: 1 });

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
