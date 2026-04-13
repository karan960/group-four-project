const mongoose = require('mongoose');

const ALLOWED_YEARS = ['First', 'Second', 'Third', 'Fourth'];
const ALLOWED_DIVISIONS = ['A', 'B'];

const cohortAssignmentSchema = new mongoose.Schema(
  {
    year: { type: String, enum: ALLOWED_YEARS, required: true },
    division: { type: String, enum: ALLOWED_DIVISIONS, required: true },
    primaryFacultyId: { type: String, required: true, trim: true },
    supportFacultyIds: [{ type: String, trim: true }],
    coordinatorFacultyId: { type: String, trim: true },
    notes: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    updatedBy: { type: String, default: '' }
  },
  { timestamps: true }
);

cohortAssignmentSchema.index({ year: 1, division: 1 }, { unique: true });
cohortAssignmentSchema.index({ primaryFacultyId: 1, isActive: 1 });

module.exports = mongoose.model('CohortAssignment', cohortAssignmentSchema);
