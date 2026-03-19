const mongoose = require('mongoose');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const START_MINUTES = 9 * 60;
const END_MINUTES = 17 * 60;
const LUNCH_START = 13 * 60 + 30;
const LUNCH_END = 14 * 60;
const SLOT_DURATION = 45;

const pad = (num) => String(num).padStart(2, '0');
const toTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const normalizeYear = (value) => {
  const token = String(value || '').trim().toUpperCase();
  const map = {
    '1': 'First',
    '1ST': 'First',
    FIRST: 'First',
    '2': 'Second',
    '2ND': 'Second',
    SECOND: 'Second',
    '3': 'Third',
    '3RD': 'Third',
    THIRD: 'Third',
    '4': 'Fourth',
    '4TH': 'Fourth',
    FOURTH: 'Fourth'
  };

  return map[token] || value || 'First';
};

const normalizeType = (value) => {
  const token = String(value || '').trim().toLowerCase();
  return token === 'practical' ? 'Practical' : 'Theory';
};

const createClassKey = (year, division) => `${year}::${String(division || 'A').trim().toUpperCase() || 'A'}`;

const splitClassKey = (classKey) => {
  const [year = 'First', division = 'A'] = String(classKey || '').split('::');
  return { year, division };
};

const createDailyRows = () => {
  const rows = [];
  let cursor = START_MINUTES;
  let lectureIndex = 0;

  while (cursor < END_MINUTES) {
    if (cursor === LUNCH_START) {
      rows.push({
        rowType: 'Break',
        locked: true,
        startTime: toTime(LUNCH_START),
        endTime: toTime(LUNCH_END),
        lectureIndex: null
      });
      cursor = LUNCH_END;
      continue;
    }

    const end = Math.min(cursor + SLOT_DURATION, END_MINUTES);
    rows.push({
      rowType: 'Lecture',
      locked: false,
      startTime: toTime(cursor),
      endTime: toTime(end),
      lectureIndex
    });
    lectureIndex += 1;
    cursor = end;
  }

  return rows;
};

const generateTimeSlots = () => {
  const rows = createDailyRows();
  const timeSlots = [];

  DAYS.forEach((day) => {
    rows.forEach((row) => {
      timeSlots.push({
        _id: new mongoose.Types.ObjectId().toString(),
        dayOfWeek: day,
        startTime: row.startTime,
        endTime: row.endTime,
        slotType: row.rowType === 'Break' ? 'Break' : 'Lecture',
        locked: row.locked,
        lectureIndex: row.lectureIndex
      });
    });
  });

  return { rows, timeSlots };
};

const slotMapByDay = (timeSlots) => {
  const map = new Map();
  DAYS.forEach((day) => {
    map.set(day, timeSlots
      .filter((slot) => slot.dayOfWeek === day)
      .sort((a, b) => (a.startTime > b.startTime ? 1 : -1)));
  });
  return map;
};

const lectureSlotsForDay = (slotsByDay, day) => (slotsByDay.get(day) || []).filter((slot) => !slot.locked);

const keyForSlot = (day, lectureIndex) => `${day}-${lectureIndex}`;

const generateDynamicTimetableDraft = ({ requirements = [], academicYear = '', semester = '' }) => {
  const normalizedRequirements = requirements
    .map((req, idx) => ({
      id: `${idx + 1}`,
      subjectName: String(req.subjectName || '').trim(),
      assignedTeacher: String(req.assignedTeacher || '').trim(),
      year: normalizeYear(req.year),
      weeklyFrequency: Math.max(1, Number(req.weeklyFrequency || 1)),
      type: normalizeType(req.type),
      division: String(req.division || 'A').trim().toUpperCase() || 'A'
    }))
    .filter((req) => req.subjectName && req.assignedTeacher);

  const { rows, timeSlots } = generateTimeSlots();
  const slotsByDay = slotMapByDay(timeSlots);

  const entriesByClass = new Map();
  const classOccupancy = new Map();
  const teacherOccupancy = new Map();
  const subjectDayUsed = new Map();
  const teacherDailyLoad = new Map();
  const classDailyLoad = new Map();
  const warnings = [];

  const ensureClassEntry = (classKey) => {
    if (!entriesByClass.has(classKey)) entriesByClass.set(classKey, []);
    if (!classOccupancy.has(classKey)) classOccupancy.set(classKey, new Set());
    if (!classDailyLoad.has(classKey)) classDailyLoad.set(classKey, new Map());
  };

  const ensureTeacher = (teacher) => {
    if (!teacherOccupancy.has(teacher)) teacherOccupancy.set(teacher, new Set());
    if (!teacherDailyLoad.has(teacher)) teacherDailyLoad.set(teacher, new Map());
  };

  const getDailyLoad = (loadMap, owner, day) => {
    const dayMap = loadMap.get(owner);
    if (!dayMap) return 0;
    return Number(dayMap.get(day) || 0);
  };

  const incrementDailyLoad = (loadMap, owner, day, increment = 1) => {
    if (!loadMap.has(owner)) loadMap.set(owner, new Map());
    const dayMap = loadMap.get(owner);
    dayMap.set(day, Number(dayMap.get(day) || 0) + increment);
  };

  const placeTheory = (req) => {
    const classKey = createClassKey(req.year, req.division);
    ensureClassEntry(classKey);
    ensureTeacher(req.assignedTeacher);

    const classSet = classOccupancy.get(classKey);
    const teacherSet = teacherOccupancy.get(req.assignedTeacher);

    let remaining = req.weeklyFrequency;
    const subjectKey = `${classKey}::${req.subjectName}`;
    if (!subjectDayUsed.has(subjectKey)) subjectDayUsed.set(subjectKey, new Set());

    while (remaining > 0) {
      const usedDays = subjectDayUsed.get(subjectKey);
      const candidateDays = DAYS
        .filter((day) => !usedDays.has(day))
        .sort((a, b) => {
          const classLoadA = getDailyLoad(classDailyLoad, classKey, a);
          const classLoadB = getDailyLoad(classDailyLoad, classKey, b);
          const teacherLoadA = getDailyLoad(teacherDailyLoad, req.assignedTeacher, a);
          const teacherLoadB = getDailyLoad(teacherDailyLoad, req.assignedTeacher, b);
          return (classLoadA + teacherLoadA) - (classLoadB + teacherLoadB);
        });

      if (!candidateDays.length) {
        warnings.push(`Could not fully distribute theory subject ${req.subjectName} for ${req.year}-${req.division}.`);
        break;
      }

      let placed = false;
      for (const day of candidateDays) {
        const lectureSlots = lectureSlotsForDay(slotsByDay, day);
        for (const slot of lectureSlots) {
          const lectureIdx = slot.lectureIndex;
          const slotKey = keyForSlot(day, lectureIdx);
          if (classSet.has(slotKey) || teacherSet.has(slotKey)) continue;

          entriesByClass.get(classKey).push({
            dayOfWeek: day,
            timeSlotId: slot._id,
            subjectCode: req.subjectName.slice(0, 6).toUpperCase(),
            subjectName: req.subjectName,
            staffName: req.assignedTeacher,
            staffShortcode: req.assignedTeacher.slice(0, 6).toUpperCase(),
            roomNumber: req.type === 'Practical' ? 'LAB' : 'TBD',
            batch: 'ALL',
            activityType: 'Theory',
            additionalInfo: 'Auto-generated draft'
          });

          classSet.add(slotKey);
          teacherSet.add(slotKey);
          incrementDailyLoad(classDailyLoad, classKey, day, 1);
          incrementDailyLoad(teacherDailyLoad, req.assignedTeacher, day, 1);
          usedDays.add(day);
          remaining -= 1;
          placed = true;
          break;
        }
        if (placed) break;
      }

      if (!placed) {
        warnings.push(`No free slot found for theory ${req.subjectName} (${req.year}-${req.division}).`);
        break;
      }
    }
  };

  const placePractical = (req) => {
    const classKey = createClassKey(req.year, req.division);
    ensureClassEntry(classKey);
    ensureTeacher(req.assignedTeacher);

    const classSet = classOccupancy.get(classKey);
    const teacherSet = teacherOccupancy.get(req.assignedTeacher);

    let remainingSlots = req.weeklyFrequency;
    if (remainingSlots % 2 !== 0) {
      warnings.push(`Practical ${req.subjectName} for ${req.year} has odd frequency ${remainingSlots}; rounded up to next 90-minute block.`);
      remainingSlots += 1;
    }

    const blocksNeeded = remainingSlots / 2;
    let blocksPlaced = 0;

    while (blocksPlaced < blocksNeeded) {
      const candidateDays = DAYS
        .sort((a, b) => {
          const classLoadA = getDailyLoad(classDailyLoad, classKey, a);
          const classLoadB = getDailyLoad(classDailyLoad, classKey, b);
          const teacherLoadA = getDailyLoad(teacherDailyLoad, req.assignedTeacher, a);
          const teacherLoadB = getDailyLoad(teacherDailyLoad, req.assignedTeacher, b);
          return (classLoadA + teacherLoadA) - (classLoadB + teacherLoadB);
        });

      let placed = false;
      for (const day of candidateDays) {
        const lectureSlots = lectureSlotsForDay(slotsByDay, day);
        for (let i = 0; i < lectureSlots.length - 1; i += 1) {
          const first = lectureSlots[i];
          const second = lectureSlots[i + 1];

          if (Number(second.lectureIndex) !== Number(first.lectureIndex) + 1) continue;

          const firstKey = keyForSlot(day, first.lectureIndex);
          const secondKey = keyForSlot(day, second.lectureIndex);

          if (classSet.has(firstKey) || classSet.has(secondKey) || teacherSet.has(firstKey) || teacherSet.has(secondKey)) {
            continue;
          }

          const blockId = new mongoose.Types.ObjectId().toString();
          [first, second].forEach((slotPart, blockIndex) => {
            entriesByClass.get(classKey).push({
              dayOfWeek: day,
              timeSlotId: slotPart._id,
              subjectCode: req.subjectName.slice(0, 6).toUpperCase(),
              subjectName: req.subjectName,
              staffName: req.assignedTeacher,
              staffShortcode: req.assignedTeacher.slice(0, 6).toUpperCase(),
              roomNumber: 'LAB',
              batch: 'ALL',
              activityType: 'Lab',
              additionalInfo: `Auto-generated practical block ${blockId} part ${blockIndex + 1}`
            });
          });

          classSet.add(firstKey);
          classSet.add(secondKey);
          teacherSet.add(firstKey);
          teacherSet.add(secondKey);
          incrementDailyLoad(classDailyLoad, classKey, day, 2);
          incrementDailyLoad(teacherDailyLoad, req.assignedTeacher, day, 2);
          blocksPlaced += 1;
          placed = true;
          break;
        }

        if (placed) break;
      }

      if (!placed) {
        warnings.push(`No consecutive lab block found for practical ${req.subjectName} (${req.year}-${req.division}).`);
        break;
      }
    }
  };

  const requirementsSorted = normalizedRequirements
    .slice()
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'Practical' ? -1 : 1;
      return b.weeklyFrequency - a.weeklyFrequency;
    });

  requirementsSorted.forEach((req) => {
    if (req.type === 'Practical') {
      placePractical(req);
    } else {
      placeTheory(req);
    }
  });

  const classKeys = Array.from(entriesByClass.keys()).sort();

  const drafts = classKeys.map((classKey) => {
    const { year, division } = splitClassKey(classKey);

    return {
    classKey,
    year,
    division,
    timetable: {
      academicYear: academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      semester: semester || 'SEMESTER-I',
      className: `${year} Year - Division ${division}`,
      division,
      effectiveFrom: new Date().toISOString(),
      classTeacher: '',
      classroom: '',
      timeSlots,
      entries: entriesByClass.get(classKey) || [],
      parseWarnings: [],
      validationWarnings: [],
      isPublished: false,
      isActive: false
    }
  };
  });

  const loadSummary = {
    teachers: Array.from(teacherDailyLoad.entries()).map(([teacher, daily]) => {
      const dailyLoads = DAYS.reduce((acc, day) => {
        acc[day] = Number(daily.get(day) || 0);
        return acc;
      }, {});
      return {
        teacher,
        weeklyTotal: DAYS.reduce((sum, day) => sum + Number(daily.get(day) || 0), 0),
        daily: dailyLoads
      };
    }).sort((a, b) => b.weeklyTotal - a.weeklyTotal),
    classes: Array.from(classDailyLoad.entries()).map(([classKey, daily]) => {
      const dailyLoads = DAYS.reduce((acc, day) => {
        acc[day] = Number(daily.get(day) || 0);
        return acc;
      }, {});
      const details = splitClassKey(classKey);
      return {
        classKey,
        year: details.year,
        division: details.division,
        weeklyTotal: DAYS.reduce((sum, day) => sum + Number(daily.get(day) || 0), 0),
        daily: dailyLoads
      };
    })
  };

  return {
    config: {
      days: DAYS,
      windowStart: toTime(START_MINUTES),
      windowEnd: toTime(END_MINUTES),
      slotDurationMinutes: SLOT_DURATION,
      break: { startTime: toTime(LUNCH_START), endTime: toTime(LUNCH_END) }
    },
    rows,
    drafts,
    loadSummary,
    warnings
  };
};

module.exports = {
  DAYS,
  generateTimeSlots,
  generateDynamicTimetableDraft
};
