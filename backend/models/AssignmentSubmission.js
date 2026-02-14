const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
  student: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    prn: String,
    name: String
  },
  submissionText: { type: String, trim: true },
  fileUrl: { type: String },
  submittedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted' },
  grade: { type: String },
  feedback: { type: String }
}, { timestamps: true });

assignmentSubmissionSchema.index({ assignmentId: 1, 'student.userId': 1 }, { unique: true });
assignmentSubmissionSchema.index({ 'student.userId': 1 });

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
