const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  attachmentUrl: { type: String },
  year: { type: String, required: true },
  branch: { type: String, required: true },
  division: { type: String, required: true },
  semester: { type: Number },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    username: String,
    facultyId: String,
    name: String
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

courseSchema.index({ code: 1 });
courseSchema.index({ year: 1, branch: 1, division: 1 });
courseSchema.index({ 'createdBy.userId': 1 });

module.exports = mongoose.model('Course', courseSchema);
