const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  totalMarks: { type: Number },
  attachmentUrl: { type: String },
  targetYear: { type: String },
  targetBranch: { type: String },
  targetDivision: { type: String },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: String,
    facultyId: String,
    name: String
  },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

assignmentSchema.index({ courseId: 1 });
assignmentSchema.index({ 'createdBy.userId': 1 });
assignmentSchema.index({ targetYear: 1, targetBranch: 1, targetDivision: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
