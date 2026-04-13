const ERPWorkItem = require('../models/ERPWorkItem');
const CohortAssignment = require('../models/CohortAssignment');

const OPEN_STATUSES = ['open', 'in_progress', 'blocked'];

const resolveCohortOwner = async ({ year, division }) => {
  if (!year || !division) {
    return { ownerRole: 'admin', ownerRef: '' };
  }

  const assignment = await CohortAssignment.findOne({ year, division, isActive: true }).lean();
  if (assignment?.primaryFacultyId) {
    return { ownerRole: 'faculty', ownerRef: assignment.primaryFacultyId };
  }

  return { ownerRole: 'admin', ownerRef: '' };
};

const createWorkItem = async ({
  module,
  type,
  title,
  description,
  priority = 'medium',
  ownerRole,
  ownerRef = '',
  sourceRole,
  sourceRef = '',
  studentPRN = '',
  facultyId = '',
  year = '',
  division = '',
  dueDate = null,
  entityRef = '',
  metadata = {},
  actor = ''
}) => {
  const doc = await ERPWorkItem.create({
    module,
    type,
    title,
    description,
    priority,
    ownerRole,
    ownerRef,
    sourceRole,
    sourceRef,
    studentPRN,
    facultyId,
    year,
    division,
    dueDate,
    entityRef,
    metadata,
    timeline: [
      {
        actor,
        action: 'created',
        note: title
      }
    ]
  });

  return doc;
};

const closeWorkItemsByEntityRef = async ({ module, entityRef, actor = '', note = 'Closed automatically' }) => {
  if (!module || !entityRef) return { modifiedCount: 0 };

  return ERPWorkItem.updateMany(
    {
      module,
      entityRef,
      status: { $in: OPEN_STATUSES }
    },
    {
      $set: { status: 'closed' },
      $push: {
        timeline: {
          actor,
          action: 'closed',
          note
        }
      }
    }
  );
};

const ensureAttendanceInterventionItem = async ({ student, month, year, actor = '' }) => {
  if (!student?.prn || Number(student.overallAttendance || 0) >= 75) return null;

  const existing = await ERPWorkItem.findOne({
    module: 'attendance',
    type: 'low-attendance-intervention',
    studentPRN: student.prn,
    status: { $in: OPEN_STATUSES },
    'metadata.month': month,
    'metadata.year': year
  });

  if (existing) return existing;

  const owner = await resolveCohortOwner({ year: student.year, division: student.division });

  return createWorkItem({
    module: 'attendance',
    type: 'low-attendance-intervention',
    title: `Low attendance intervention for ${student.studentName}`,
    description: `Attendance dropped to ${student.overallAttendance}% for ${month}-${year}.` ,
    priority: Number(student.overallAttendance || 0) < 60 ? 'critical' : 'high',
    ownerRole: owner.ownerRole,
    ownerRef: owner.ownerRef,
    sourceRole: 'student',
    sourceRef: student.prn,
    studentPRN: student.prn,
    year: student.year,
    division: student.division,
    entityRef: `${student.prn}:${month}:${year}`,
    metadata: {
      month,
      year,
      overallAttendance: Number(student.overallAttendance || 0)
    },
    actor
  });
};

module.exports = {
  resolveCohortOwner,
  createWorkItem,
  closeWorkItemsByEntityRef,
  ensureAttendanceInterventionItem
};
