const mongoose = require('mongoose');

const WORK_ITEM_STATUS = ['open', 'in_progress', 'blocked', 'approved', 'closed'];
const WORK_ITEM_PRIORITY = ['low', 'medium', 'high', 'critical'];
const OWNER_ROLES = ['admin', 'faculty', 'student'];

const erpWorkItemSchema = new mongoose.Schema(
  {
    module: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: WORK_ITEM_STATUS, default: 'open' },
    priority: { type: String, enum: WORK_ITEM_PRIORITY, default: 'medium' },

    ownerRole: { type: String, enum: OWNER_ROLES, required: true },
    ownerRef: { type: String, default: '', trim: true },

    sourceRole: { type: String, enum: OWNER_ROLES, required: true },
    sourceRef: { type: String, default: '', trim: true },

    studentPRN: { type: String, default: '', trim: true },
    facultyId: { type: String, default: '', trim: true },
    year: { type: String, default: '', trim: true },
    division: { type: String, default: '', trim: true },

    dueDate: { type: Date, default: null },
    entityRef: { type: String, default: '', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    timeline: [
      {
        at: { type: Date, default: Date.now },
        actor: { type: String, default: '' },
        action: { type: String, default: '' },
        note: { type: String, default: '' }
      }
    ]
  },
  { timestamps: true }
);

erpWorkItemSchema.index({ ownerRole: 1, ownerRef: 1, status: 1, priority: -1, updatedAt: -1 });
erpWorkItemSchema.index({ module: 1, entityRef: 1, status: 1 });
erpWorkItemSchema.index({ studentPRN: 1, status: 1 });
erpWorkItemSchema.index({ year: 1, division: 1, status: 1 });

module.exports = mongoose.model('ERPWorkItem', erpWorkItemSchema);
