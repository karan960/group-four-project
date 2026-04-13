const mongoose = require('mongoose');

const changeRequestSchema = new mongoose.Schema({
  requestId: { type: Number, required: true, unique: true, index: true },
  requesterRole: { type: String, enum: ['student', 'faculty'], required: true },
  studentPRN: { type: String, required: true, index: true },
  facultyId: { type: String },
  requestedBy: { type: String },
  changeType: { type: String, enum: ['profile', 'password'], required: true },
  currentData: { type: mongoose.Schema.Types.Mixed },
  requestedData: { type: mongoose.Schema.Types.Mixed },
  newPasswordHash: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  requestedAt: { type: Date, default: Date.now },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  rejectedBy: { type: String, default: null },
  rejectedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null }
}, {
  timestamps: true
});

changeRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);