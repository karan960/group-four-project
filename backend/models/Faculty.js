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

const facultySchema = new mongoose.Schema({
  // Basic Information
  facultyId: { type: String, required: true, unique: true },
  facultyName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNo: { type: String },
  department: { type: String, required: true, default: IT_DEPARTMENT, enum: [IT_DEPARTMENT] },
  designation: { type: String, required: true },
  
  // Additional Details
  qualification: { type: String },
  experience: { type: Number }, // in years
  joiningDate: { type: Date },
  specialization: [String],
  
  // Teaching Assignment
  assignedSubjects: [{
    subjectCode: String,
    subjectName: String,
    year: { type: String, enum: ALLOWED_YEARS, default: 'First' },
    division: { type: String, enum: ALLOWED_DIVISIONS, default: 'A' },
    semester: Number
  }],

  // Manually Added Subjects (by Faculty)
  manuallyAddedSubjects: [{
    subjectCode: String,
    subjectName: String,
    year: { type: String, enum: ALLOWED_YEARS, default: 'First' },
    division: { type: String, enum: ALLOWED_DIVISIONS, default: 'A' },
    semester: Number,
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Contact & Personal
  officeRoom: { type: String },
  address: { type: String },
  emergencyContact: { type: String },
  bloodGroup: { type: String },
  dob: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  
  // Research & Publications
  publications: [{
    title: String,
    journal: String,
    year: Number,
    doi: String
  }],
  researchAreas: [String],
  
  // System Fields
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster queries
facultySchema.index({ facultyId: 1 });
facultySchema.index({ department: 1 });
facultySchema.index({ email: 1 });

facultySchema.pre('validate', function normalizeFacultyDepartment(next) {
  this.department = IT_DEPARTMENT;

  if (Array.isArray(this.assignedSubjects)) {
    this.assignedSubjects = this.assignedSubjects.map((subject) => {
      const normalizedDivision = String(subject?.division || 'A').trim().toUpperCase();
      return {
        ...subject,
        year: normalizeYear(subject?.year),
        division: ALLOWED_DIVISIONS.includes(normalizedDivision) ? normalizedDivision : 'A'
      };
    });
  }

  if (Array.isArray(this.manuallyAddedSubjects)) {
    this.manuallyAddedSubjects = this.manuallyAddedSubjects.map((subject) => {
      const normalizedDivision = String(subject?.division || 'A').trim().toUpperCase();
      return {
        ...subject,
        year: normalizeYear(subject?.year),
        division: ALLOWED_DIVISIONS.includes(normalizedDivision) ? normalizedDivision : 'A'
      };
    });
  }

  next();
});

// Issue #9: Pre-delete hook to mark courses as inactive when faculty is deleted
facultySchema.pre('findByIdAndDelete', async function(next) {
  try {
    const Course = require('./Course');
    // Get the faculty document to access facultyId
    const facultyObjId = this.getFilter()._id;
    
    // Find faculty first to get the facultyId
    const faculty = await this.model.findById(facultyObjId);
    if (faculty && faculty.facultyId) {
      // Mark courses as inactive when faculty is deleted
      const result = await Course.updateMany(
        { 'createdBy.facultyId': faculty.facultyId, isActive: true },
        { 
          $set: { 
            isActive: false,
            'createdBy.name': 'Inactive Faculty',
            lastUpdated: new Date()
          }
        }
      );
      console.log(`Marked ${result.modifiedCount} courses as inactive for deleted faculty ${faculty.facultyId}`);
    }
    next();
  } catch (error) {
    console.error('Error in Faculty pre-delete hook:', error);
    next();
  }
});

module.exports = mongoose.model('Faculty', facultySchema);