const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');

const Timetable = require('../models/Timetable');
const Faculty = require('../models/Faculty');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { generateDynamicTimetableDraft } = require('../utils/dynamicTimetableGenerator');

const router = express.Router();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BREAK_WORDS = ['break', 'recess', 'lunch'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const lower = (file.originalname || '').toLowerCase();
    const isAllowed = allowed.some((ext) => lower.endsWith(ext));
    if (!isAllowed) {
      return cb(new Error('Only .xlsx, .xls, and .csv files are supported'));
    }
    cb(null, true);
  }
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

const normalizeDay = (value = '') => {
  const day = String(value).trim().toLowerCase();
  const map = {
    monday: 'Monday', mon: 'Monday',
    tuesday: 'Tuesday', tue: 'Tuesday', tues: 'Tuesday',
    wednesday: 'Wednesday', wed: 'Wednesday',
    thursday: 'Thursday', thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday',
    friday: 'Friday', fri: 'Friday'
  };
  return map[day] || null;
};

const parseTimeRange = (value = '') => {
  const text = String(value).replace(/[–—]/g, '-').trim();
  if (!text) return null;
  const parts = text.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const normalizeTime = (token) => {
    const clean = token.toLowerCase().replace(/\s/g, '');
    const match = clean.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const mins = parseInt(match[2] || '00', 10);
    const ampm = match[3];

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    if (hours > 23 || mins > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const start = normalizeTime(parts[0]);
  const end = normalizeTime(parts[1]);
  if (!start || !end) return null;
  return { startTime: start, endTime: end };
};

const inferSlotType = (text = '') => {
  const lower = String(text).toLowerCase();
  if (lower.includes('recess') || lower.includes('lunch')) return 'Recess';
  if (lower.includes('break')) return 'Break';
  if (lower.includes('lab')) return 'Lab';
  if (lower.includes('project')) return 'Project';
  return 'Lecture';
};

const parseComplexEntry = (rawValue = '') => {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  const initial = {
    subjectCode: '',
    subjectName: '',
    staffName: '',
    staffShortcode: '',
    roomNumber: '',
    batch: 'ALL',
    activityType: 'Theory',
    additionalInfo: raw
  };

  const complexPattern = /^([A-C])\s*:\s*([^()\-]+)(?:\(([^)]+)\))?\s*-\s*([A-Za-z]{2,6})\s*-\s*(.+)$/i;
  const complexMatch = raw.match(complexPattern);
  if (complexMatch) {
    return {
      ...initial,
      batch: complexMatch[1].toUpperCase(),
      activityType: /lab|l\.p/i.test(complexMatch[2]) ? 'Lab' : /project/i.test(complexMatch[2]) ? 'Project' : 'Other',
      subjectCode: (complexMatch[3] || '').toUpperCase(),
      staffShortcode: (complexMatch[4] || '').toUpperCase(),
      roomNumber: complexMatch[5]
    };
  }

  const hyphenParts = raw.split('-').map((p) => p.trim()).filter(Boolean);
  if (hyphenParts.length >= 3) {
    const maybeStaff = hyphenParts[hyphenParts.length - 2];
    const maybeRoom = hyphenParts[hyphenParts.length - 1];
    const subjectSegment = hyphenParts.slice(0, hyphenParts.length - 2).join(' - ');

    const codeMatch = subjectSegment.match(/\(([^)]+)\)/);
    const subjectCode = codeMatch ? codeMatch[1].toUpperCase() : '';

    return {
      ...initial,
      subjectName: subjectSegment.replace(/\([^)]+\)/g, '').trim() || subjectSegment,
      subjectCode,
      staffShortcode: /^[A-Za-z]{2,6}$/.test(maybeStaff) ? maybeStaff.toUpperCase() : '',
      roomNumber: maybeRoom,
      activityType: inferSlotType(raw)
    };
  }

  return {
    ...initial,
    subjectName: raw,
    activityType: inferSlotType(raw)
  };
};

const validateTimetable = async (timetableData) => {
  const warnings = [];
  const entries = timetableData.entries || [];
  const timeSlots = timetableData.timeSlots || [];

  const slotMap = new Map(timeSlots.map((slot) => [String(slot._id), slot]));

  const grouped = {};
  for (const entry of entries) {
    const key = `${entry.dayOfWeek}-${entry.timeSlotId}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(entry);
  }

  Object.entries(grouped).forEach(([key, group]) => {
    const staffSet = new Set();
    const roomSet = new Set();
    const batchSet = new Set();

    group.forEach((g) => {
      if (g.staffShortcode) {
        if (staffSet.has(g.staffShortcode)) {
          warnings.push(`Staff conflict at ${key}: ${g.staffShortcode} assigned multiple times.`);
        }
        staffSet.add(g.staffShortcode);
      }

      if (g.roomNumber) {
        if (roomSet.has(g.roomNumber)) {
          warnings.push(`Room conflict at ${key}: Room ${g.roomNumber} is double-booked.`);
        }
        roomSet.add(g.roomNumber);
      }

      const batch = g.batch || 'ALL';
      if (batchSet.has(batch)) {
        warnings.push(`Batch overlap at ${key}: Batch ${batch} has overlapping classes.`);
      }
      batchSet.add(batch);
    });
  });

  const staffCodes = Array.from(new Set(entries.map((e) => e.staffShortcode).filter(Boolean)));
  if (staffCodes.length) {
    const validStaff = await Faculty.find({
      $or: [
        { facultyId: { $in: staffCodes } },
        { facultyName: { $in: entries.map((e) => e.staffName).filter(Boolean) } }
      ]
    }).select('facultyId facultyName');

    const validCodes = new Set(validStaff.map((f) => (f.facultyId || '').toUpperCase()));
    staffCodes.forEach((code) => {
      if (!validCodes.has(code.toUpperCase())) {
        warnings.push(`Unknown staff code: ${code}`);
      }
    });
  }

  const subjectCodes = Array.from(new Set(entries.map((e) => e.subjectCode).filter(Boolean).map((s) => s.toUpperCase())));
  if (subjectCodes.length) {
    const existingSubjects = await Subject.find({ subjectCode: { $in: subjectCodes } }).select('subjectCode');
    const validSubjectCodes = new Set(existingSubjects.map((s) => s.subjectCode));
    subjectCodes.forEach((code) => {
      if (!validSubjectCodes.has(code)) {
        warnings.push(`Unknown subject code: ${code}`);
      }
    });
  }

  const dayWise = new Map();
  timeSlots.forEach((slot) => {
    const day = slot.dayOfWeek;
    if (!dayWise.has(day)) dayWise.set(day, []);
    dayWise.get(day).push(slot);
  });

  dayWise.forEach((slots, day) => {
    const sorted = slots
      .slice()
      .sort((a, b) => (a.startTime > b.startTime ? 1 : -1));

    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        warnings.push(`Overlapping time slots in ${day}: ${sorted[i - 1].startTime}-${sorted[i - 1].endTime} and ${sorted[i].startTime}-${sorted[i].endTime}`);
      }
    }
  });

  return warnings;
};

const parseExcelToTimetable = (fileBuffer, metadata = {}) => {
  const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const parseWarnings = [];
  const matrix = rows.map((row) => row.map((cell) => String(cell || '').trim()));

  let headerRowIndex = -1;
  let dayStartCol = -1;

  for (let i = 0; i < Math.min(matrix.length, 25); i += 1) {
    const row = matrix[i] || [];
    let matches = 0;
    let firstMatchCol = -1;

    row.forEach((cell, colIdx) => {
      const normalized = normalizeDay(cell);
      if (normalized) {
        matches += 1;
        if (firstMatchCol === -1) firstMatchCol = colIdx;
      }
    });

    if (matches >= 3) {
      headerRowIndex = i;
      dayStartCol = firstMatchCol;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('Unable to detect day header row in uploaded sheet.');
  }

  const headerRow = matrix[headerRowIndex] || [];
  const dayColumns = [];
  for (let col = dayStartCol; col < headerRow.length; col += 1) {
    const day = normalizeDay(headerRow[col]);
    if (day) {
      dayColumns.push({ col, day });
    }
  }

  if (!dayColumns.length) {
    throw new Error('No day columns found in timetable sheet.');
  }

  const slotColumns = [];
  for (let col = 0; col < dayStartCol; col += 1) {
    const label = headerRow[col] || `Slot-${col + 1}`;
    const parsed = parseTimeRange(label);
    if (parsed) {
      slotColumns.push({
        col,
        label,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        slotType: inferSlotType(label)
      });
    }
  }

  if (!slotColumns.length) {
    parseWarnings.push('No explicit time ranges found. Generated generic hourly slots.');
    for (let col = 0; col < dayStartCol; col += 1) {
      const startHour = 8 + col;
      slotColumns.push({
        col,
        label: `Slot-${col + 1}`,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(startHour + 1).padStart(2, '0')}:00`,
        slotType: 'Lecture'
      });
    }
  }

  const preparedSlots = [];
  const parsedEntries = [];

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const dayCells = dayColumns.map(({ col }) => String(row[col] || '').trim());
    const hasDayData = dayCells.some(Boolean);
    if (!hasDayData) continue;

    const timeLabel = row.slice(0, dayStartCol).find((cell) => parseTimeRange(cell));
    const parsedRange = parseTimeRange(timeLabel || '');
    const fallbackIndex = rowIndex - (headerRowIndex + 1);
    const startHour = 8 + Math.max(0, fallbackIndex);

    const slotDef = {
      startTime: parsedRange?.startTime || `${String(startHour).padStart(2, '0')}:00`,
      endTime: parsedRange?.endTime || `${String(startHour + 1).padStart(2, '0')}:00`,
      slotType: inferSlotType(timeLabel || '')
    };

    dayColumns.forEach(({ day, col }) => {
      const slotKey = `${day}-${rowIndex}`;
      preparedSlots.push({
        slotKey,
        dayOfWeek: day,
        startTime: slotDef.startTime,
        endTime: slotDef.endTime,
        slotType: slotDef.slotType
      });

      const text = String(row[col] || '').trim();
      if (!text) return;

      const lower = text.toLowerCase();
      if (BREAK_WORDS.some((word) => lower.includes(word))) return;

      const parsed = parseComplexEntry(text);
      if (!parsed) return;

      parsedEntries.push({
        slotKey,
        dayOfWeek: day,
        ...parsed
      });
    });
  }

  const generated = new Timetable({
    academicYear: metadata.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    semester: metadata.semester || 'SEMESTER-I',
    className: metadata.className || 'UNSPECIFIED CLASS',
    division: metadata.division || '',
    effectiveFrom: metadata.effectiveFrom ? new Date(metadata.effectiveFrom) : new Date(),
    classTeacher: metadata.classTeacher || '',
    classroom: metadata.classroom || '',
    batchDetails: Array.isArray(metadata.batchDetails) ? metadata.batchDetails : [],
    timeSlots: preparedSlots.map(({ slotKey, ...slot }) => slot),
    entries: [],
    parseWarnings
  });

  const slotIdByKey = new Map();
  preparedSlots.forEach((slot, index) => {
    const docSlot = generated.timeSlots[index];
    if (docSlot?._id) {
      slotIdByKey.set(slot.slotKey, docSlot._id);
    }
  });

  generated.entries = parsedEntries
    .map((entry) => ({
      ...entry,
      timeSlotId: slotIdByKey.get(entry.slotKey)
    }))
    .filter((entry) => entry.timeSlotId)
    .map(({ slotKey, ...entry }) => entry);

  return generated;
};

const resolveStudentTimetable = async (student) => {
  const query = {
    isPublished: true,
    isActive: true,
    division: student.division
  };

  const byYear = await Timetable.findOne({
    ...query,
    className: { $regex: student.year, $options: 'i' }
  }).sort({ updatedAt: -1 });

  if (byYear) return byYear;

  return Timetable.findOne(query).sort({ updatedAt: -1 });
};

router.post('/admin/upload-timetable', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an Excel file' });
    }

    let batchDetails = [];
    if (req.body.batchDetails) {
      try {
        const parsed = JSON.parse(req.body.batchDetails);
        if (Array.isArray(parsed)) batchDetails = parsed;
      } catch (error) {
        batchDetails = [];
      }
    }

    const timetableDoc = parseExcelToTimetable(req.file.buffer, {
      academicYear: req.body.academicYear,
      semester: req.body.semester,
      className: req.body.className,
      division: req.body.division,
      effectiveFrom: req.body.effectiveFrom,
      classTeacher: req.body.classTeacher,
      classroom: req.body.classroom,
      batchDetails
    });

    timetableDoc.sourceFileName = req.file.originalname;
    timetableDoc.createdBy = {
      userId: req.user.userId,
      username: req.user.username
    };

    timetableDoc.validationWarnings = await validateTimetable(timetableDoc);

    await timetableDoc.save();

    res.status(201).json({
      message: 'Timetable uploaded and parsed successfully',
      timetableId: timetableDoc._id,
      preview: timetableDoc,
      warnings: timetableDoc.validationWarnings
    });
  } catch (error) {
    console.error('Error uploading timetable:', error);
    const knownInputError =
      error?.name === 'MulterError' ||
      /Unable to detect day header row|No day columns found|Only \.xlsx, \.xls, and \.csv files are supported/i.test(error?.message || '');

    if (knownInputError) {
      return res.status(400).json({
        message: 'Invalid timetable file format. Please use the template and include Monday-Friday headers.',
        error: error.message
      });
    }

    res.status(500).json({
      message: 'Failed to upload timetable due to server error',
      error: error.message
    });
  }
});

router.post('/admin/generate-dynamic-timetable', requireRole('admin'), async (req, res) => {
  try {
    const { academicYear, semester, requirements, saveDrafts = false } = req.body || {};

    if (!Array.isArray(requirements) || requirements.length === 0) {
      return res.status(400).json({ message: 'At least one subject requirement is required to generate timetable.' });
    }

    const result = generateDynamicTimetableDraft({
      academicYear,
      semester,
      requirements
    });

    let savedDrafts = [];
    if (saveDrafts) {
      savedDrafts = [];
      for (const draft of result.drafts || []) {
        const timetableDoc = new Timetable({
          ...draft.timetable,
          createdBy: {
            userId: req.user.userId,
            username: req.user.username
          },
          sourceFileName: 'dynamic-generator',
          parseWarnings: result.warnings || []
        });

        timetableDoc.validationWarnings = await validateTimetable(timetableDoc);
        await timetableDoc.save();

        savedDrafts.push({
          _id: timetableDoc._id,
          className: timetableDoc.className,
          division: timetableDoc.division,
          year: draft.year,
          entriesCount: (timetableDoc.entries || []).length,
          warnings: timetableDoc.validationWarnings || []
        });
      }
    }

    return res.json({
      message: saveDrafts ? 'Dynamic timetable generated and saved successfully.' : 'Dynamic timetable draft generated successfully.',
      ...result,
      savedDrafts
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to generate dynamic timetable draft',
      error: error.message
    });
  }
});

router.get('/admin/preview/:id', requireRole('admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    res.json({ timetable });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch timetable preview', error: error.message });
  }
});

router.post('/admin/publish/:id', requireRole('admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    if (req.body.setActive !== false) {
      await Timetable.updateMany(
        { className: timetable.className, semester: timetable.semester, academicYear: timetable.academicYear },
        { $set: { isActive: false } }
      );
      timetable.isActive = true;
    }

    timetable.isPublished = true;
    timetable.validationWarnings = await validateTimetable(timetable);
    await timetable.save();

    const recipientUsers = await User.find({ role: { $in: ['student', 'faculty'] }, isActive: true })
      .select('_id role referenceId');

    const recipients = recipientUsers.map((u) => ({
      userId: u._id,
      role: u.role,
      recipientId: u.referenceId || null
    }));

    const notification = new Notification({
      sender: {
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        name: req.user.username
      },
      recipients,
      title: `New timetable published: ${timetable.className}`,
      message: `A new timetable (${timetable.academicYear} - ${timetable.semester}) is now active from ${new Date(timetable.effectiveFrom).toLocaleDateString()}.`,
      type: 'update',
      priority: 'normal',
      targetRole: 'all',
      isPublished: true
    });

    await notification.save();

    res.json({
      message: 'Timetable published successfully',
      timetable,
      warnings: timetable.validationWarnings
    });
  } catch (error) {
    console.error('Error publishing timetable:', error);
    res.status(500).json({ message: 'Failed to publish timetable', error: error.message });
  }
});

router.put('/admin/timetable/:id', requireRole('admin'), async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    const updatable = [
      'academicYear', 'semester', 'className', 'division', 'effectiveFrom',
      'classTeacher', 'classroom', 'batchDetails', 'timeSlots', 'entries', 'isActive', 'isPublished'
    ];

    updatable.forEach((field) => {
      if (req.body[field] !== undefined) {
        timetable[field] = req.body[field];
      }
    });

    if (req.body.cloneVersion === true) {
      const clone = new Timetable({
        ...timetable.toObject(),
        _id: undefined,
        parentTimetableId: timetable._id,
        version: timetable.version + 1,
        isPublished: false,
        isActive: false,
        createdBy: { userId: req.user.userId, username: req.user.username }
      });
      clone.validationWarnings = await validateTimetable(clone);
      await clone.save();

      return res.json({
        message: 'New version created successfully',
        timetable: clone,
        warnings: clone.validationWarnings
      });
    }

    timetable.validationWarnings = await validateTimetable(timetable);
    await timetable.save();

    res.json({
      message: 'Timetable updated successfully',
      timetable,
      warnings: timetable.validationWarnings
    });
  } catch (error) {
    console.error('Error updating timetable:', error);
    res.status(500).json({ message: 'Failed to update timetable', error: error.message });
  }
});

router.delete('/admin/timetable/:id', requireRole('admin'), async (req, res) => {
  try {
    const deleted = await Timetable.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    res.json({ message: 'Timetable deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete timetable', error: error.message });
  }
});

router.get('/student/timetable', requireRole('student', 'admin'), async (req, res) => {
  try {
    let student = null;

    if (req.user.role === 'student') {
      student = await Student.findOne({ prn: req.user.referenceId, isActive: true });
    } else if (req.query.prn) {
      student = await Student.findOne({ prn: req.query.prn, isActive: true });
    }

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const timetable = await resolveStudentTimetable(student);
    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable available' });
    }

    const batch = (req.query.batch || student.batch || 'ALL').toUpperCase();

    const filteredEntries = timetable.entries.filter((entry) => {
      if (!entry.batch || entry.batch === 'ALL') return true;
      return entry.batch.toUpperCase() === batch;
    });

    res.json({
      timetable,
      studentContext: {
        prn: student.prn,
        year: student.year,
        division: student.division,
        batch
      },
      entries: filteredEntries
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student timetable', error: error.message });
  }
});

router.get('/student/timetable/:date', requireRole('student', 'admin'), async (req, res) => {
  try {
    const date = new Date(req.params.date);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const dayName = DAYS[(date.getDay() + 6) % 7];
    if (!dayName) {
      return res.status(400).json({ message: 'Only weekday timetable available' });
    }

    const student = await Student.findOne({ prn: req.user.referenceId, isActive: true });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const timetable = await resolveStudentTimetable(student);
    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable available' });
    }

    const daySlots = timetable.timeSlots.filter((slot) => slot.dayOfWeek === dayName);
    const slotIds = new Set(daySlots.map((slot) => String(slot._id)));
    const entries = timetable.entries.filter((entry) => slotIds.has(String(entry.timeSlotId)));

    res.json({
      date: req.params.date,
      day: dayName,
      timeSlots: daySlots,
      entries
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch daily schedule', error: error.message });
  }
});

router.get('/faculty/timetable/:staffId', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const staffId = String(req.params.staffId || '').toUpperCase();
    const facultyProfile = await Faculty.findOne({ facultyId: staffId }).select('facultyName facultyId');
    const facultyName = (facultyProfile?.facultyName || '').toLowerCase();
    const timetable = await Timetable.findOne({ isPublished: true, isActive: true }).sort({ updatedAt: -1 });

    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable available' });
    }

    const entries = timetable.entries.filter((entry) => {
      const byCode = (entry.staffShortcode || '').toUpperCase() === staffId;
      const byName = facultyName && (entry.staffName || '').toLowerCase().includes(facultyName);
      return byCode || byName;
    });

    res.json({ timetable, entries, staffId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch faculty timetable', error: error.message });
  }
});

router.get('/faculty/classes/:staffId', requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const staffId = String(req.params.staffId || '').toUpperCase();
    const facultyProfile = await Faculty.findOne({ facultyId: staffId }).select('facultyName facultyId');
    const facultyName = (facultyProfile?.facultyName || '').toLowerCase();
    const timetable = await Timetable.findOne({ isPublished: true, isActive: true }).sort({ updatedAt: -1 });

    if (!timetable) {
      return res.status(404).json({ message: 'No active timetable available' });
    }

    const classes = timetable.entries
      .filter((entry) => {
        const byCode = (entry.staffShortcode || '').toUpperCase() === staffId;
        const byName = facultyName && (entry.staffName || '').toLowerCase().includes(facultyName);
        return byCode || byName;
      })
      .map((entry) => ({
        dayOfWeek: entry.dayOfWeek,
        subjectCode: entry.subjectCode,
        subjectName: entry.subjectName,
        roomNumber: entry.roomNumber,
        batch: entry.batch,
        activityType: entry.activityType
      }));

    res.json({ classes });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch faculty classes', error: error.message });
  }
});

module.exports = router;
