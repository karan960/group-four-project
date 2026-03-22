const mongoose = require('mongoose');

const IT_DEPARTMENT = 'Information Technology';
const ALLOWED_YEARS = ['First', 'Second', 'Third', 'Fourth'];
const ALLOWED_DIVISIONS = ['A', 'B'];

const normalizeYear = (yearValue) => {
  const map = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth' };
  const value = String(yearValue || '').trim();
  if (map[value]) return map[value];
  const cap = value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : 'First';
  return ALLOWED_YEARS.includes(cap) ? cap : 'First';
};

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  attachmentUrl: { type: String },
  year: { type: String, required: true, enum: ALLOWED_YEARS, default: 'First' },
  branch: { type: String, required: true, enum: [IT_DEPARTMENT], default: IT_DEPARTMENT },
  division: { type: String, required: true, enum: ALLOWED_DIVISIONS, default: 'A' },
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

courseSchema.pre('validate', function normalizeCourseScope(next) {
  this.year = normalizeYear(this.year);
  this.branch = IT_DEPARTMENT;
  const normalizedDivision = String(this.division || 'A').trim().toUpperCase();
  this.division = ALLOWED_DIVISIONS.includes(normalizedDivision) ? normalizedDivision : 'A';
  next();
});

module.exports = mongoose.model('Course', courseSchema);
