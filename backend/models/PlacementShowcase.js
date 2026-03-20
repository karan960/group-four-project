const mongoose = require('mongoose');

const placementShowcaseSchema = new mongoose.Schema({
  studentName: { type: String, required: true, trim: true },
  year: {
    type: String,
    enum: ['First', 'Second', 'Third', 'Fourth'],
    required: true
  },
  branch: { type: String, required: true, trim: true },
  companyName: { type: String, required: true, trim: true },
  role: { type: String, trim: true },
  packageLpa: { type: Number },
  placedYear: { type: Number, required: true },
  note: { type: String, trim: true },
  createdBy: { type: String, trim: true },
  updatedBy: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

placementShowcaseSchema.index({ placedYear: -1, createdAt: -1 });
placementShowcaseSchema.index({ year: 1, branch: 1 });

module.exports = mongoose.model('PlacementShowcase', placementShowcaseSchema);
