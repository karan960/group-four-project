import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { FaUpload, FaShareAlt, FaSave, FaTrash, FaFileDownload, FaExclamationTriangle } from 'react-icons/fa';
import TimetableBoard from '../components/TimetableBoard';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const localStorage = window.sessionStorage;

const EMPTY_META = {
  academicYear: '',
  semester: '',
  className: '',
  division: '',
  effectiveFrom: '',
  classTeacher: '',
  classroom: ''
};

const AdminTimetableManager = () => {
  const [meta, setMeta] = useState(EMPTY_META);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [timetable, setTimetable] = useState(null);
  const [entries, setEntries] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek > b.dayOfWeek ? 1 : -1;
      }
      return String(a.timeSlotId) > String(b.timeSlotId) ? 1 : -1;
    });
  }, [entries]);

  const onUpload = async () => {
    if (!file) {
      setStatus('Please choose an Excel file first.');
      return;
    }

    try {
      setLoading(true);
      setStatus('Uploading and parsing timetable...');
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(meta).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      const response = await axios.post(`${API_BASE_URL}/api/admin/upload-timetable`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data.preview;
      setTimetable(data);
      setEntries(data.entries || []);
      setWarnings(response.data.warnings || data.validationWarnings || []);
      setStatus('Timetable parsed successfully. You can now edit and publish.');
    } catch (error) {
      setStatus(
        error.response?.data?.error
          ? `${error.response?.data?.message}: ${error.response?.data?.error}`
          : (error.response?.data?.message || 'Upload failed')
      );
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    if (!timetable?._id) return;

    try {
      setSaveLoading(true);
      setStatus('Saving timetable...');
      const token = localStorage.getItem('token');

      const response = await axios.put(
        `${API_BASE_URL}/api/admin/timetable/${timetable._id}`,
        {
          ...timetable,
          entries
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTimetable(response.data.timetable);
      setEntries(response.data.timetable.entries || []);
      setWarnings(response.data.warnings || []);
      setStatus('Timetable updated successfully.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  };

  const onPublish = async () => {
    if (!timetable?._id) return;

    try {
      setPublishLoading(true);
      setStatus('Publishing timetable...');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/api/admin/publish/${timetable._id}`,
        { setActive: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setTimetable(response.data.timetable);
      setWarnings(response.data.warnings || []);
      setStatus('Timetable published and shared with students/faculty.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Publish failed');
    } finally {
      setPublishLoading(false);
    }
  };

  const onDelete = async () => {
    if (!timetable?._id) return;
    if (!window.confirm('Delete this timetable draft/version?')) return;

    try {
      setDeleteLoading(true);
      setStatus('Deleting timetable...');
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/admin/timetable/${timetable._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTimetable(null);
      setEntries([]);
      setWarnings([]);
      setStatus('Timetable deleted successfully.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const updateEntry = (index, field, value) => {
    setEntries((prev) => prev.map((entry, idx) => {
      if (idx !== index) return entry;
      return { ...entry, [field]: value };
    }));
  };

  const downloadTemplate = () => {
    const csv = [
      ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      ['09:00-10:00', '', '', '', '', ''],
      ['10:00-11:00', '', '', '', '', ''],
      ['11:00-12:00', '', '', '', '', '']
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'timetable-template.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="section-header">
        <h1>◉ Timetable Management</h1>
        <p>Upload Excel, preview, edit, validate conflicts, and publish to faculty/students.</p>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h2 className="card-title">Upload Timetable</h2>
        </div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Academic Year</label>
              <input className="form-control" value={meta.academicYear} onChange={(e) => setMeta({ ...meta, academicYear: e.target.value })} placeholder="2026-2027" />
            </div>
            <div className="form-group">
              <label className="form-label">Semester</label>
              <input className="form-control" value={meta.semester} onChange={(e) => setMeta({ ...meta, semester: e.target.value })} placeholder="SEMESTER-I" />
            </div>
            <div className="form-group">
              <label className="form-label">Class Name</label>
              <input className="form-control" value={meta.className} onChange={(e) => setMeta({ ...meta, className: e.target.value })} placeholder="FINAL YEAR (DIV-I)" />
            </div>
            <div className="form-group">
              <label className="form-label">Division</label>
              <input className="form-control" value={meta.division} onChange={(e) => setMeta({ ...meta, division: e.target.value })} placeholder="I / A" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Effective From</label>
              <input type="date" className="form-control" value={meta.effectiveFrom} onChange={(e) => setMeta({ ...meta, effectiveFrom: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Class Teacher</label>
              <input className="form-control" value={meta.classTeacher} onChange={(e) => setMeta({ ...meta, classTeacher: e.target.value })} placeholder="Prof. Name" />
            </div>
            <div className="form-group">
              <label className="form-label">Classroom</label>
              <input className="form-control" value={meta.classroom} onChange={(e) => setMeta({ ...meta, classroom: e.target.value })} placeholder="46" />
            </div>
            <div className="form-group">
              <label className="form-label">Timetable File (.xlsx/.xls/.csv)</label>
              <input type="file" className="form-control" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={downloadTemplate}>
              <FaFileDownload /> Template
            </button>
            <button className="btn btn-primary" onClick={onUpload} disabled={loading}>
              <FaUpload /> {loading ? 'Uploading...' : 'Upload & Parse'}
            </button>
            <button className="btn btn-success" onClick={onSave} disabled={!timetable || saveLoading}>
              <FaSave /> {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
            <button className="btn btn-warning" onClick={onPublish} disabled={!timetable || publishLoading}>
              <FaShareAlt /> {publishLoading ? 'Publishing...' : 'Publish & Share'}
            </button>
            <button className="btn btn-danger" onClick={onDelete} disabled={!timetable || deleteLoading}>
              <FaTrash /> {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          </div>

          {status && (
            <div className="alert alert-info" style={{ marginTop: '1rem' }}>{status}</div>
          )}
        </div>
      </div>

      {!!warnings.length && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">
            <h2 className="card-title"><FaExclamationTriangle /> Validation Warnings</h2>
          </div>
          <div className="card-body">
            <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {timetable && (
        <>
          <TimetableBoard
            timetable={timetable}
            entries={entries}
            title="Timetable Preview"
            subtitle="Parsed from Excel (editable below)"
          />

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">
              <h2 className="card-title">Editable Entries</h2>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Day</th>
                      <th>Subject</th>
                      <th>Staff Code</th>
                      <th>Room</th>
                      <th>Batch</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry, index) => (
                      <tr key={`${entry.timeSlotId}-${index}`}>
                        <td>{entry.dayOfWeek}</td>
                        <td>
                          <input
                            className="form-control"
                            value={entry.subjectName || ''}
                            onChange={(e) => updateEntry(index, 'subjectName', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            value={entry.staffShortcode || ''}
                            onChange={(e) => updateEntry(index, 'staffShortcode', e.target.value.toUpperCase())}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            value={entry.roomNumber || ''}
                            onChange={(e) => updateEntry(index, 'roomNumber', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            value={entry.batch || 'ALL'}
                            onChange={(e) => updateEntry(index, 'batch', e.target.value.toUpperCase())}
                          />
                        </td>
                        <td>
                          <select
                            className="form-control"
                            value={entry.activityType || 'Theory'}
                            onChange={(e) => updateEntry(index, 'activityType', e.target.value)}
                          >
                            <option value="Theory">Theory</option>
                            <option value="Lab">Lab</option>
                            <option value="Project">Project</option>
                            <option value="Tutorial">Tutorial</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminTimetableManager;
