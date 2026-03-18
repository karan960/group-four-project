import React, { useMemo } from 'react';
import { FaPrint, FaDownload } from 'react-icons/fa';
import './TimetableBoard.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const TimetableBoard = ({
  timetable,
  entries = [],
  title = 'Weekly Timetable',
  subtitle = '',
  allowPrint = true,
  allowExport = true
}) => {
  const timeSlotMap = useMemo(() => {
    const map = new Map();
    (timetable?.timeSlots || []).forEach((slot) => {
      map.set(String(slot._id), slot);
    });
    return map;
  }, [timetable]);

  const slotRows = useMemo(() => {
    const unique = new Map();
    (timetable?.timeSlots || []).forEach((slot) => {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (!unique.has(key)) {
        unique.set(key, {
          key,
          startTime: slot.startTime,
          endTime: slot.endTime
        });
      }
    });

    return Array.from(unique.values()).sort((a, b) =>
      a.startTime > b.startTime ? 1 : -1
    );
  }, [timetable]);

  const cellEntries = useMemo(() => {
    const map = new Map();

    entries.forEach((entry) => {
      const slot = timeSlotMap.get(String(entry.timeSlotId));
      if (!slot) return;
      const key = `${entry.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(entry);
    });

    return map;
  }, [entries, timeSlotMap]);

  const handleExportCsv = () => {
    if (!slotRows.length) return;

    const rows = [];
    rows.push(['Time', ...DAYS]);

    slotRows.forEach((slotRow) => {
      const row = [`${slotRow.startTime}-${slotRow.endTime}`];
      DAYS.forEach((day) => {
        const key = `${day}-${slotRow.startTime}-${slotRow.endTime}`;
        const entriesForCell = cellEntries.get(key) || [];
        const text = entriesForCell
          .map((entry) => [entry.subjectName || entry.subjectCode || 'Class', entry.staffShortcode || entry.staffName || '', entry.roomNumber ? `Room ${entry.roomNumber}` : '']
            .filter(Boolean)
            .join(' | '))
          .join(' || ');
        row.push(text);
      });
      rows.push(row);
    });

    const csv = rows
      .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `timetable-${(timetable?.className || 'schedule').replace(/\s+/g, '-')}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  if (!timetable) {
    return (
      <div className="card timetable-card">
        <div className="card-body">
          <p className="timetable-muted">No active timetable available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card timetable-card">
      <div className="card-header timetable-header">
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="timetable-subtitle">
            {subtitle || `${timetable.className} • ${timetable.semester} • ${timetable.academicYear}`}
          </p>
        </div>
        <div className="timetable-actions">
          {allowExport && (
            <button className="btn btn-secondary" onClick={handleExportCsv}>
              <FaDownload /> Download CSV
            </button>
          )}
          {allowPrint && (
            <button className="btn btn-primary" onClick={() => window.print()}>
              <FaPrint /> Print
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        <div className="timetable-meta-grid">
          <span><strong>Class:</strong> {timetable.className}</span>
          <span><strong>Division:</strong> {timetable.division || 'N/A'}</span>
          <span><strong>Teacher:</strong> {timetable.classTeacher || 'N/A'}</span>
          <span><strong>Room:</strong> {timetable.classroom || 'N/A'}</span>
        </div>

        <div className="table-responsive timetable-table-wrap">
          <table className="table timetable-table">
            <thead>
              <tr>
                <th>Time</th>
                {DAYS.map((day) => (
                  <th key={day}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slotRows.map((slotRow) => (
                <tr key={slotRow.key}>
                  <td className="timetable-time-cell">{slotRow.startTime} - {slotRow.endTime}</td>
                  {DAYS.map((day) => {
                    const key = `${day}-${slotRow.startTime}-${slotRow.endTime}`;
                    const list = cellEntries.get(key) || [];

                    return (
                      <td key={key}>
                        {list.length === 0 ? (
                          <span className="timetable-muted">-</span>
                        ) : (
                          <div className="timetable-cell-list">
                            {list.map((item, idx) => (
                              <div key={`${key}-${idx}`} className="timetable-entry-chip">
                                <div className="entry-main">{item.subjectName || item.subjectCode || 'Class'}</div>
                                <div className="entry-meta">
                                  {(item.staffShortcode || item.staffName || 'TBA')}
                                  {item.roomNumber ? ` • Room ${item.roomNumber}` : ''}
                                  {item.batch && item.batch !== 'ALL' ? ` • Batch ${item.batch}` : ''}
                                </div>
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
    </div>
  );
};

export default TimetableBoard;
