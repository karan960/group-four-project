const mongoose = require('mongoose');

const IT_DEPARTMENT = 'Information Technology';
const ALLOWED_YEARS = ['First', 'Second', 'Third', 'Fourth'];
const ALLOWED_DIVISIONS = ['A', 'B'];

const normalizeYear = (yearValue) => {
  const map = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth' };
  const value = String(yearValue || '').trim();
  if (map[value]) return map[value];
  const cap = value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '';
  return ALLOWED_YEARS.includes(cap) ? cap : '';
};

const assignmentSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  dueDate: { type: Date, required: true },
  totalMarks: { type: Number },
  attachmentUrl: { type: String },
  targetYear: { type: String, enum: [...ALLOWED_YEARS, 'ALL', ''] },
  targetBranch: { type: String, enum: [IT_DEPARTMENT, 'ALL', ''], default: IT_DEPARTMENT },
  targetDivision: { type: String, enum: [...ALLOWED_DIVISIONS, 'ALL', ''], default: 'A' },
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

assignmentSchema.pre('validate', function normalizeAssignmentScope(next) {
  const normalizedYear = normalizeYear(this.targetYear);
  this.targetYear = String(this.targetYear || '').toUpperCase() === 'ALL' ? 'ALL' : normalizedYear;

  this.targetBranch = String(this.targetBranch || '').toUpperCase() === 'ALL'
    ? 'ALL'
    : IT_DEPARTMENT;

  const normalizedDivision = String(this.targetDivision || '').trim().toUpperCase();
  if (normalizedDivision === 'ALL') {
    this.targetDivision = 'ALL';
  } else {
    this.targetDivision = ALLOWED_DIVISIONS.includes(normalizedDivision) ? normalizedDivision : 'A';
  }
  next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);
