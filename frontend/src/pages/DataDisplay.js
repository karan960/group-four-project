import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const localStorage = window.sessionStorage;

const DataDisplay = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [marksData, setMarksData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [pageNumber, setPageNumber] = useState(1);
  const itemsPerPage = 120;

  // CRUD States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [crudMessage, setCrudMessage] = useState('');

  useEffect(() => {
    setSearchTerm('');
    setSelectedYear('All');
    setPageNumber(1);
    fetchAllData();
  }, [activeTab]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    setPageNumber(1);
    try {
      const token = localStorage.getItem('token');
      
      if (activeTab === 'students') {
        const response = await axios.get('http://localhost:5000/api/students?limit=10000', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataArray = response.data.students || [];
        setStudents(dataArray);
      } else if (activeTab === 'faculty') {
        const response = await axios.get('http://localhost:5000/api/faculty?limit=10000', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataArray = response.data.faculty || [];
        setFaculty(dataArray);
      } else if (activeTab === 'marks') {
        const response = await axios.get('http://localhost:5000/api/students?limit=10000', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataArray = response.data.students || [];
        
        const allMarks = [];
        dataArray.forEach(student => {
          if (student.semesterMarks && Array.isArray(student.semesterMarks)) {
            student.semesterMarks.forEach(semester => {
              if (semester.subjects && Array.isArray(semester.subjects)) {
                semester.subjects.forEach(subject => {
                  allMarks.push({
                    prn: student.prn,
                    studentName: student.studentName,
                    rollNo: student.rollNo,
                    semester: semester.semester,
                    sgpa: semester.sgpa,
                    ...subject
                  });
                });
              }
            });
          }
        });
        setMarksData(allMarks);
      } else if (activeTab === 'attendance') {
        const response = await axios.get('http://localhost:5000/api/students?limit=10000', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const dataArray = response.data.students || [];
        
        const allAttendance = [];
        dataArray.forEach(student => {
          if (student.attendance && Array.isArray(student.attendance)) {
            student.attendance.forEach(attendanceEntry => {
              if (attendanceEntry.subjects && Array.isArray(attendanceEntry.subjects)) {
                attendanceEntry.subjects.forEach(subject => {
                  allAttendance.push({
                    prn: student.prn,
                    studentName: student.studentName,
                    rollNo: student.rollNo,
                    month: attendanceEntry.month,
                    year: attendanceEntry.year,
                    overall: attendanceEntry.overall,
                    ...subject
                  });
                });
              }
            });
          }
        });
        setAttendanceData(allAttendance);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredData = () => {
    const term = searchTerm.toLowerCase();
    
    switch(activeTab) {
      case 'students':
        return students.filter(s => {
          const matchesSearch = s.studentName?.toLowerCase().includes(term) ||
            s.prn?.toLowerCase().includes(term) ||
            s.rollNo?.toString().includes(term) ||
            s.email?.toLowerCase().includes(term);
          const matchesYear = selectedYear === 'All' || s.year === selectedYear;
          return matchesSearch && matchesYear;
        });
      case 'faculty':
        return faculty.filter(f => 
          f.facultyName?.toLowerCase().includes(term) ||
          f.facultyId?.toLowerCase().includes(term) ||
          f.email?.toLowerCase().includes(term) ||
          f.department?.toLowerCase().includes(term)
        );
      case 'marks':
        return marksData.filter(m => 
          m.studentName?.toLowerCase().includes(term) ||
          m.prn?.toLowerCase().includes(term) ||
          m.subjectName?.toLowerCase().includes(term)
        );
      case 'attendance':
        return attendanceData.filter(a => 
          a.studentName?.toLowerCase().includes(term) ||
          a.prn?.toLowerCase().includes(term) ||
          a.subjectName?.toLowerCase().includes(term)
        );
      default:
        return [];
    }
  };

  const getPaginatedData = () => {
    const filtered = getFilteredData();
    const startIndex = (pageNumber - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredData().length / itemsPerPage);
  };

  const exportToCSV = () => {
    const data = getFilteredData();
    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return `"${value}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}_data_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // CRUD Operations
  const handleEdit = (record) => {
    setEditingRecord(record);
    setEditForm({ ...record });
    setShowEditModal(true);
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Are you sure you want to delete this ${activeTab === 'students' ? 'student' : 'faculty'} record?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const id = activeTab === 'students' ? record.prn : record.facultyId;
      const endpoint = activeTab === 'students' 
        ? `/api/students/${id}` 
        : `/api/faculty/${id}`;
      
      await axios.delete(`http://localhost:5000${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setCrudMessage('✅ Record deleted successfully!');
      setTimeout(() => setCrudMessage(''), 3000);
      fetchAllData();
    } catch (error) {
      setCrudMessage('❌ Error deleting record: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddNew = () => {
    setEditingRecord(null);
    if (activeTab === 'students') {
      setEditForm({
        prn: '',
        rollNo: '',
        studentName: '',
        year: 'First',
        branch: '',
        division: '',
        email: '',
        mobileNo: ''
      });
    } else {
      setEditForm({
        facultyId: '',
        facultyName: '',
        email: '',
        mobileNo: '',
        department: '',
        designation: ''
      });
    }
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const id = activeTab === 'students' ? editForm.prn : editForm.facultyId;
      const endpoint = activeTab === 'students' 
        ? `/api/students/${id}` 
        : `/api/faculty/${id}`;
      
      await axios.put(`http://localhost:5000${endpoint}`, editForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setCrudMessage('✅ Record updated successfully!');
      setTimeout(() => setCrudMessage(''), 3000);
      setShowEditModal(false);
      fetchAllData();
    } catch (error) {
      setCrudMessage('❌ Error updating record: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'students' ? '/api/students' : '/api/faculty';
      
      await axios.post(`http://localhost:5000${endpoint}`, editForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setCrudMessage('✅ Record created successfully!');
      setTimeout(() => setCrudMessage(''), 3000);
      setShowEditModal(false);
      fetchAllData();
    } catch (error) {
      setCrudMessage('❌ Error creating record: ' + (error.response?.data?.message || error.message));
    }
  };

  const StudentTable = ({ data }) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>PRN</th>
            <th>Roll No</th>
            <th>Student Name</th>
            <th>Email</th>
            <th>Year</th>
            <th>Branch</th>
            <th>Division</th>
            <th>CGPA</th>
            <th>Attendance</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map(student => (
              <tr key={student._id}>
                <td>{student.prn}</td>
                <td>{student.rollNo}</td>
                <td>{student.studentName}</td>
                <td>{student.email}</td>
                <td>{student.year}</td>
                <td>{student.branch}</td>
                <td>{student.division}</td>
                <td>{student.cgpa?.toFixed(2) || 'N/A'}</td>
                <td>{student.overallAttendance?.toFixed(2) || 'N/A'}%</td>
                <td>
                  <button className="btn-small btn-edit" onClick={() => handleEdit(student)}>Edit</button>
                  <button className="btn-small btn-delete" onClick={() => handleDelete(student)}>Delete</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="10" className="no-data">No students found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const FacultyTable = ({ data }) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>Faculty ID</th>
            <th>Faculty Name</th>
            <th>Email</th>
            <th>Mobile No</th>
            <th>Department</th>
            <th>Designation</th>
            <th>Qualification</th>
            <th>Experience</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map(faculty => (
              <tr key={faculty._id}>
                <td>{faculty.facultyId}</td>
                <td>{faculty.facultyName}</td>
                <td>{faculty.email}</td>
                <td>{faculty.mobileNo}</td>
                <td>{faculty.department}</td>
                <td>{faculty.designation}</td>
                <td>{faculty.qualification}</td>
                <td>{faculty.experience}</td>
                <td>
                  <button className="btn-small btn-edit" onClick={() => handleEdit(faculty)}>Edit</button>
                  <button className="btn-small btn-delete" onClick={() => handleDelete(faculty)}>Delete</button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="no-data">No faculty found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const MarksTable = ({ data }) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>PRN</th>
            <th>Student Name</th>
            <th>Semester</th>
            <th>Subject Name</th>
            <th>Internal Marks</th>
            <th>External Marks</th>
            <th>Total Marks</th>
            <th>Grade</th>
            <th>SGPA</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((mark, idx) => (
              <tr key={idx}>
                <td>{mark.prn}</td>
                <td>{mark.studentName}</td>
                <td>{mark.semester}</td>
                <td>{mark.subjectName || 'N/A'}</td>
                <td>{mark.internalMarks || 0}</td>
                <td>{mark.externalMarks || 0}</td>
                <td>{mark.totalMarks || 0}</td>
                <td>{mark.grade || 'N/A'}</td>
                <td>{mark.sgpa?.toFixed(2) || 'N/A'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="no-data">No marks data found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const AttendanceTable = ({ data }) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th>PRN</th>
            <th>Student Name</th>
            <th>Month</th>
            <th>Year</th>
            <th>Subject Name</th>
            <th>Total Classes</th>
            <th>Attended Classes</th>
            <th>Attendance %</th>
            <th>Overall %</th>
          </tr>
        </thead>
        <tbody>
          {data.length > 0 ? (
            data.map((att, idx) => (
              <tr key={idx}>
                <td>{att.prn}</td>
                <td>{att.studentName}</td>
                <td>{att.month}</td>
                <td>{att.year}</td>
                <td>{att.subjectName || 'N/A'}</td>
                <td>{att.totalClasses || 0}</td>
                <td>{att.attendedClasses || 0}</td>
                <td>{att.percentage?.toFixed(2) || 'N/A'}%</td>
                <td>{att.overall?.toFixed(2) || 'N/A'}%</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="no-data">No attendance data found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const filteredData = getFilteredData();
  const paginatedData = getPaginatedData();
  const totalPages = getTotalPages();

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>📊 View Data</h2>
        <p>Browse and search all system data</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="data-management-controls">
        <div className="controls-group">
          <select
            value={activeTab}
            onChange={(e) => {
              setActiveTab(e.target.value);
              setSearchTerm('');
            }}
            className="form-control"
          >
            <option value="students">🎓 Students Data</option>
            <option value="faculty">👨‍🏫 Faculty Data</option>
            <option value="marks">📈 Marks Data</option>
            <option value="attendance">✅ Attendance Data</option>
          </select>

          <input
            type="text"
            placeholder={`🔍 Search by name, PRN, email...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control search-input"
          />

          {activeTab === 'students' && (
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="form-control"
              style={{ minWidth: '150px' }}
            >
              <option value="All">All Years</option>
              <option value="First">First Year</option>
              <option value="Second">Second Year</option>
              <option value="Third">Third Year</option>
              <option value="Fourth">Fourth Year</option>
            </select>
          )}

          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedYear('All');
              setPageNumber(1);
            }}
            className="btn btn-secondary"
          >
            Clear Filters
          </button>

          <button onClick={exportToCSV} className="btn btn-info">
            📥 Export CSV
          </button>

          <button onClick={fetchAllData} className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="data-stats">
        <div className="stat-card">
          <span className="stat-label">Total Records</span>
          <span className="stat-value">{filteredData.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Page</span>
          <span className="stat-value">{pageNumber} of {totalPages || 1}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Showing</span>
          <span className="stat-value">{Math.min(itemsPerPage, paginatedData.length)}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <>
          <div className="data-display-section">
            {(activeTab === 'students' || activeTab === 'faculty') && (
              <button className="btn btn-primary" onClick={handleAddNew} style={{ marginBottom: '20px' }}>
                + Add New {activeTab === 'students' ? 'Student' : 'Faculty'}
              </button>
            )}
            {crudMessage && <div className="message" style={{ padding: '10px', marginBottom: '15px', backgroundColor: crudMessage.includes('✅') ? '#d4edda' : '#f8d7da', color: crudMessage.includes('✅') ? '#155724' : '#721c24', borderRadius: '4px' }}>{crudMessage}</div>}
            {activeTab === 'students' && <StudentTable data={paginatedData} />}
            {activeTab === 'faculty' && <FacultyTable data={paginatedData} />}
            {activeTab === 'marks' && <MarksTable data={paginatedData} />}
            {activeTab === 'attendance' && <AttendanceTable data={paginatedData} />}
          </div>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
                disabled={pageNumber === 1}
                className="btn btn-secondary"
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {pageNumber} of {totalPages}
              </span>
              <button 
                onClick={() => setPageNumber(Math.min(totalPages, pageNumber + 1))}
                disabled={pageNumber === totalPages}
                className="btn btn-secondary"
              >
                Next →
              </button>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && (
            <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>{editingRecord ? `Edit ${activeTab === 'students' ? 'Student' : 'Faculty'}` : `Add New ${activeTab === 'students' ? 'Student' : 'Faculty'}`}</h3>
                <form>
                  {activeTab === 'students' ? (
                    <>
                      <div className="form-group">
                        <label>PRN</label>
                        <input
                          type="text"
                          value={editForm.prn || ''}
                          onChange={(e) => setEditForm({ ...editForm, prn: e.target.value })}
                          disabled={editingRecord !== null}
                        />
                      </div>
                      <div className="form-group">
                        <label>Roll No</label>
                        <input
                          type="text"
                          value={editForm.rollNo || ''}
                          onChange={(e) => setEditForm({ ...editForm, rollNo: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Student Name</label>
                        <input
                          type="text"
                          value={editForm.studentName || ''}
                          onChange={(e) => setEditForm({ ...editForm, studentName: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Year</label>
                        <select value={editForm.year || ''} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}>
                          <option value="First">First</option>
                          <option value="Second">Second</option>
                          <option value="Third">Third</option>
                          <option value="Fourth">Fourth</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Branch</label>
                        <input
                          type="text"
                          value={editForm.branch || ''}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Division</label>
                        <input
                          type="text"
                          value={editForm.division || ''}
                          onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Mobile No</label>
                        <input
                          type="tel"
                          value={editForm.mobileNo || ''}
                          onChange={(e) => setEditForm({ ...editForm, mobileNo: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label>Faculty ID</label>
                        <input
                          type="text"
                          value={editForm.facultyId || ''}
                          onChange={(e) => setEditForm({ ...editForm, facultyId: e.target.value })}
                          disabled={editingRecord !== null}
                        />
                      </div>
                      <div className="form-group">
                        <label>Faculty Name</label>
                        <input
                          type="text"
                          value={editForm.facultyName || ''}
                          onChange={(e) => setEditForm({ ...editForm, facultyName: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Email</label>
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Mobile No</label>
                        <input
                          type="tel"
                          value={editForm.mobileNo || ''}
                          onChange={(e) => setEditForm({ ...editForm, mobileNo: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Department</label>
                        <input
                          type="text"
                          value={editForm.department || ''}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Designation</label>
                        <input
                          type="text"
                          value={editForm.designation || ''}
                          onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                  <div className="form-actions">
                    <button type="button" className="btn btn-primary" onClick={editingRecord ? handleUpdate : handleCreate}>
                      {editingRecord ? 'Update' : 'Create'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DataDisplay;
