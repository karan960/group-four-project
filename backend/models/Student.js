const mongoose = require('mongoose');

// Sub-schema for semester marks
const semesterMarksSchema = new mongoose.Schema({
  year: { 
    type: String, 
    enum: ['First', 'Second', 'Third', 'Fourth'],
    required: true 
  },
  semester: { type: Number, required: true },
  academicYear: { type: String }, // e.g., '2023-2024'
  internalTotal: { type: Number },
  internalPercentage: { type: Number },
  externalTotal: { type: Number },
  externalPercentage: { type: Number },
  cgpa: { type: Number },
  subjects: [{
    subjectCode: String,
    subjectName: String,
    internalMarks: Number,
    externalMarks: Number,
    totalMarks: Number,
    credits: Number,
    grade: String
  }],
  sgpa: Number,
  totalCredits: Number,
  status: { type: String, enum: ['Pass', 'Fail', 'ATKT'], default: 'Pass' }
});

// Sub-schema for attendance
const attendanceSchema = new mongoose.Schema({
  srNo: Number,
  status: String,
  rollNo: String,
  studentName: String,
  department: String,
  month: String,
  year: Number,
  subjects: [{
    subjectName: String,
    type: { type: String, enum: ['theory', 'practical'] },
    totalClasses: Number,
    attendedClasses: Number,
    percentage: Number
  }],
  theorySubjects: [{
    subjectName: String,
    totalLectures: Number,
    attendedLectures: Number,
    percentage: Number
  }],
  practicalSubjects: [{
    subjectName: String,
    totalPracticals: Number,
    attendedPracticals: Number,
    percentage: Number
  }],
  totalTheoryLecturesAttended: Number,
  totalLabPracticalsAttended: Number,
  overall: Number,
  overallPercentage: Number
});

const studentSchema = new mongoose.Schema({
  // Basic Information
  prn: { type: String, required: true, unique: true },
  rollNo: { type: String, required: true },
  studentName: { type: String, required: true },
  year: { 
    type: String, 
    required: true,
    enum: ['First', 'Second', 'Third', 'Fourth'],
    default: 'First'
  },
  srNo: { type: Number },
  status: { type: String },
  seatNo: { type: String },
  department: { type: String },
  branch: { type: String, required: true },
  division: { type: String, required: true },
  email: { type: String, required: true },
  mobileNo: { type: String },
  address: { type: String },
  fatherName: { type: String },
  motherName: { type: String },
  dob: { type: Date },
  bloodGroup: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  
  // Academic Information
  admissionYear: { type: Number },
  currentSemester: { type: Number, default: 1 },
  cgpa: { type: Number, default: 0 },
  semesterMarks: [semesterMarksSchema],
  backlogs: { type: Number, default: 0 },
  totalCreditsEarned: { type: Number, default: 0 },
  
  // Attendance Data
  attendance: [attendanceSchema],
  overallAttendance: { type: Number, default: 0 },
  
  // Placement Information
  placementStatus: { 
    type: String, 
    enum: ['Not Eligible', 'Eligible', 'Placed', 'Higher Studies'],
    default: 'Not Eligible'
  },
  companyName: { type: String },
  package: { type: Number },
  offerLetterDate: { type: Date },
  
  // Skills and Internships
  skills: [String],
  internships: [{
    companyName: String,
    role: String,
    duration: String,
    startDate: Date,
    endDate: Date
  }],
  certifications: [{
    name: String,
    issuedBy: String,
    issueDate: Date
  }],
  
  // Projects
  projects: [{
    title: String,
    description: String,
    technologies: [String],
    duration: String
  }],
  
  // ML Prediction Data
  predictedCGPA: { type: Number },
  placementProbability: { type: Number },
  riskCategory: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },
  recommendations: [String],
  lastPredictionDate: { type: Date },
  
  // System Fields
  isActive: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: String }
}, {
  timestamps: true
});

// Index for faster queries
studentSchema.index({ prn: 1 });
studentSchema.index({ year: 1, branch: 1, division: 1 });
studentSchema.index({ year: 1, department: 1, division: 1 });
studentSchema.index({ placementStatus: 1 });

// Keep branch and department in sync so legacy and new payloads both work.
studentSchema.pre('validate', function syncBranchAndDepartment(next) {
  if (!this.branch && this.department) {
    this.branch = this.department;
  }
  if (!this.department && this.branch) {
    this.department = this.branch;
  }
  next();
});

module.exports = mongoose.model('Student', studentSchema);