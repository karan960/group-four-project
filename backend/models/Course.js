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
    // Issue #9: Add Faculty reference with validation
    facultyId: {
      type: String,
      validate: {
        validator: async function(value) {
          if (!value) return true; // Optional facultyId
          try {
            const Faculty = require('./Faculty');
            const faculty = await Faculty.findOne({ facultyId: value });
            return !!faculty;
          } catch (error) {
            console.error('Faculty validation error:', error);
            return true; // Allow on error
          }
        },
        message: 'Faculty with this ID does not exist'
      }
    },
    name: String
  },
  // Issue #9: Add reference for easier lookups
  facultyIdReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Faculty'
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

courseSchema.index({ code: 1 });
courseSchema.index({ year: 1, branch: 1, division: 1 });
courseSchema.index({ 'createdBy.userId': 1 });

module.exports = mongoose.model('Course', courseSchema);
