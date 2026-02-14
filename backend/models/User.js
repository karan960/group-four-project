 const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'faculty', 'admin'], required: true },
  referenceId: { type: String, required: true },
  // theme preference: client can set to 'light', 'dark' or 'system'
  theme: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);