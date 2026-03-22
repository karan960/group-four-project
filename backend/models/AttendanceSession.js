const mongoose = require('mongoose');

const IT_DEPARTMENT = 'Information Technology';
const ALLOWED_YEARS = ['First', 'Second', 'Third', 'Fourth', 'ALL'];
const ALLOWED_DIVISIONS = ['A', 'B', 'ALL'];

const normalizeYear = (yearValue) => {
  const raw = String(yearValue || '').trim();
  const map = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth' };
  if (raw.toUpperCase() === 'ALL') return 'ALL';
  if (map[raw]) return map[raw];
  const cap = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'ALL';
  return ALLOWED_YEARS.includes(cap) ? cap : 'ALL';
};

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
    year: { type: String, enum: ALLOWED_YEARS, default: 'ALL' },
    branch: { type: String, enum: [IT_DEPARTMENT, 'ALL'], default: IT_DEPARTMENT },
    division: { type: String, enum: ALLOWED_DIVISIONS, default: 'ALL' }
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

attendanceSessionSchema.pre('validate', function normalizeClassScope(next) {
  const scope = this.classScope || {};
  scope.year = normalizeYear(scope.year);
  scope.branch = String(scope.branch || '').toUpperCase() === 'ALL' ? 'ALL' : IT_DEPARTMENT;
  const normalizedDivision = String(scope.division || 'ALL').trim().toUpperCase();
  scope.division = ALLOWED_DIVISIONS.includes(normalizedDivision) ? normalizedDivision : 'ALL';
  this.classScope = scope;
  next();
});

module.exports = mongoose.model('AttendanceSession', attendanceSessionSchema);
