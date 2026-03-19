import React, { useMemo, useState } from 'react';
import './DynamicTimetableDraftGrid.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const DynamicTimetableDraftGrid = ({ timetable, entries, onEntriesChange }) => {
  const [dragIndex, setDragIndex] = useState(null);

  const slotRows = useMemo(() => {
    const seen = new Map();
    (timetable?.timeSlots || []).forEach((slot) => {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (!seen.has(key)) {
        seen.set(key, {
          key,
          startTime: slot.startTime,
          endTime: slot.endTime,
          locked: Boolean(slot.locked) || String(slot.slotType || '').toLowerCase() === 'break'
        });
      }
    });

    return Array.from(seen.values()).sort((a, b) => (a.startTime > b.startTime ? 1 : -1));
  }, [timetable]);

  const slotByDayAndRange = useMemo(() => {
    const map = new Map();
    (timetable?.timeSlots || []).forEach((slot) => {
      const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      map.set(key, slot);
    });
    return map;
  }, [timetable]);

  const entryLookup = useMemo(() => {
    const map = new Map();

    entries.forEach((entry, idx) => {
      const slot = (timetable?.timeSlots || []).find((timeSlot) => String(timeSlot._id) === String(entry.timeSlotId));
      if (!slot) return;

      const key = `${entry.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...entry, _draftIndex: idx });
    });

    return map;
  }, [entries, timetable]);

  const moveEntryToCell = (entryIndex, targetDay, row) => {
    const targetSlot = slotByDayAndRange.get(`${targetDay}-${row.startTime}-${row.endTime}`);
    if (!targetSlot || row.locked) return;

    onEntriesChange((prev) => {
      return prev.map((entry, idx) => {
        if (idx !== entryIndex) return entry;
        return {
          ...entry,
          dayOfWeek: targetDay,
          timeSlotId: targetSlot._id
        };
      });
    });
  };

  return (
    <div className="dynamic-draft-grid">
      <div className="table-responsive">
        <table className="table draft-grid-table">
          <thead>
            <tr>
              <th>Time</th>
              {DAYS.map((day) => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slotRows.map((row) => (
              <tr key={row.key} className={row.locked ? 'locked-row' : ''}>
                <td className="time-cell">{row.startTime} - {row.endTime}</td>
                {DAYS.map((day) => {
                  const cellKey = `${day}-${row.startTime}-${row.endTime}`;
                  const cellEntries = entryLookup.get(cellKey) || [];

                  return (
                    <td
                      key={cellKey}
                      className={row.locked ? 'locked-cell' : 'draft-cell'}
                      onDragOver={(e) => {
                        if (!row.locked) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (row.locked || dragIndex === null) return;
                        moveEntryToCell(dragIndex, day, row);
                        setDragIndex(null);
                      }}
                    >
                      {row.locked ? (
                        <div className="break-chip">Locked Break</div>
                      ) : cellEntries.length === 0 ? (
                        <div className="empty-chip">Drop subject here</div>
                      ) : (
                        <div className="chip-list">
                          {cellEntries.map((item) => (
                            <div
                              key={`${cellKey}-${item._draftIndex}`}
                              draggable
                              onDragStart={() => setDragIndex(item._draftIndex)}
                              className="subject-chip"
                              title="Drag to move this subject"
                            >
                              <div className="chip-title">{item.subjectName || item.subjectCode || 'Subject'}</div>
                              <div className="chip-meta">{item.staffName || item.staffShortcode || 'Teacher'}</div>
                              <div className="chip-meta">{item.activityType || 'Theory'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DynamicTimetableDraftGrid;
