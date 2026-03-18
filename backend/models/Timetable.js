const mongoose = require('mongoose');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const batchGroupSchema = new mongoose.Schema({
  batchName: { type: String, trim: true, uppercase: true },
  studentRange: { type: String, trim: true }
}, { _id: false });

const timeSlotSchema = new mongoose.Schema({
  dayOfWeek: { type: String, enum: DAYS, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  slotType: {
    type: String,
    enum: ['Lecture', 'Lab', 'Project', 'Recess', 'Break'],
    default: 'Lecture'
  }
}, { timestamps: false });

const timetableEntrySchema = new mongoose.Schema({
  dayOfWeek: { type: String, enum: DAYS, required: true },
  timeSlotId: { type: mongoose.Schema.Types.ObjectId, required: true },
  subjectCode: { type: String, trim: true },
  subjectName: { type: String, trim: true },
  staffName: { type: String, trim: true },
  staffShortcode: { type: String, trim: true, uppercase: true },
  roomNumber: { type: String, trim: true },
  batch: { type: String, trim: true, uppercase: true, default: 'ALL' },
  activityType: {
    type: String,
    enum: ['Theory', 'Lab', 'Project', 'Tutorial', 'Other'],
    default: 'Theory'
  },
  additionalInfo: { type: String, trim: true }
}, { timestamps: false });

const timetableSchema = new mongoose.Schema({
  academicYear: { type: String, required: true, trim: true },
  semester: { type: String, required: true, trim: true },
  className: { type: String, required: true, trim: true },
  division: { type: String, trim: true },
  effectiveFrom: { type: Date, required: true },
  classTeacher: { type: String, trim: true },
  classroom: { type: String, trim: true },
  batchDetails: { type: [batchGroupSchema], default: [] },

  timeSlots: { type: [timeSlotSchema], default: [] },
  entries: { type: [timetableEntrySchema], default: [] },

  sourceFileName: { type: String, trim: true },
  parseWarnings: { type: [String], default: [] },
  validationWarnings: { type: [String], default: [] },

  version: { type: Number, default: 1 },
  parentTimetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', default: null },
  isPublished: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false },

  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId },
    username: { type: String, trim: true }
  }
}, {
  timestamps: true
});

timetableSchema.index({ className: 1, semester: 1, academicYear: 1, version: -1 });
timetableSchema.index({ isActive: 1, isPublished: 1 });
timetableSchema.index({ 'entries.staffShortcode': 1 });

module.exports = mongoose.model('Timetable', timetableSchema);
