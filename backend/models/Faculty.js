 const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  // Basic Information
  facultyId: { type: String, required: true, unique: true },
  facultyName: { type: String, required: true },
  email: { type: String, required: true },
  mobileNo: { type: String },
  department: { type: String, required: true },
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
    year: String,
    division: String,
    semester: Number
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