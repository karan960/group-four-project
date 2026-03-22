const mongoose = require('mongoose');

const Student = require('../models/Student');
const Faculty = require('../models/Faculty');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const AttendanceSession = require('../models/AttendanceSession');
const MLTrainingRun = require('../models/MLTrainingRun');

const IT_DEPARTMENT = 'Information Technology';
const ALLOWED_YEARS = ['First', 'Second', 'Third', 'Fourth'];
const ALLOWED_DIVISIONS = ['A', 'B'];

const normalizeYear = (input, fallback = 'First') => {
  const raw = String(input || '').trim();
  if (!raw) return fallback;

  const byNumber = {
    '1': 'First',
    '2': 'Second',
    '3': 'Third',
    '4': 'Fourth'
  };
  if (byNumber[raw]) return byNumber[raw];

  const cap = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return ALLOWED_YEARS.includes(cap) ? cap : fallback;
};

const normalizeDivision = (input, fallback = 'A') => {
  const val = String(input || '').trim().toUpperCase();
  return ALLOWED_DIVISIONS.includes(val) ? val : fallback;
};

async function normalizeStudents(dryRun) {
  const students = await Student.find({});
  let changed = 0;

  for (const s of students) {
    const nextYear = normalizeYear(s.year, 'First');
    const nextDivision = normalizeDivision(s.division, 'A');

    const hasChanges =
      s.year !== nextYear ||
      s.division !== nextDivision ||
      s.branch !== IT_DEPARTMENT ||
      s.department !== IT_DEPARTMENT;

    if (!hasChanges) continue;

    changed += 1;
    if (!dryRun) {
      s.year = nextYear;
      s.division = nextDivision;
      s.branch = IT_DEPARTMENT;
      s.department = IT_DEPARTMENT;
      s.lastUpdated = new Date();
      await s.save();
    }
  }

  return { total: students.length, changed };
}

async function normalizeFaculty(dryRun) {
  const facultyList = await Faculty.find({});
  let changed = 0;

  for (const f of facultyList) {
    let touched = false;

    if (f.department !== IT_DEPARTMENT) {
      f.department = IT_DEPARTMENT;
      touched = true;
    }

    if (Array.isArray(f.assignedSubjects)) {
      f.assignedSubjects = f.assignedSubjects.map((sub) => {
        const nextYear = normalizeYear(sub?.year, 'First');
        const nextDivision = normalizeDivision(sub?.division, 'A');
        if (sub?.year !== nextYear || sub?.division !== nextDivision) touched = true;
        return { ...sub.toObject?.() || sub, year: nextYear, division: nextDivision };
      });
    }

    if (Array.isArray(f.manuallyAddedSubjects)) {
      f.manuallyAddedSubjects = f.manuallyAddedSubjects.map((sub) => {
        const nextYear = normalizeYear(sub?.year, 'First');
        const nextDivision = normalizeDivision(sub?.division, 'A');
        if (sub?.year !== nextYear || sub?.division !== nextDivision) touched = true;
        return { ...sub.toObject?.() || sub, year: nextYear, division: nextDivision };
      });
    }

    if (!touched) continue;

    changed += 1;
    if (!dryRun) {
      f.lastUpdated = new Date();
      await f.save();
    }
  }

  return { total: facultyList.length, changed };
}

async function normalizeCourses(dryRun) {
  const courses = await Course.find({});
  let changed = 0;

  for (const c of courses) {
    const nextYear = normalizeYear(c.year, 'First');
    const nextDivision = normalizeDivision(c.division, 'A');

    const hasChanges =
      c.year !== nextYear ||
      c.division !== nextDivision ||
      c.branch !== IT_DEPARTMENT;

    if (!hasChanges) continue;

    changed += 1;
    if (!dryRun) {
      c.year = nextYear;
      c.division = nextDivision;
      c.branch = IT_DEPARTMENT;
      await c.save();
    }
  }

  return { total: courses.length, changed };
}

async function normalizeAssignments(dryRun) {
  const assignments = await Assignment.find({});
  let changed = 0;

  for (const a of assignments) {
    const rawYear = String(a.targetYear || '').trim();
    const nextYear = rawYear.toUpperCase() === 'ALL' ? 'ALL' : normalizeYear(rawYear, '');

    const rawBranch = String(a.targetBranch || '').trim();
    const nextBranch = rawBranch.toUpperCase() === 'ALL' ? 'ALL' : IT_DEPARTMENT;

    const rawDivision = String(a.targetDivision || '').trim().toUpperCase();
    const nextDivision = rawDivision === 'ALL' ? 'ALL' : normalizeDivision(rawDivision, 'A');

    const hasChanges =
      String(a.targetYear || '') !== String(nextYear || '') ||
      String(a.targetBranch || '') !== String(nextBranch || '') ||
      String(a.targetDivision || '') !== String(nextDivision || '');

    if (!hasChanges) continue;

    changed += 1;
    if (!dryRun) {
      a.targetYear = nextYear;
      a.targetBranch = nextBranch;
      a.targetDivision = nextDivision;
      await a.save();
    }
  }

  return { total: assignments.length, changed };
}

async function normalizeAttendanceSessions(dryRun) {
  const sessions = await AttendanceSession.find({});
  let changed = 0;

  for (const s of sessions) {
    const scope = s.classScope || {};

    const rawYear = String(scope.year || '').trim();
    const nextYear = rawYear.toUpperCase() === 'ALL' ? 'ALL' : normalizeYear(rawYear, 'ALL');

    const rawBranch = String(scope.branch || '').trim();
    const nextBranch = rawBranch.toUpperCase() === 'ALL' ? 'ALL' : IT_DEPARTMENT;

    const rawDivision = String(scope.division || '').trim().toUpperCase();
    const nextDivision = rawDivision === 'ALL' ? 'ALL' : normalizeDivision(rawDivision, 'ALL');

    const hasChanges =
      String(scope.year || '') !== String(nextYear || '') ||
      String(scope.branch || '') !== String(nextBranch || '') ||
      String(scope.division || '') !== String(nextDivision || '');

    if (!hasChanges) continue;

    changed += 1;
    if (!dryRun) {
      s.classScope = {
        ...scope,
        year: nextYear,
        branch: nextBranch,
        division: nextDivision
      };
      await s.save();
    }
  }

  return { total: sessions.length, changed };
}

async function normalizeTrainingRuns(dryRun) {
  const runs = await MLTrainingRun.find({});
  let changed = 0;

  for (const run of runs) {
    const scope = run.scope || {};
    const nextYear = String(scope.year || 'All');
    const nextDivision = String(scope.division || 'All').trim().toUpperCase();
    const normalizedDivision = nextDivision === 'ALL' ? 'All' : normalizeDivision(nextDivision, 'A');

    const hasChanges =
      String(scope.branch || '') !== IT_DEPARTMENT ||
      String(scope.division || '') !== normalizedDivision;

    if (!hasChanges) continue;

    changed += 1;
    if (!dryRun) {
      run.scope = {
        ...scope,
        year: nextYear,
        branch: IT_DEPARTMENT,
        division: normalizedDivision
      };
      await run.save();
    }
  }

  return { total: runs.length, changed };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Dept_database';

  await mongoose.connect(uri);

  console.log(`Connected to MongoDB: ${uri}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY CHANGES'}`);

  const results = {};
  results.students = await normalizeStudents(dryRun);
  results.faculty = await normalizeFaculty(dryRun);
  results.courses = await normalizeCourses(dryRun);
  results.assignments = await normalizeAssignments(dryRun);
  results.attendanceSessions = await normalizeAttendanceSessions(dryRun);
  results.trainingRuns = await normalizeTrainingRuns(dryRun);

  console.log('\nNormalization summary:');
  Object.entries(results).forEach(([key, val]) => {
    console.log(`- ${key}: ${val.changed}/${val.total} records ${dryRun ? 'would be updated' : 'updated'}`);
  });

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(async (err) => {
  console.error('Normalization failed:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
