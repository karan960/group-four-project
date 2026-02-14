import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import './FacultyDashboard.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Profile Dropdown Component
const ProfileDropdown = () => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="profile-dropdown">
      <div 
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="profile-avatar">
          {user?.username?.charAt(0).toUpperCase()}
        </div>
      </div>

      {isOpen && (
        <div className="profile-menu">
          <div className="profile-header">
            <div className="profile-avatar large">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="profile-info">
              <h4>{user?.username}</h4>
              <p className="role-badge faculty">Faculty</p>
              <p>ID: {user?.referenceId}</p>
            </div>
          </div>
          
          <div className="profile-actions">
            <button className="profile-btn">
              👤 View Profile
            </button>
            <button className="profile-btn">
              ⚙️ Settings
            </button>
            <button onClick={logout} className="profile-btn logout">
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [facultyData, setFacultyData] = useState(null);
  const [teachingData, setTeachingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    code: '',
    description: '',
    year: '',
    branch: '',
    division: '',
    semester: '',
    file: null
  });
  const [assignmentForm, setAssignmentForm] = useState({
    courseId: '',
    title: '',
    description: '',
    dueDate: '',
    totalMarks: '',
    file: null
  });
  const [submissions, setSubmissions] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/notifications/unread/count', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        setUnreadCount(response.data.unreadCount || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchFacultyData();
  }, []);

  useEffect(() => {
    if (activeTab === 'Courses') {
      fetchCourses();
    }
    if (activeTab === 'Assignments') {
      fetchCourses();
      fetchAssignments();
    }
  }, [activeTab]);

  const fetchFacultyData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch faculty profile
      const facultyResponse = await axios.get('http://localhost:5000/api/faculty', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Find current faculty
      const currentFaculty = facultyResponse.data.find(
        faculty => faculty.facultyId === user.referenceId
      );

      if (currentFaculty) {
        setFacultyData(currentFaculty);
      }

      // Mock teaching data
      setTeachingData({
        subjects: [
          { 
            name: 'Data Structures', 
            year: 'Second', 
            students: 60,
            assignments: 3,
            attendance: 87
          },
          { 
            name: 'Algorithms', 
            year: 'Third', 
            students: 55,
            assignments: 2,
            attendance: 92
          },
          { 
            name: 'Database Systems', 
            year: 'Third', 
            students: 58,
            assignments: 4,
            attendance: 85
          },
          { 
            name: 'Theory of Computation', 
            year: 'Fourth', 
            students: 45,
            assignments: 1,
            attendance: 90
          }
        ],
        totalStudents: 218,
        averageAttendance: 88.5
      });

    } catch (error) {
      console.error('Error fetching faculty data:', error);
      // Fallback to mock data
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/courses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCourses(response.data.courses || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setCoursesLoading(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      setAssignmentsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAssignments(response.data.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    try {
      if (!courseForm.file) {
        console.error('Course PDF is required');
        return;
      }
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('title', courseForm.title);
      formData.append('code', courseForm.code);
      formData.append('description', courseForm.description || '');
      formData.append('year', courseForm.year);
      formData.append('branch', courseForm.branch);
      formData.append('division', courseForm.division);
      formData.append('semester', courseForm.semester || '');
      if (courseForm.file) {
        formData.append('file', courseForm.file);
      }

      const response = await axios.post('http://localhost:5000/api/courses', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setCourseForm({ title: '', code: '', description: '', year: '', branch: '', division: '', semester: '', file: null });
      setCourses((prev) => [response.data.course, ...prev]);
    } catch (error) {
      console.error('Error creating course:', error);
    }
  };

  const handleCreateAssignment = async () => {
    try {
      if (!assignmentForm.file) {
        console.error('Assignment PDF is required');
        return;
      }
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('courseId', assignmentForm.courseId);
      formData.append('title', assignmentForm.title);
      formData.append('description', assignmentForm.description || '');
      formData.append('dueDate', assignmentForm.dueDate);
      formData.append('totalMarks', assignmentForm.totalMarks || '');
      if (assignmentForm.file) {
        formData.append('file', assignmentForm.file);
      }

      const response = await axios.post('http://localhost:5000/api/assignments', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setAssignmentForm({ courseId: '', title: '', description: '', dueDate: '', totalMarks: '', file: null });
      setAssignments((prev) => [response.data.assignment, ...prev]);
    } catch (error) {
      console.error('Error creating assignment:', error);
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    try {
      setSelectedAssignmentId(assignmentId);
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/assignments/${assignmentId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const setMockData = () => {
    setFacultyData({
      facultyId: user?.referenceId || 'FAC2023001',
      facultyName: 'Dr. Sunil Kumar',
      email: user?.username ? `${user.username}@college.edu` : 'sunil.kumar@college.edu',
      mobileNo: '9876543210',
      department: 'Computer Science',
      designation: 'Professor'
    });

    setTeachingData({
      subjects: [
        { 
          name: 'Data Structures', 
          year: 'Second', 
          students: 60,
          assignments: 3,
          attendance: 87
        },
        { 
          name: 'Algorithms', 
          year: 'Third', 
          students: 55,
          assignments: 2,
          attendance: 92
        }
      ],
      totalStudents: 115,
      averageAttendance: 89.5
    });
  };

  // Chart data
  // Read CSS variables so charts follow theme colors
  const getVar = (name, fallback) => {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    } catch (e) {
      return fallback;
    }
  };

  const hexToRgb = (hex) => {
    if (!hex) return '52, 152, 219';
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
  };

  const primary = getVar('--primary', '#3498db');
  const success = getVar('--success', '#27ae60');
  const warning = getVar('--warning', '#f39c12');
  const cardBg = getVar('--card-bg', '#fff');

  const subjectData = {
    labels: teachingData?.subjects.map(s => s.name) || [],
    datasets: [
      {
        label: 'Number of Students',
        data: teachingData?.subjects.map(s => s.students) || [],
        backgroundColor: [
          primary, success, primary, warning
        ],
        borderWidth: 2,
        borderColor: cardBg
      }
    ]
  };

  const attendanceData = {
    labels: teachingData?.subjects.map(s => s.name) || [],
    datasets: [
      {
        label: 'Attendance %',
        data: teachingData?.subjects.map(s => s.attendance) || [],
        borderColor: success,
        backgroundColor: `rgba(${hexToRgb(success)}, 0.12)`,
        tension: 0.4,
        fill: true
      }
    ]
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="faculty-dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🎓</div>
            <div className="logo-text">
              <h2>Campus Connect</h2>
              <p>Faculty Portal</p>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav" aria-label="Faculty navigation">
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('Dashboard')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Dashboard')}
          >📊 Dashboard</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Subjects' ? 'active' : ''}`}
            onClick={() => setActiveTab('Subjects')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Subjects')}
          >📚 My Subjects</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Courses' ? 'active' : ''}`}
            onClick={() => setActiveTab('Courses')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Courses')}
          >📘 Courses</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Assignments' ? 'active' : ''}`}
            onClick={() => setActiveTab('Assignments')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Assignments')}
          >📝 Assignments</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'MarkAttendance' ? 'active' : ''}`}
            onClick={() => setActiveTab('MarkAttendance')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('MarkAttendance')}
          >📝 Mark Attendance</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'EnterMarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('EnterMarks')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('EnterMarks')}
          >📋 Enter Marks</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Students' ? 'active' : ''}`}
            onClick={() => setActiveTab('Students')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Students')}
          >👥 Students</a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Timetable' ? 'active' : ''}`}
            onClick={() => setActiveTab('Timetable')}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTab('Timetable')}
          >📅 Timetable</a>
        </nav>
        
        <div className="sidebar-footer">
          <div className="sidebar-stats">
            <div className="stat">
              <span className="stat-number">{teachingData?.subjects.length || 0}</span>
              <span className="stat-label">Subjects</span>
            </div>
            <div className="stat">
              <span className="stat-number">{teachingData?.totalStudents || 0}</span>
              <span className="stat-label">Students</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="main-header">
          <div className="header-left">
            <h1>Faculty Dashboard</h1>
            <p>Welcome back, {facultyData?.facultyName || user?.username}!</p>
          </div>
          <div className="header-right">
            <div className="header-actions">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn btn-primary"
                style={{ position: 'relative' }}
              >
                🔔 Notifications
                {unreadCount > 0 && (
                  <span 
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: '#e74c3c',
                      color: 'white',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigate('/')}
                className="btn btn-secondary"
              >
                🏠 Home
              </button>
              <ProfileDropdown />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {activeTab === 'Dashboard' ? (
            <>
              {/* Faculty Profile Card */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">👤 Faculty Profile</h2>
                </div>
                <div className="card-body">
                  {facultyData && (
                    <div className="profile-grid">
                      <div className="profile-item">
                        <label>Name:</label>
                        <span>{facultyData.facultyName}</span>
                      </div>
                      <div className="profile-item">
                        <label>Faculty ID:</label>
                        <span>{facultyData.facultyId}</span>
                      </div>
                      <div className="profile-item">
                        <label>Designation:</label>
                        <span>{facultyData.designation}</span>
                      </div>
                      <div className="profile-item">
                        <label>Department:</label>
                        <span>{facultyData.department}</span>
                      </div>
                      <div className="profile-item">
                        <label>Email:</label>
                        <span>{facultyData.email}</span>
                      </div>
                      <div className="profile-item">
                        <label>Mobile:</label>
                        <span>{facultyData.mobileNo}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Statistics Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">📚</div>
                  <div className="stat-info">
                    <h3>{teachingData?.subjects.length || 0}</h3>
                    <p>Teaching Subjects</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">👥</div>
                  <div className="stat-info">
                    <h3>{teachingData?.totalStudents || 0}</h3>
                    <p>Total Students</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-info">
                    <h3>{teachingData?.averageAttendance || 0}%</h3>
                    <p>Avg Attendance</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📝</div>
                  <div className="stat-info">
                    <h3>{teachingData?.subjects.reduce((sum, subject) => sum + subject.assignments, 0) || 0}</h3>
                    <p>Assignments</p>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="charts-grid">
                <div className="chart-card">
                  <h3>Students per Subject</h3>
                  <div className="chart-container">
                    <Bar 
                      data={subjectData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="chart-card">
                  <h3>Subject-wise Attendance</h3>
                  <div className="chart-container">
                    <Line 
                      data={attendanceData}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: {
                            display: false
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Teaching Subjects */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">📚 Teaching Subjects</h2>
                </div>
                <div className="card-body">
                  <div className="subjects-grid">
                    {teachingData?.subjects.map((subject, index) => (
                      <div key={index} className="subject-card">
                        <div className="subject-header">
                          <h3>{subject.name}</h3>
                          <span className={`year-badge ${subject.year.toLowerCase()}`}>
                            {subject.year} Year
                          </span>
                        </div>
                        <div className="subject-stats">
                          <div className="subject-stat">
                            <span className="stat-label">Students</span>
                            <span className="stat-value">{subject.students}</span>
                          </div>
                          <div className="subject-stat">
                            <span className="stat-label">Attendance</span>
                            <span className="stat-value">{subject.attendance}%</span>
                          </div>
                          <div className="subject-stat">
                            <span className="stat-label">Assignments</span>
                            <span className="stat-value">{subject.assignments}</span>
                          </div>
                        </div>
                        <div className="subject-actions">
                          <button className="btn btn-primary">Mark Attendance</button>
                          <button className="btn btn-success">Enter Marks</button>
                          <button className="btn btn-warning">View Students</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions-section">
                <h3>Quick Actions</h3>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn">
                    <span className="action-icon">📝</span>
                    <span>Mark Today's Attendance</span>
                  </button>
                  <button className="quick-action-btn">
                    <span className="action-icon">📋</span>
                    <span>Enter Exam Marks</span>
                  </button>
                  <button className="quick-action-btn">
                    <span className="action-icon">👥</span>
                    <span>Student Performance</span>
                  </button>
                  <button className="quick-action-btn">
                    <span className="action-icon">📊</span>
                    <span>Generate Reports</span>
                  </button>
                </div>
              </div>

              {/* Recent Activities */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">🕒 Recent Activities</h2>
                </div>
                <div className="card-body">
                  <div className="activities-list">
                    <div className="activity-item">
                      <div className="activity-icon">✅</div>
                      <div className="activity-content">
                        <p>Marked attendance for Data Structures - 15 Jan 2024</p>
                        <span className="activity-time">2 hours ago</span>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-icon">📝</div>
                      <div className="activity-content">
                        <p>Uploaded assignment for Algorithms</p>
                        <span className="activity-time">1 day ago</span>
                      </div>
                    </div>
                    <div className="activity-item">
                      <div className="activity-icon">👥</div>
                      <div className="activity-content">
                        <p>Conducted extra class for Database Systems</p>
                        <span className="activity-time">2 days ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">{activeTab}</h2>
                </div>
                <div className="card-body">
                  <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                    Quick placeholder for <strong>{activeTab}</strong>. Replace with real components or forms when available.
                  </p>

                  {activeTab === 'Subjects' && (
                    <div className="subjects-grid">
                      {teachingData?.subjects.map((s, i) => (
                        <div key={i} className="subject-card">
                          <h4>{s.name}</h4>
                          <p className="stat-label">Year: {s.year}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'Courses' && (
                    <div>
                      <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">Create Course</h2>
                        </div>
                        <div className="card-body">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Title *</label>
                              <input
                                className="form-control"
                                value={courseForm.title}
                                onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Code *</label>
                              <input
                                className="form-control"
                                value={courseForm.code}
                                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Year *</label>
                              <input
                                className="form-control"
                                value={courseForm.year}
                                onChange={(e) => setCourseForm({ ...courseForm, year: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Branch *</label>
                              <input
                                className="form-control"
                                value={courseForm.branch}
                                onChange={(e) => setCourseForm({ ...courseForm, branch: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Division *</label>
                              <input
                                className="form-control"
                                value={courseForm.division}
                                onChange={(e) => setCourseForm({ ...courseForm, division: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Semester</label>
                              <input
                                type="number"
                                className="form-control"
                                value={courseForm.semester}
                                onChange={(e) => setCourseForm({ ...courseForm, semester: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Description</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              value={courseForm.description}
                              onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Course PDF *</label>
                            <input
                              type="file"
                              className="form-control"
                              accept="application/pdf"
                              onChange={(e) => setCourseForm({ ...courseForm, file: e.target.files?.[0] || null })}
                            />
                          </div>
                          <button className="btn btn-primary" onClick={handleCreateCourse}>
                            Create Course
                          </button>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-header">
                          <h2 className="card-title">My Courses</h2>
                        </div>
                        <div className="card-body">
                          {coursesLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                              <div className="spinner"></div>
                            </div>
                          ) : courses.length === 0 ? (
                            <p style={{ color: 'var(--muted)' }}>No courses yet.</p>
                          ) : (
                            <div className="subjects-grid">
                              {courses.map((course) => (
                                <div key={course._id} className="subject-card">
                                  <h4>{course.title}</h4>
                                  <p className="stat-label">Code: {course.code}</p>
                                  <p className="stat-label">{course.year} | {course.branch} | {course.division}</p>
                                  {course.attachmentUrl && (
                                    <a
                                      href={`http://localhost:5000${course.attachmentUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="stat-label"
                                    >
                                      📄 View Course PDF
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Assignments' && (
                    <div>
                      <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">Create Assignment</h2>
                        </div>
                        <div className="card-body">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Course *</label>
                              <select
                                className="form-control"
                                value={assignmentForm.courseId}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, courseId: e.target.value })}
                              >
                                <option value="">Select course</option>
                                {courses.map((course) => (
                                  <option key={course._id} value={course._id}>
                                    {course.title} ({course.code})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Title *</label>
                              <input
                                className="form-control"
                                value={assignmentForm.title}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Due Date *</label>
                              <input
                                type="datetime-local"
                                className="form-control"
                                value={assignmentForm.dueDate}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                              />
                            </div>
                            <div className="form-group">
                              <label>Total Marks</label>
                              <input
                                type="number"
                                className="form-control"
                                value={assignmentForm.totalMarks}
                                onChange={(e) => setAssignmentForm({ ...assignmentForm, totalMarks: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Description</label>
                            <textarea
                              className="form-control"
                              rows="3"
                              value={assignmentForm.description}
                              onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label>Assignment PDF *</label>
                            <input
                              type="file"
                              className="form-control"
                              accept="application/pdf"
                              onChange={(e) => setAssignmentForm({ ...assignmentForm, file: e.target.files?.[0] || null })}
                            />
                          </div>
                          <button className="btn btn-primary" onClick={handleCreateAssignment}>
                            Create Assignment
                          </button>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-header">
                          <h2 className="card-title">My Assignments</h2>
                        </div>
                        <div className="card-body">
                          {assignmentsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                              <div className="spinner"></div>
                            </div>
                          ) : assignments.length === 0 ? (
                            <p style={{ color: 'var(--muted)' }}>No assignments yet.</p>
                          ) : (
                            <div className="predictions-grid">
                              {assignments.map((assignment) => (
                                <div key={assignment._id} className="prediction-card" style={{ textAlign: 'left' }}>
                                  <h4>{assignment.title}</h4>
                                  <p className="confidence-label">Due: {new Date(assignment.dueDate).toLocaleString()}</p>
                                  <p className="confidence-label">Submissions: {assignment.submissionCount || 0}</p>
                                  {assignment.attachmentUrl && (
                                    <a
                                      href={`http://localhost:5000${assignment.attachmentUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="confidence-label"
                                    >
                                      📄 View Assignment PDF
                                    </a>
                                  )}
                                  <button
                                    className="btn btn-secondary"
                                    style={{ marginTop: '0.5rem' }}
                                    onClick={() => fetchSubmissions(assignment._id)}
                                  >
                                    View Submissions
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {selectedAssignmentId && (
                            <div style={{ marginTop: '1.5rem' }}>
                              <h3>Submissions</h3>
                              {submissions.length === 0 ? (
                                <p style={{ color: 'var(--muted)' }}>No submissions yet.</p>
                              ) : (
                                <div className="notification-list">
                                  {submissions.map((sub) => (
                                    <div key={sub._id} className="notification-item">
                                      <div className="notification-body">
                                        <div className="notification-title">{sub.student?.name || sub.student?.prn}</div>
                                        <div className="notification-message">{sub.submissionText || 'No message provided.'}</div>
                                        {sub.fileUrl && (
                                          <div className="notification-meta">
                                            <a href={`http://localhost:5000${sub.fileUrl}`} target="_blank" rel="noreferrer">Download File</a>
                                          </div>
                                        )}
                                      </div>
                                      <div className="notification-meta">
                                        {new Date(sub.submittedAt).toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'MarkAttendance' && (
                    <div>
                      <p className="confidence-label">Select the subject and mark today's attendance.</p>
                      <button className="btn btn-primary">Start Attendance</button>
                    </div>
                  )}

                  {activeTab === 'EnterMarks' && (
                    <div>
                      <p className="confidence-label">Enter marks for students (placeholder).</p>
                      <button className="btn btn-success">Open Marks Entry</button>
                    </div>
                  )}

                  {activeTab === 'Students' && (
                    <div>
                      <div className="prediction-card">
                        <h4>Student list placeholder</h4>
                        <p className="confidence-label">Shows students for selected subject</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Timetable' && (
                    <div>
                      <p className="confidence-label">Mon: Data Structures - 10:00 AM</p>
                      <p className="confidence-label">Wed: Database Systems - 1:00 PM</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notification Center Modal */}
      {showNotifications && (
        <NotificationCenter 
          onClose={() => {
            setShowNotifications(false);
            // Refresh unread count after closing
            const fetchUnreadCount = async () => {
              try {
                const response = await axios.get('http://localhost:5000/api/notifications/unread/count', {
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setUnreadCount(response.data.unreadCount || 0);
              } catch (error) {
                console.error('Error fetching unread count:', error);
              }
            };
            fetchUnreadCount();
          }}
          onNotificationRead={() => {
            // Refresh unread count when a notification is marked as read
            const fetchUnreadCount = async () => {
              try {
                const response = await axios.get('http://localhost:5000/api/notifications/unread/count', {
                  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                setUnreadCount(response.data.unreadCount || 0);
              } catch (error) {
                console.error('Error fetching unread count:', error);
              }
            };
            fetchUnreadCount();
          }}
        />
      )}
    </div>
  );
};

export default FacultyDashboard;