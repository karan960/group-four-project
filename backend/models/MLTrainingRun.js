const mongoose = require('mongoose');

const mlTrainingRunSchema = new mongoose.Schema({
  scope: {
    year: { type: String, default: 'All' },
    branch: { type: String, default: 'All' },
    division: { type: String, default: 'All' }
  },
  status: {
    type: String,
    enum: ['completed', 'failed'],
    required: true
  },
  rowsUsed: { type: Number, default: 0 },
  featuresUsed: { type: Number, default: 0 },
  metrics: {
    accuracy: { type: Number, default: 0 },
    precision: { type: Number, default: 0 },
    recall: { type: Number, default: 0 },
    f1Score: { type: Number, default: 0 }
  },
  trainedAt: { type: Date, default: Date.now },
  trainedBy: {
    userId: String,
    username: String
  },
  modelMeta: {
    modelType: String,
    modelPath: String
  },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

mlTrainingRunSchema.index({ 'scope.year': 1, 'scope.branch': 1, 'scope.division': 1, status: 1, trainedAt: -1 });
mlTrainingRunSchema.index({ trainedAt: -1 });

module.exports = mongoose.model('MLTrainingRun', mlTrainingRunSchema);
