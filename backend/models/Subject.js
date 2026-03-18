const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
  subjectName: { type: String, required: true, trim: true },
  shortName: { type: String, trim: true, uppercase: true },
  theoryHours: { type: Number, default: 0 },
  labHours: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  isLab: { type: Boolean, default: false }
}, {
  timestamps: true
});

subjectSchema.index({ subjectCode: 1 });

module.exports = mongoose.model('Subject', subjectSchema);
