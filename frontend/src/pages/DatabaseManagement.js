import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import './AdminDashboard.css';

const DatabaseManagement = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [marksData, setMarksData] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
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
        
        // Flatten marks data from all students
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
        
        // Flatten attendance data from all students
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
        return students.filter(s => 
          s.studentName?.toLowerCase().includes(term) ||
          s.prn?.toLowerCase().includes(term) ||
          s.rollNo?.toString().includes(term)
        );
      case 'faculty':
        return faculty.filter(f => 
          f.facultyName?.toLowerCase().includes(term) ||
          f.facultyId?.toLowerCase().includes(term) ||
          f.email?.toLowerCase().includes(term)
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
          return value;
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
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="9" className="no-data">No students found</td>
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
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="no-data">No faculty found</td>
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

  return (
    <div className="admin-section">
      <div className="section-header">
        <h2>📊 Database Management - Data Display</h2>
        <p>View and manage all system data</p>
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
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-control search-input"
          />

          <button onClick={exportToCSV} className="btn btn-info">
            📥 Export to CSV
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
      </div>

      {loading ? (
        <div className="loading">Loading data...</div>
      ) : (
        <div className="data-display-section">
          {activeTab === 'students' && <StudentTable data={filteredData} />}
          {activeTab === 'faculty' && <FacultyTable data={filteredData} />}
          {activeTab === 'marks' && <MarksTable data={filteredData} />}
          {activeTab === 'attendance' && <AttendanceTable data={filteredData} />}
        </div>
      )}
    </div>
  );
};

export default DatabaseManagement;
