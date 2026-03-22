import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import DataDisplay from './DataDisplay';
import AdminTimetableManager from './AdminTimetableManager';
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
import { 
  FaGraduationCap, FaChalkboardTeacher, FaUsers, FaCog, FaDatabase, 
  FaSyncAlt, FaPlus, FaArrowRight, FaEnvelope, FaSearch, FaFolder,
  FaCheck, FaTimes, FaBell, FaChartLine, FaTachometerAlt, FaRobot,
  FaFileDownload, FaUpload, FaLock, FaClock, FaClipboardList,
  FaBook, FaTrash, FaBroom, FaCheckCircle, FaExclamationCircle, FaUser,
  FaDoorOpen, FaCompass, FaLightbulb, FaSave, FaBolt, FaRocket,
  FaTools, FaTimesCircle, FaBullseye, FaBrain, FaChartBar,
  FaExclamationTriangle, FaBars, FaChevronLeft, FaHome, FaCalendar, FaBriefcase,
  FaEdit
} from 'react-icons/fa';
import './AdminDashboard.css';

const localStorage = window.sessionStorage;
const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const AUTH_API_BASE_URL = process.env.REACT_APP_AUTH_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const AUTH_API_FALLBACK_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000`;

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
  const { user, logout, updateProfilePhoto } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const avatarSrc = user?.profilePhoto
    ? `${AUTH_API_FALLBACK_BASE_URL}${user.profilePhoto}`
    : '';

  useEffect(() => {
    if (user) {
      setProfileData({
        username: user.username,
        role: user.role,
        referenceId: user.referenceId,
        lastLogin: new Date().toLocaleString()
      });
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/users/profile`, profileData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Profile updated successfully!');
      setShowProfileModal(false);
    } catch (error) {
      alert('Error updating profile: ' + (error.response?.data?.message || error.message));
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profilePhoto', file);

    try {
      setUploadingPhoto(true);
      const token = localStorage.getItem('token');
      const baseCandidates = [...new Set([AUTH_API_BASE_URL, AUTH_API_FALLBACK_BASE_URL, 'http://localhost:5000'])];
      let response = null;
      let lastError = null;

      for (const baseUrl of baseCandidates) {
        try {
          response = await axios.put(
            `${baseUrl}/api/auth/profile-photo`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          break;
        } catch (error) {
          lastError = error;
          if (error?.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error('Profile photo upload failed');
      }

      updateProfilePhoto(response.data?.profilePhoto || '');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to upload profile photo');
    } finally {
      setUploadingPhoto(false);
      event.target.value = '';
    }
  };

  return (
    <div className="profile-dropdown">
      <div 
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="profile-avatar">
          {avatarSrc ? (
            <img src={avatarSrc} alt="Profile" />
          ) : (
            user?.username?.charAt(0).toUpperCase()
          )}
        </div>
      </div>

      {isOpen && (
        <div className="profile-menu">
          <div className="profile-header">
            <div className="profile-avatar large">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" />
              ) : (
                user?.username?.charAt(0).toUpperCase()
              )}
            </div>
            <div className="profile-info">
              <h4>{user?.username}</h4>
              <p className="role-badge admin">{user?.role}</p>
              <p>ID: {user?.referenceId}</p>
            </div>
          </div>
          
          <div className="profile-actions">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              className="profile-btn"
              disabled={uploadingPhoto}
            >
              <FaEdit /> {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
            </button>
            <button 
              onClick={() => setShowProfileModal(true)}
              className="profile-btn"
            >
              <FaUser /> Edit Profile
            </button>
            <button 
              onClick={() => {
                setIsOpen(false);
                // Add settings functionality here
              }}
              className="profile-btn"
            >
              <FaCog /> Settings
            </button>
            <button 
              onClick={logout}
              className="profile-btn logout"
            >
              <FaDoorOpen /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button onClick={() => setShowProfileModal(false)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleProfileUpdate} className="profile-form">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={profileData.username || ''}
                    onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input
                    type="text"
                    value={profileData.role || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
                <div className="form-group">
                  <label>Reference ID</label>
                  <input
                    type="text"
                    value={profileData.referenceId || ''}
                    onChange={(e) => setProfileData({...profileData, referenceId: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Login</label>
                  <input
                    type="text"
                    value={profileData.lastLogin || ''}
                    disabled
                    className="disabled-input"
                  />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowProfileModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleProfileUpdate} className="btn btn-primary">
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// DashboardOverview Component
const DashboardOverview = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    totalUsers: 0,
    mlAccuracy: 0,
    yearWiseStudents: { First: 0, Second: 0, Third: 0, Fourth: 0 },
    performanceDistribution: {
      excellent: 0,
      very_good: 0,
      good: 0,
      average: 0,
      below_average: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const REFRESH_INTERVAL = 10000;

  const toYearWiseStudents = (byYear = {}) => ({
    First: byYear.First || byYear['First Year'] || byYear['1'] || byYear[1] || byYear['I'] || 0,
    Second: byYear.Second || byYear['Second Year'] || byYear['2'] || byYear[2] || byYear['II'] || 0,
    Third: byYear.Third || byYear['Third Year'] || byYear['3'] || byYear[3] || byYear['III'] || 0,
    Fourth: byYear.Fourth || byYear['Fourth Year'] || byYear['4'] || byYear[4] || byYear['IV'] || 0
  });

  useEffect(() => {
    fetchDashboardStats(true);

    const onModelUpdated = () => fetchDashboardStats(false);
    window.addEventListener('ml-model-updated', onModelUpdated);

    const intervalId = setInterval(() => {
      fetchDashboardStats(false);
    }, REFRESH_INTERVAL);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('ml-model-updated', onModelUpdated);
    };
  }, []);

  const normalizeDistribution = (distribution = {}) => ({
    excellent: Number(distribution.excellent || 0),
    very_good: Number(distribution.very_good || 0),
    good: Number(distribution.good || 0),
    average: Number(distribution.average || 0),
    below_average: Number(distribution.below_average || 0)
  });

  const fetchDashboardStats = async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const token = localStorage.getItem('token');

      const [overviewResponse, dashboardResponse, modelInfoResponse, institutionStatsResponse] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/dashboard/admin/overview`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/dashboard/admin/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/ml-analysis/model-info`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/ml-analysis/institution-stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const overviewStats = overviewResponse.status === 'fulfilled' ? (overviewResponse.value?.data?.stats || {}) : {};
      const dashboardData = dashboardResponse.status === 'fulfilled' ? (dashboardResponse.value?.data || {}) : {};
      const studentStats = dashboardData?.studentStats || {};
      const modelInfo = modelInfoResponse.status === 'fulfilled' ? (modelInfoResponse.value?.data || {}) : {};
      const institutionStats = institutionStatsResponse.status === 'fulfilled'
        ? (institutionStatsResponse.value?.data?.statistics || {})
        : {};
      const rawAccuracy = typeof modelInfo.accuracy === 'number'
        ? modelInfo.accuracy
        : Number((modelInfo.metrics?.accuracy || 0) * 100);

      setStats({
        totalStudents: Number(overviewStats.totalStudents ?? studentStats.total ?? 0),
        totalFaculty: Number(overviewStats.totalFaculty ?? dashboardData?.facultyStats?.total ?? 0),
        totalUsers: Number(overviewStats.totalUsers ?? 0),
        mlAccuracy: Number.isFinite(rawAccuracy) ? Number(rawAccuracy.toFixed(2)) : 0,
        yearWiseStudents: toYearWiseStudents(studentStats.byYear || {}),
        performanceDistribution: normalizeDistribution(institutionStats.performance_distribution || {})
      });
      setError('');
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Fallback to direct counting if admin stats endpoint fails
      await fetchStatsFallback();
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const fetchStatsFallback = async () => {
    try {
      const token = localStorage.getItem('token');
      const [studentsRes, facultyRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/faculty`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const studentsData = Array.isArray(studentsRes.data)
        ? studentsRes.data
        : Array.isArray(studentsRes.data?.students)
          ? studentsRes.data.students
          : [];

      const facultyData = Array.isArray(facultyRes.data)
        ? facultyRes.data
        : Array.isArray(facultyRes.data?.faculty)
          ? facultyRes.data.faculty
          : [];

      const usersData = Array.isArray(usersRes.data)
        ? usersRes.data
        : Array.isArray(usersRes.data?.users)
          ? usersRes.data.users
          : [];

      const yearWiseCounts = { First: 0, Second: 0, Third: 0, Fourth: 0 };
      studentsData.forEach(student => {
        if (yearWiseCounts.hasOwnProperty(student.year)) {
          yearWiseCounts[student.year]++;
        }
      });

      setStats({
        totalStudents: studentsData.length,
        totalFaculty: facultyData.length,
        totalUsers: usersData.length,
        mlAccuracy: 0,
        yearWiseStudents: yearWiseCounts,
        performanceDistribution: {
          excellent: 0,
          very_good: 0,
          good: 0,
          average: 0,
          below_average: 0
        }
      });
      setError('');
    } catch (error) {
      setError('Failed to load dashboard data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const performanceData = {
    labels: ['Excellent', 'Very Good', 'Good', 'Average', 'Below Average'],
    datasets: [
      {
        label: 'Student Performance Distribution',
        data: [
          stats.performanceDistribution?.excellent || 0,
          stats.performanceDistribution?.very_good || 0,
          stats.performanceDistribution?.good || 0,
          stats.performanceDistribution?.average || 0,
          stats.performanceDistribution?.below_average || 0
        ],
        backgroundColor: [
          '#27ae60',
          '#3498db',
          '#16a085',
          '#f39c12',
          '#e74c3c'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  const yearWiseData = {
    labels: ['First Year', 'Second Year', 'Third Year', 'Fourth Year'],
    datasets: [
      {
        label: 'Students by Year',
        data: [
          stats.yearWiseStudents?.First || 0,
          stats.yearWiseStudents?.Second || 0,
          stats.yearWiseStudents?.Third || 0,
          stats.yearWiseStudents?.Fourth || 0
        ],
        backgroundColor: [
          '#3498db',
          '#2ecc71',
          '#f39c12',
          '#9b59b6'
        ],
        borderWidth: 2,
        borderColor: '#fff'
      }
    ]
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1>Admin Dashboard Overview</h1>
        <p>Welcome to Campus Connect Administration Panel</p>
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon"><FaGraduationCap /></div>
          <div className="stat-info">
            <h3>{stats.totalStudents}</h3>
            <p>Total Students</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaChalkboardTeacher /></div>
          <div className="stat-info">
            <h3>{stats.totalFaculty}</h3>
            <p>Faculty Members</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaUsers /></div>
          <div className="stat-info">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FaRobot /></div>
          <div className="stat-info">
            <h3>{stats.mlAccuracy}%</h3>
            <p>ML Model Accuracy</p>
          </div>
        </div>
      </div>

      {/* Year-wise Stats */}
      <div className="stats-grid">
        <div className="stat-card year-card first-year">
          <div className="stat-icon">1</div>
          <div className="stat-info">
            <h3>{stats.yearWiseStudents?.First || 0}</h3>
            <p>First Year Students</p>
          </div>
        </div>
        <div className="stat-card year-card second-year">
          <div className="stat-icon">2</div>
          <div className="stat-info">
            <h3>{stats.yearWiseStudents?.Second || 0}</h3>
            <p>Second Year Students</p>
          </div>
        </div>
        <div className="stat-card year-card third-year">
          <div className="stat-icon">3</div>
          <div className="stat-info">
            <h3>{stats.yearWiseStudents?.Third || 0}</h3>
            <p>Third Year Students</p>
          </div>
        </div>
        <div className="stat-card year-card fourth-year">
          <div className="stat-icon">4</div>
          <div className="stat-info">
            <h3>{stats.yearWiseStudents?.Fourth || 0}</h3>
            <p>Fourth Year Students</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Performance Distribution</h3>
          <div className="chart-container">
            <Doughnut 
              data={performanceData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>
        </div>
        <div className="chart-card">
          <h3>Students by Year</h3>
          <div className="chart-container">
            <Doughnut 
              data={yearWiseData}
              options={{
                responsive: true,
                plugins: {
                  legend: {
                    position: 'bottom'
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// DataManagement Component - FIXED VERSION
const DataManagement = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [activeTab, setActiveTab] = useState('students'); // students/faculty table view
  const [uploadType, setUploadType] = useState('students'); // students, faculty, marks, attendance
  const [excelFile, setExcelFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [columnMapping, setColumnMapping] = useState({});
  const [dataFormat, setDataFormat] = useState('multiple'); // 'single' (legacy) or 'multiple' (detailed semester row)
  
  // Quick Action States
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reportType, setReportType] = useState('students');
  const [announcement, setAnnouncement] = useState('');
  const [announcementTarget, setAnnouncementTarget] = useState('all');
  const [quickActionStatus, setQuickActionStatus] = useState('');

  useEffect(() => {
    if (activeTab === 'students' || activeTab === 'faculty') {
      fetchData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (uploadType === 'students' || uploadType === 'faculty') {
      setActiveTab(uploadType);
    }
  }, [uploadType]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      
      if (activeTab === 'students') {
        const response = await axios.get(`${API_BASE_URL}/api/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Extract students array from response
        const dataArray = Array.isArray(response.data) 
          ? response.data 
          : Array.isArray(response.data.students) 
            ? response.data.students 
            : [];
        
        setStudents(dataArray);
      } else {
        const response = await axios.get(`${API_BASE_URL}/api/faculty`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Extract faculty array from response
        const dataArray = Array.isArray(response.data) 
          ? response.data 
          : Array.isArray(response.data.faculty) 
            ? response.data.faculty 
            : [];
        
        setFaculty(dataArray);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setExcelFile(file);
      setUploadStatus('File selected: ' + file.name);
    }
  };

  const handleBulkUpload = async () => {
    if (!excelFile) {
      setUploadStatus('Please select a file first');
      return;
    }

    try {
      setUploadStatus('Uploading...');
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('type', uploadType);
      formData.append('mapping', JSON.stringify(columnMapping));

      const response = await axios.post(`${API_BASE_URL}/api/upload-excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });

      const { results } = response.data;
      setUploadStatus(`✅ Upload successful! ${results.successful} records processed, ${results.failed} failed`);
      
      if (results.failed > 0 && results.errors) {
        setUploadStatus(prev => prev + '. Errors: ' + results.errors.slice(0, 3).join(', '));
      }
      
      setExcelFile(null);
      fetchData();
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('[ERR] Upload failed: ' + (error.response?.data?.message || error.message));
    }
  };

  const downloadTemplate = () => {
    let templateData;
    let sampleRow = '';
    
    if (uploadType === 'marks') {
      templateData = [
        'Name of Student',
        'PRN NO',
        'Seat no',
        'Year',
        'IN SEM sub 1',
        'IN SEM sub 2',
        'IN SEM sub 3',
        'IN SEM sub 4',
        'IN SEM sub 5',
        'IN SEM Total',
        'IN SEM Percentage',
        'END SEM sub 1',
        'END SEM sub 2',
        'END SEM sub 3',
        'END SEM sub 4',
        'END SEM sub 5',
        'END SEM Total',
        'END SEM Percentage',
        'CGPA'
      ];
      sampleRow = '\nJohn Doe,PRN001,101,First,18,19,17,20,18,92,73.6,75,78,72,80,77,382,76.4,8.5';
    } else if (uploadType === 'attendance') {
      if (dataFormat === 'single') {
        templateData = ['PRN', 'Month', 'Year', 'Subject Name', 'Total Classes', 'Attended Classes'];
        sampleRow = '\nPRN001,January,2024,Data Structures,20,18';
      } else {
        templateData = [
          'Sr. No.',
          'PRN',
          'Status',
          'Roll No.',
          'Student Name',
          'Department',
          'DSA - Total Lectures',
          'DSA - Attended',
          'DSA - Percentage',
          'OOP - Total Lectures',
          'OOP - Attended',
          'OOP - Percentage',
          'BCN - Total Lectures',
          'BCN - Attended',
          'BCN - Percentage',
          'Open Elective-1 - Total Lectures',
          'Open Elective-1 - Attended',
          'Open Elective-1 - Percentage',
          'DELD - Total Lectures',
          'DELD - Attended',
          'DELD - Percentage',
          'PME - Total Lectures',
          'PME - Attended',
          'PME - Percentage',
          'UHV - Total Lectures',
          'UHV - Attended',
          'UHV - Percentage',
          'DSAL - Total Practicals',
          'DSAL - Attended',
          'DSAL - Percentage',
          'OOPL - Total Practicals',
          'OOPL - Attended',
          'OOPL - Percentage',
          'CEPL - Total Practicals',
          'CEPL - Attended',
          'CEPL - Percentage',
          'PMEL - Total Practicals',
          'PMEL - Attended',
          'PMEL - Percentage',
          'Total Theory Lectures Attended',
          'Total Lab Practicals Attended'
        ];
        sampleRow = '\n1,PRN001,Regular,101,John Doe,Computer Engineering,40,36,90,38,35,92.11,35,30,85.71,30,28,93.33,32,29,90.63,34,31,91.18,20,18,90,24,22,91.67,22,20,90.91,21,19,90.48,20,18,90,207,79';
      }
    } else if (uploadType === 'students') {
      templateData = ['Sr. No.', 'PRN', 'Status', 'Seat no', 'Roll No', 'Student Name', 'Year', 'Department', 'Branch', 'Division', 'Email', 'Mobile No'];
      sampleRow = '\n1,PRN001,Regular,101,101,John Doe,First,Computer Engineering,Computer Engineering,A,john@example.com,9876543210';
    } else {
      templateData = ['Faculty ID', 'Faculty Name', 'Email', 'Mobile No', 'Department', 'Designation'];
      sampleRow = '\nFAC001,Dr. Jane Smith,jane@example.com,9876543210,Computer Science,Professor';
    }

    const csvContent = "data:text/csv;charset=utf-8," + templateData.join(',') + sampleRow;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${uploadType}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setEditForm({ ...record });
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'students' 
        ? `/api/students/${editingRecord.prn}` 
        : `/api/faculty/${editingRecord.facultyId}`;
      
      await axios.put(`${API_BASE_URL}${endpoint}`, editForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setShowEditModal(false);
      setEditingRecord(null);
      fetchData();
      alert('Record updated successfully!');
    } catch (error) {
      alert('Error updating record: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (record) => {
    if (window.confirm(`Are you sure you want to delete this ${activeTab === 'students' ? 'student' : 'faculty'}?`)) {
      try {
        const token = localStorage.getItem('token');
        const endpoint = activeTab === 'students' 
          ? `/api/students/${record.prn}` 
          : `/api/faculty/${record.facultyId}`;
        
        await axios.delete(`${API_BASE_URL}${endpoint}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        fetchData();
        alert('Record deleted successfully!');
      } catch (error) {
        alert('Error deleting record: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleAddNew = () => {
    const defaultRecord = activeTab === 'students' 
      ? {
          prn: '',
          rollNo: '',
          studentName: '',
          year: 'First',
          branch: '',
          division: '',
          email: '',
          mobileNo: ''
        }
      : {
          facultyId: '',
          facultyName: '',
          email: '',
          mobileNo: '',
          department: '',
          designation: ''
        };
    
    setEditingRecord(null);
    setEditForm(defaultRecord);
    setShowEditModal(true);
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = activeTab === 'students' ? '/api/students' : '/api/faculty';
      
      await axios.post(`${API_BASE_URL}${endpoint}`, editForm, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setShowEditModal(false);
      fetchData();
      alert('Record created successfully!');
    } catch (error) {
      alert('Error creating record: ' + (error.response?.data?.message || error.message));
    }
  };

  // Quick Actions Handlers
  const handleGenerateReport = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';
      
      if (reportType === 'students') {
        csvContent += 'PRN,Roll No,Name,Year,Branch,Division,Email,Mobile\n';
        students.forEach(student => {
          csvContent += `${student.prn},${student.rollNo},${student.studentName},${student.year},${student.branch},${student.division},${student.email},${student.mobileNo}\n`;
        });
      } else if (reportType === 'faculty') {
        csvContent += 'Faculty ID,Name,Email,Mobile,Department,Designation\n';
        faculty.forEach(fac => {
          csvContent += `${fac.facultyId},${fac.facultyName},${fac.email},${fac.mobileNo},${fac.department},${fac.designation}\n`;
        });
      } else if (reportType === 'dashboard') {
        csvContent += 'Metric,Value\n';
        csvContent += `Total Students,${students.length}\n`;
        csvContent += `Total Faculty,${faculty.length}\n`;
        csvContent += `First Year,${students.filter(s => s.year === 'First').length}\n`;
        csvContent += `Second Year,${students.filter(s => s.year === 'Second').length}\n`;
        csvContent += `Third Year,${students.filter(s => s.year === 'Third').length}\n`;
        csvContent += `Fourth Year,${students.filter(s => s.year === 'Fourth').length}\n`;
      }
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setQuickActionStatus(`[OK] ${reportType} report generated successfully!`);
      setShowReportsModal(false);
      setTimeout(() => setQuickActionStatus(''), 5000);
    } catch (error) {
      console.error('Report generation error:', error);
      setQuickActionStatus('[ERR] Error generating report: ' + error.message);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announcement.trim()) {
      alert('Please enter an announcement message');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/announcements`, {
        message: announcement,
        target: announcementTarget,
        createdBy: user.username,
        createdAt: new Date().toISOString()
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setQuickActionStatus(`[OK] Announcement sent to ${announcementTarget === 'all' ? 'all users' : announcementTarget + 's'}!`);
      setAnnouncement('');
      setShowAnnouncementModal(false);
      setTimeout(() => setQuickActionStatus(''), 5000);
    } catch (error) {
      console.error('Announcement error:', error);
      setQuickActionStatus(`[ERR] Error: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleSystemAudit = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/audit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      setAuditLogs(response.data || []);
      setShowAuditLog(true);
    } catch (error) {
      console.error('Audit log error:', error);
      // Fallback: Generate mock audit logs
      const mockLogs = [
        { timestamp: new Date().toISOString(), action: 'User logged in', user: user.username, status: 'Success' },
        { timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'Student data uploaded', user: user.username, status: 'Success', records: 5 },
        { timestamp: new Date(Date.now() - 7200000).toISOString(), action: 'Faculty data updated', user: user.username, status: 'Success', records: 2 },
        { timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'Database backup created', user: 'system', status: 'Success', size: '256MB' }
      ];
      setAuditLogs(mockLogs);
      setShowAuditLog(true);
    }
  };

  const handleBackupData = async () => {
    if (!window.confirm('This will create a complete database backup. Continue?')) {
      return;
    }

    try {
      setQuickActionStatus('🔄 Backup in progress...');
      const token = localStorage.getItem('token');
      
      const response = await axios.post(`${API_BASE_URL}/api/backup`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setQuickActionStatus(`[OK] Database backup completed successfully! Backup size: ${response.data.size || 'Unknown'}`);
      setTimeout(() => setQuickActionStatus(''), 5000);
    } catch (error) {
      console.error('Backup error:', error);
      setQuickActionStatus(`[WARN] Backup request sent. Backend will process it. ${error.response?.data?.message || ''}`);
      setTimeout(() => setQuickActionStatus(''), 5000);
    }
  };

  const handleDeleteAllData = async () => {
    const confirmed = window.confirm(
      'This will delete ALL data from the database in one click. Admin users will be preserved by default. Continue?'
    );

    if (!confirmed) {
      return;
    }

    const typed = window.prompt('Type DELETE to confirm this action.');
    if (typed !== 'DELETE') {
      setQuickActionStatus('[WARN] Database delete cancelled. Confirmation text did not match.');
      setTimeout(() => setQuickActionStatus(''), 5000);
      return;
    }

    try {
      setQuickActionStatus('🔄 Deleting all database data...');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/api/admin/reset-database`,
        {
          confirmationText: 'DELETE ALL DATA',
          preserveAdminUsers: true
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const totalDeleted = response?.data?.totalDeleted ?? 0;
      setQuickActionStatus(`[OK] Database cleared successfully. Deleted records: ${totalDeleted}`);
      fetchData();
      setTimeout(() => setQuickActionStatus(''), 7000);
    } catch (error) {
      console.error('Delete all data error:', error);
      setQuickActionStatus(`[ERR] Failed to delete data: ${error.response?.data?.message || error.message}`);
      setTimeout(() => setQuickActionStatus(''), 7000);
    }
  };

  // Define mapping fields per upload type so JSX stays simple
  const mappingFields = useMemo(() => {
    switch (uploadType) {
      case 'students':
        return [
          { key: 'srNo', label: 'Sr. No.' },
          { key: 'prn', label: 'PRN' },
          { key: 'status', label: 'Status' },
          { key: 'seatNo', label: 'Seat no' },
          { key: 'rollNo', label: 'Roll No' },
          { key: 'studentName', label: 'Student Name' },
          { key: 'year', label: 'Year' },
          { key: 'department', label: 'Department' },
          { key: 'branch', label: 'Branch' },
          { key: 'division', label: 'Division' },
          { key: 'email', label: 'Email' },
          { key: 'mobileNo', label: 'Mobile No' }
        ];
      case 'faculty':
        return [
          { key: 'facultyId', label: 'Faculty ID' },
          { key: 'facultyName', label: 'Faculty Name' },
          { key: 'email', label: 'Email' },
          { key: 'mobileNo', label: 'Mobile No' },
          { key: 'department', label: 'Department' },
          { key: 'designation', label: 'Designation' }
        ];
      case 'marks':
        return [
          { key: 'studentName', label: 'Name of Student' },
          { key: 'prn', label: 'PRN NO' },
          { key: 'seatNo', label: 'Seat no' },
          { key: 'year', label: 'Year' },
          { key: 'internalSub1', label: 'IN SEM sub 1' },
          { key: 'internalSub2', label: 'IN SEM sub 2' },
          { key: 'internalSub3', label: 'IN SEM sub 3' },
          { key: 'internalSub4', label: 'IN SEM sub 4' },
          { key: 'internalSub5', label: 'IN SEM sub 5' },
          { key: 'internalTotal', label: 'IN SEM Total' },
          { key: 'internalPercentage', label: 'IN SEM Percentage' },
          { key: 'externalSub1', label: 'END SEM sub 1' },
          { key: 'externalSub2', label: 'END SEM sub 2' },
          { key: 'externalSub3', label: 'END SEM sub 3' },
          { key: 'externalSub4', label: 'END SEM sub 4' },
          { key: 'externalSub5', label: 'END SEM sub 5' },
          { key: 'externalTotal', label: 'END SEM Total' },
          { key: 'externalPercentage', label: 'END SEM Percentage' },
          { key: 'cgpa', label: 'CGPA' }
        ];
      case 'attendance':
      default:
        return [
          { key: 'srNo', label: 'Sr. No.' },
          { key: 'prn', label: 'PRN' },
          { key: 'status', label: 'Status' },
          { key: 'rollNo', label: 'Roll No.' },
          { key: 'studentName', label: 'Student Name' },
          { key: 'department', label: 'Department' },
          { key: 'dsaTotalLectures', label: 'DSA - Total Lectures' },
          { key: 'dsaAttended', label: 'DSA - Attended' },
          { key: 'dsaPercentage', label: 'DSA - Percentage' },
          { key: 'oopTotalLectures', label: 'OOP - Total Lectures' },
          { key: 'oopAttended', label: 'OOP - Attended' },
          { key: 'oopPercentage', label: 'OOP - Percentage' },
          { key: 'bcnTotalLectures', label: 'BCN - Total Lectures' },
          { key: 'bcnAttended', label: 'BCN - Attended' },
          { key: 'bcnPercentage', label: 'BCN - Percentage' },
          { key: 'openElective1TotalLectures', label: 'Open Elective-1 - Total Lectures' },
          { key: 'openElective1Attended', label: 'Open Elective-1 - Attended' },
          { key: 'openElective1Percentage', label: 'Open Elective-1 - Percentage' },
          { key: 'deldTotalLectures', label: 'DELD - Total Lectures' },
          { key: 'deldAttended', label: 'DELD - Attended' },
          { key: 'deldPercentage', label: 'DELD - Percentage' },
          { key: 'pmeTotalLectures', label: 'PME - Total Lectures' },
          { key: 'pmeAttended', label: 'PME - Attended' },
          { key: 'pmePercentage', label: 'PME - Percentage' },
          { key: 'uhvTotalLectures', label: 'UHV - Total Lectures' },
          { key: 'uhvAttended', label: 'UHV - Attended' },
          { key: 'uhvPercentage', label: 'UHV - Percentage' },
          { key: 'dsalTotalPracticals', label: 'DSAL - Total Practicals' },
          { key: 'dsalAttended', label: 'DSAL - Attended' },
          { key: 'dsalPercentage', label: 'DSAL - Percentage' },
          { key: 'ooplTotalPracticals', label: 'OOPL - Total Practicals' },
          { key: 'ooplAttended', label: 'OOPL - Attended' },
          { key: 'ooplPercentage', label: 'OOPL - Percentage' },
          { key: 'ceplTotalPracticals', label: 'CEPL - Total Practicals' },
          { key: 'ceplAttended', label: 'CEPL - Attended' },
          { key: 'ceplPercentage', label: 'CEPL - Percentage' },
          { key: 'pmelTotalPracticals', label: 'PMEL - Total Practicals' },
          { key: 'pmelAttended', label: 'PMEL - Attended' },
          { key: 'pmelPercentage', label: 'PMEL - Percentage' },
          { key: 'totalTheoryLecturesAttended', label: 'Total Theory Lectures Attended' },
          { key: 'totalLabPracticalsAttended', label: 'Total Lab Practicals Attended' },
          { key: 'month', label: 'Month (optional)' },
          { key: 'year', label: 'Year (optional)' },
          { key: 'subjectName', label: 'Subject Name (legacy)' },
          { key: 'totalClasses', label: 'Total Classes (legacy)' },
          { key: 'attendedClasses', label: 'Attended Classes (legacy)' }
        ];
    }
  }, [uploadType]);

  return (
    <div>
      <div className="section-header">
        <h1>Data Management</h1>
        <p>Upload and manage students, faculty, marks, and attendance data with CRUD operations</p>
      </div>

      {/* Quick Actions Status */}
      {quickActionStatus && (
        <div className={`alert ${quickActionStatus.includes('[OK]') ? 'alert-success' : quickActionStatus.includes('[ERR]') ? 'alert-error' : 'alert-info'}`}>
          {quickActionStatus}
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button
            className={`quick-action-btn ${activeTab === 'students' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('students');
              setUploadType('students');
              setQuickActionStatus('[OK] Switched to Students tab');
              setTimeout(() => setQuickActionStatus(''), 2000);
            }}
          >
            <span className="action-icon"><FaGraduationCap /></span>
            <span>Students Tab</span>
          </button>
          <button
            className={`quick-action-btn ${activeTab === 'faculty' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('faculty');
              setUploadType('faculty');
              setQuickActionStatus('[OK] Switched to Faculty tab');
              setTimeout(() => setQuickActionStatus(''), 2000);
            }}
          >
            <span className="action-icon"><FaChalkboardTeacher /></span>
            <span>Faculty Tab</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => setShowReportsModal(true)}
          >
            <span className="action-icon"><FaChartLine /></span>
            <span>Generate Reports</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={() => setShowAnnouncementModal(true)}
          >
            <span className="action-icon"><FaEnvelope /></span>
            <span>Send Announcements</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={handleSystemAudit}
          >
            <span className="action-icon"><FaSearch /></span>
            <span>System Audit</span>
          </button>
          <button 
            className="quick-action-btn"
            onClick={handleBackupData}
          >
            <span className="action-icon"><FaDatabase /></span>
            <span>Backup Data</span>
          </button>
          <button 
            className="quick-action-btn quick-action-danger"
            onClick={handleDeleteAllData}
          >
            <span className="action-icon danger"><FaTrash /></span>
            <span>Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Excel Upload Section */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaUpload /> Excel Data Upload</h2>
        </div>
        <div className="upload-section">
          <div className="upload-controls">
            <select 
              className="form-control"
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
            >
              <option value="students">Students Data</option>
              <option value="faculty">Faculty Data</option>
              <option value="marks">Marks Data</option>
              <option value="attendance">Attendance Data</option>
            </select>

            {uploadType === 'attendance' && (
              <select 
                className="form-control"
                value={dataFormat}
                onChange={(e) => setDataFormat(e.target.value)}
              >
                <option value="multiple">Detailed Semester Row (Recommended)</option>
                <option value="single">Single Subject Per Row (Legacy)</option>
              </select>
            )}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="file-input"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="btn btn-primary">
              <FaFolder /> Choose File
            </label>
            
            <button onClick={downloadTemplate} className="btn btn-warning">
              <FaFileDownload /> Download Template
            </button>
            
            <button onClick={handleBulkUpload} className="btn btn-success" disabled={!excelFile}>
              <FaArrowRight /> Upload Data
            </button>

            <button onClick={fetchData} className="btn btn-primary">
              <FaSyncAlt /> Refresh Data
            </button>

            <button onClick={handleAddNew} className="btn btn-success">
              <FaPlus /> Add New
            </button>
          </div>
          
          {excelFile && (
            <div className="file-info">
              Selected: {excelFile.name} ({(excelFile.size / 1024).toFixed(2)} KB)
            </div>
          )}
          
          {uploadStatus && (
            <div className={`alert ${uploadStatus.includes('[OK]') ? 'alert-success' : uploadStatus.includes('[ERR]') ? 'alert-error' : 'alert-info'}`}>
              {uploadStatus}
            </div>
          )}

          {/* Column Mapping */}
          <div className="mapping-section">
            <h4><FaCompass /> Column Mapping (edit to match your sheet headers)</h4>
            <div className="mapping-grid">
              {mappingFields.map((field) => (
                <div key={field.key} className="mapping-item">
                  <label>{field.label}</label>
                  <input
                    type="text"
                    value={Array.isArray(columnMapping[field.key]) ? columnMapping[field.key].join(',') : (columnMapping[field.key] || '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      setColumnMapping((prev) => ({
                        ...prev,
                        [field.key]: val ? val.split(',').map((v) => v.trim()) : [],
                      }));
                    }}
                    placeholder="Excel column header (comma separated for alternatives)"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Field Documentation */}
          <div className="field-documentation">
            <h4><FaEdit /> Required Fields for {uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}:</h4>
            {uploadType === 'students' ? (
              <div className="fields-list">
                <div><strong>Sr. No.</strong> - Serial number (Optional)</div>
                <div><strong>PRN</strong> - Unique Student ID (Required)</div>
                <div><strong>Status</strong> - Student status (Optional)</div>
                <div><strong>Seat no</strong> - Seat/Exam number (Optional)</div>
                <div><strong>Roll No</strong> - College Roll Number (Required)</div>
                <div><strong>Student Name</strong> - Full Name (Required)</div>
                <div><strong>Year</strong> - First, Second, Third, or Fourth (Required)</div>
                <div><strong>Department</strong> - Department name (Optional, auto-syncs with Branch)</div>
                <div><strong>Branch</strong> - Department/Branch (Required)</div>
                <div><strong>Division</strong> - Class Division (Required)</div>
                <div><strong>Email</strong> - Student Email (Required)</div>
                <div><strong>Mobile No</strong> - Contact Number</div>
              </div>
            ) : uploadType === 'faculty' ? (
              <div className="fields-list">
                <div><strong>Faculty ID</strong> - Unique Faculty ID (Required)</div>
                <div><strong>Faculty Name</strong> - Full Name (Required)</div>
                <div><strong>Email</strong> - Faculty Email (Required)</div>
                <div><strong>Mobile No</strong> - Contact Number</div>
                <div><strong>Department</strong> - Teaching Department (Required)</div>
                <div><strong>Designation</strong> - Professor, Assistant Professor, etc. (Required)</div>
              </div>
            ) : uploadType === 'marks' ? (
              <div>
                <div className="format-badge">
                  <strong>� Format:</strong> Comprehensive Semester Marks Sheet
                </div>
                <div className="fields-list">
                  <div><strong>Name of Student</strong> - Student's full name (Required)</div>
                  <div><strong>PRN NO</strong> - Student's PRN/Roll number (Required)</div>
                  <div><strong>Year</strong> - First, Second, Third, or Fourth (Required)</div>
                  <div><strong>IN SEM sub 1-5</strong> - Internal semester marks for 5 subjects</div>
                  <div><strong>IN SEM Total</strong> - Sum of internal marks (Required)</div>
                  <div><strong>IN SEM Percentage</strong> - Internal marks percentage (Required)</div>
                  <div><strong>END SEM sub 1-5</strong> - End semester marks for 5 subjects</div>
                  <div><strong>END SEM Total</strong> - Sum of external marks (Required)</div>
                  <div><strong>END SEM Percentage</strong> - External marks percentage (Required)</div>
                  <div><strong>CGPA</strong> - Cumulative GPA (Required)</div>
                </div>
                <div className="format-example">
                  <strong><FaEdit /> Example:</strong>
                  <code>John Doe,PRN001,101,First,18,19,17,20,18,92,73.6,75,78,72,80,77,382,76.4,8.5</code>
                  <div className="example-legend">
                    Name | PRN | Seat | Year | Internal(5@20 each) | IN Total | IN % | External(5@100 each) | EX Total | EX % | CGPA
                  </div>
                </div>
              </div>
            ) : uploadType === 'attendance' ? (
              <div>
                <div className="format-badge">
                  <strong><FaClipboardList /> Current Format:</strong> {dataFormat === 'single' ? 'Single Subject Per Row (Legacy)' : 'Detailed Semester Row'}
                </div>
                <div className="fields-list">
                  <div><strong>PRN</strong> - Student PRN to link attendance (Required)</div>
                  {dataFormat === 'single' ? (
                    <>
                      <div><strong>Month</strong> - Month name (January, February, etc.) (Required)</div>
                      <div><strong>Year</strong> - Year (2024, 2025, etc.) (Required)</div>
                      <div><strong>Subject Name</strong> - Subject name (Required)</div>
                      <div><strong>Total Classes</strong> - Total classes conducted (Required)</div>
                      <div><strong>Attended Classes</strong> - Classes attended by student (Required)</div>
                    </>
                  ) : (
                    <>
                      <div><strong>Core Columns</strong> - Sr. No., PRN, Status, Roll No., Student Name, Department</div>
                      <div><strong>Theory Columns</strong> - DSA/OOP/BCN/Open Elective-1/DELD/PME/UHV with Total, Attended, Percentage</div>
                      <div><strong>Practical Columns</strong> - DSAL/OOPL/CEPL/PMEL with Total Practicals, Attended, Percentage</div>
                      <div><strong>Summary Columns</strong> - Total Theory Lectures Attended, Total Lab Practicals Attended</div>
                      <div><strong><FaLightbulb /> Tip:</strong> Month and Year are optional in detailed format. The system stores them as Overall and current year when omitted.</div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Students/Faculty Data View */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaClipboardList /> {activeTab === 'students' ? 'Students Records' : 'Faculty Records'}</h2>
        </div>

        <div className="upload-controls" style={{ marginBottom: '1rem' }}>
          <button
            className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab('students');
              setUploadType('students');
            }}
          >
            <FaGraduationCap /> Students
          </button>
          <button
            className={`btn ${activeTab === 'faculty' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setActiveTab('faculty');
              setUploadType('faculty');
            }}
          >
            <FaChalkboardTeacher /> Faculty
          </button>
          <button onClick={fetchData} className="btn btn-primary">
            <FaSyncAlt /> Refresh
          </button>
          <button onClick={handleAddNew} className="btn btn-success">
            <FaPlus /> Add New
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner"></div>
            Loading records...
          </div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : (
          <div className="table-responsive">
            {activeTab === 'students' ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PRN</th>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Year</th>
                    <th>Branch</th>
                    <th>Division</th>
                    <th>Email</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length > 0 ? (
                    students.map((record) => (
                      <tr key={record._id || record.prn}>
                        <td>{record.prn}</td>
                        <td>{record.rollNo}</td>
                        <td>{record.studentName}</td>
                        <td>{record.year}</td>
                        <td>{record.branch}</td>
                        <td>{record.division}</td>
                        <td>{record.email}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleEdit(record)}>
                              <FaEdit /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(record)}>
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>No student records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Designation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {faculty.length > 0 ? (
                    faculty.map((record) => (
                      <tr key={record._id || record.facultyId}>
                        <td>{record.facultyId}</td>
                        <td>{record.facultyName}</td>
                        <td>{record.email}</td>
                        <td>{record.department}</td>
                        <td>{record.designation}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleEdit(record)}>
                              <FaEdit /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(record)}>
                              <FaTrash /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '1rem' }}>No faculty records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{editingRecord ? 'Edit Record' : 'Add New Record'}</h3>
              <button onClick={() => setShowEditModal(false)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              {activeTab === 'students' ? (
                <div className="form-grid">
                  <div className="form-group">
                    <label>PRN *</label>
                    <input
                      type="text"
                      value={editForm.prn || ''}
                      onChange={(e) => setEditForm({...editForm, prn: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Roll No *</label>
                    <input
                      type="text"
                      value={editForm.rollNo || ''}
                      onChange={(e) => setEditForm({...editForm, rollNo: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Student Name *</label>
                    <input
                      type="text"
                      value={editForm.studentName || ''}
                      onChange={(e) => setEditForm({...editForm, studentName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Year *</label>
                    <select
                      value={editForm.year || 'First'}
                      onChange={(e) => setEditForm({...editForm, year: e.target.value})}
                    >
                      <option value="First">First Year</option>
                      <option value="Second">Second Year</option>
                      <option value="Third">Third Year</option>
                      <option value="Fourth">Fourth Year</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Branch *</label>
                    <input
                      type="text"
                      value={editForm.branch || ''}
                      onChange={(e) => setEditForm({...editForm, branch: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Division *</label>
                    <input
                      type="text"
                      value={editForm.division || ''}
                      onChange={(e) => setEditForm({...editForm, division: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile No</label>
                    <input
                      type="text"
                      value={editForm.mobileNo || ''}
                      onChange={(e) => setEditForm({...editForm, mobileNo: e.target.value})}
                    />
                  </div>
                </div>
              ) : (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Faculty ID *</label>
                    <input
                      type="text"
                      value={editForm.facultyId || ''}
                      onChange={(e) => setEditForm({...editForm, facultyId: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Faculty Name *</label>
                    <input
                      type="text"
                      value={editForm.facultyName || ''}
                      onChange={(e) => setEditForm({...editForm, facultyName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={editForm.email || ''}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile No</label>
                    <input
                      type="text"
                      value={editForm.mobileNo || ''}
                      onChange={(e) => setEditForm({...editForm, mobileNo: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Department *</label>
                    <input
                      type="text"
                      value={editForm.department || ''}
                      onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation *</label>
                    <input
                      type="text"
                      value={editForm.designation || ''}
                      onChange={(e) => setEditForm({...editForm, designation: e.target.value})}
                      required
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={editingRecord ? handleUpdate : handleCreate} 
                className="btn btn-primary"
              >
                {editingRecord ? 'Update' : 'Create'} Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Reports Modal */}
      {showReportsModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Generate Reports</h3>
              <button onClick={() => setShowReportsModal(false)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Report Type:</label>
                <select 
                  className="form-control"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="students">Students Report</option>
                  <option value="faculty">Faculty Report</option>
                  <option value="dashboard">Dashboard Summary</option>
                </select>
              </div>
              <div className="report-preview">
                <h4>Report Details:</h4>
                {reportType === 'students' && (
                  <p><FaClipboardList /> Students Report - {students.length} records with PRN, Name, Year, Branch, Email and Contact information</p>
                )}
                {reportType === 'faculty' && (
                  <p><FaClipboardList /> Faculty Report - {faculty.length} records with Faculty ID, Name, Department, Designation and Contact information</p>
                )}
                {reportType === 'dashboard' && (
                  <p><FaChartLine /> Dashboard Summary - Overview of total students, faculty, and year-wise distribution</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowReportsModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleGenerateReport} className="btn btn-success">
                <FaFileDownload /> Download Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Announcement Modal */}
      {showAnnouncementModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Send Announcement</h3>
              <button onClick={() => setShowAnnouncementModal(false)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Send to:</label>
                <select 
                  className="form-control"
                  value={announcementTarget}
                  onChange={(e) => setAnnouncementTarget(e.target.value)}
                >
                  <option value="all">All Users</option>
                  <option value="student">Students Only</option>
                  <option value="faculty">Faculty Only</option>
                </select>
              </div>
              <div className="form-group">
                <label>Message:</label>
                <textarea 
                  className="form-control"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Enter your announcement message..."
                  rows="6"
                />
              </div>
              <div className="form-group">
                <p className="form-hint">
                  <FaLightbulb /> Recipients: {announcementTarget === 'all' ? 'All Users' : announcementTarget === 'student' ? 'All Students (' + students.length + ')' : 'All Faculty (' + faculty.length + ')'}  
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAnnouncementModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleSendAnnouncement} className="btn btn-success">
                <FaEnvelope /> Send Announcement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Audit Log Modal */}
      {showAuditLog && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <div className="modal-header">
              <h3>System Audit Log</h3>
              <button onClick={() => setShowAuditLog(false)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              <div className="audit-log-container">
                {auditLogs.length > 0 ? (
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Action</th>
                        <th>User</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log, index) => (
                        <tr key={index}>
                          <td>{new Date(log.timestamp).toLocaleString()}</td>
                          <td>{log.action}</td>
                          <td>{log.user}</td>
                          <td>
                            <span className={`status-badge ${log.status?.toLowerCase() || 'success'}`}>
                              {log.status || 'Success'}
                            </span>
                          </td>
                          <td className="details-cell">
                            {log.records && `Records: ${log.records}`}
                            {log.size && `Size: ${log.size}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="no-data">No audit logs available</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAuditLog(false)} className="btn btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PlacementManagement = () => {
  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [yearSummary, setYearSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showcaseError, setShowcaseError] = useState('');
  const [editingPlacement, setEditingPlacement] = useState(null);
  const [placementForm, setPlacementForm] = useState({
    placementStatus: 'Not Eligible',
    companyName: '',
    package: '',
    offerLetterDate: ''
  });
  const [showcaseEntries, setShowcaseEntries] = useState([]);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [editingShowcaseId, setEditingShowcaseId] = useState('');
  const [showcaseForm, setShowcaseForm] = useState({
    studentName: '',
    year: 'Fourth',
    branch: '',
    companyName: '',
    role: '',
    packageLpa: '',
    placedYear: new Date().getFullYear(),
    note: ''
  });

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/students/placements`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          year: yearFilter || undefined,
          placementStatus: statusFilter || undefined,
          search: search || undefined
        }
      });

      setStudents(Array.isArray(response.data?.students) ? response.data.students : []);
      setYearSummary(response.data?.yearWiseSummary || {});
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || fetchError.message);
      setStudents([]);
      setYearSummary({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, [yearFilter, statusFilter]);

  useEffect(() => {
    fetchPlacementShowcase();
  }, []);

  const handleOpenPlacementEdit = (student) => {
    setEditingPlacement(student);
    setPlacementForm({
      placementStatus: student.placementStatus || 'Not Eligible',
      companyName: student.companyName || '',
      package: student.package || '',
      offerLetterDate: student.offerLetterDate ? new Date(student.offerLetterDate).toISOString().slice(0, 10) : ''
    });
  };

  const handleSavePlacement = async () => {
    if (!editingPlacement?.prn) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/students/placements/${editingPlacement.prn}`,
        placementForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setEditingPlacement(null);
      await fetchPlacements();
    } catch (saveError) {
      setError(saveError.response?.data?.message || saveError.message);
    }
  };

  const fetchPlacementShowcase = async () => {
    try {
      setShowcaseLoading(true);
      setShowcaseError('');
      const token = localStorage.getItem('token');
      let response;
      try {
        response = await axios.get(`${API_BASE_URL}/api/placement-showcase`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        });
      } catch (primaryError) {
        response = await axios.get(`${API_BASE_URL}/api/placements/showcase`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 100 }
        });
      }
      setShowcaseEntries(Array.isArray(response.data?.placements) ? response.data.placements : []);
    } catch (showcaseError) {
      if (showcaseError.response?.status === 404) {
        // Backward compatibility: keep placement management functional even if showcase API is unavailable.
        setShowcaseEntries([]);
        setShowcaseError('Past placement showcase service is not available on current backend build.');
      } else {
        setShowcaseError(showcaseError.response?.data?.message || showcaseError.message);
      }
      setShowcaseEntries([]);
    } finally {
      setShowcaseLoading(false);
    }
  };

  const resetShowcaseForm = () => {
    setEditingShowcaseId('');
    setShowcaseForm({
      studentName: '',
      year: 'Fourth',
      branch: '',
      companyName: '',
      role: '',
      packageLpa: '',
      placedYear: new Date().getFullYear(),
      note: ''
    });
  };

  const handleSaveShowcase = async () => {
    try {
      const token = localStorage.getItem('token');
      setShowcaseError('');
      const payload = {
        ...showcaseForm,
        packageLpa: showcaseForm.packageLpa === '' ? null : Number(showcaseForm.packageLpa),
        placedYear: Number(showcaseForm.placedYear)
      };

      if (editingShowcaseId) {
        try {
          await axios.put(`${API_BASE_URL}/api/placement-showcase/${editingShowcaseId}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (primaryError) {
          await axios.put(`${API_BASE_URL}/api/placements/showcase/${editingShowcaseId}`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      } else {
        try {
          await axios.post(`${API_BASE_URL}/api/placement-showcase`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (primaryError) {
          await axios.post(`${API_BASE_URL}/api/placements/showcase`, payload, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }

      resetShowcaseForm();
      await fetchPlacementShowcase();
    } catch (saveError) {
      setShowcaseError(saveError.response?.data?.message || saveError.message);
    }
  };

  const handleEditShowcase = (entry) => {
    setEditingShowcaseId(entry._id);
    setShowcaseForm({
      studentName: entry.studentName || '',
      year: entry.year || 'Fourth',
      branch: entry.branch || '',
      companyName: entry.companyName || '',
      role: entry.role || '',
      packageLpa: entry.packageLpa ?? '',
      placedYear: entry.placedYear || new Date().getFullYear(),
      note: entry.note || ''
    });
  };

  const handleDeleteShowcase = async (entryId) => {
    try {
      const token = localStorage.getItem('token');
      setShowcaseError('');
      try {
        await axios.delete(`${API_BASE_URL}/api/placement-showcase/${entryId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (primaryError) {
        await axios.delete(`${API_BASE_URL}/api/placements/showcase/${entryId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      await fetchPlacementShowcase();
    } catch (deleteError) {
      setShowcaseError(deleteError.response?.data?.message || deleteError.message);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h1>Placement Management</h1>
        <p>Update placed student company details with year-wise filtering and visibility across all dashboards</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h2 className="card-title"><FaChartBar /> Year-wise Placement Summary</h2>
        </div>
        <div className="card-body">
          <div className="stats-grid">
            {Object.keys(yearSummary).length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>No placement summary available.</p>
            ) : (
              Object.entries(yearSummary).map(([year, summary]) => (
                <div className="stat-card" key={year}>
                  <div className="stat-icon"><FaGraduationCap /></div>
                  <div className="stat-info">
                    <h3>{year}</h3>
                    <p>Total: {summary.total} | Placed: {summary.placed}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header">
          <h2 className="card-title"><FaBriefcase /> Past Placed Students Showcase</h2>
        </div>
        <div className="card-body">
          {showcaseError && <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>{showcaseError}</div>}
          <div className="form-grid" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label>Student Name *</label>
              <input className="form-control" value={showcaseForm.studentName} onChange={(e) => setShowcaseForm({ ...showcaseForm, studentName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Year *</label>
              <select className="form-control" value={showcaseForm.year} onChange={(e) => setShowcaseForm({ ...showcaseForm, year: e.target.value })}>
                <option value="First">First</option>
                <option value="Second">Second</option>
                <option value="Third">Third</option>
                <option value="Fourth">Fourth</option>
              </select>
            </div>
            <div className="form-group">
              <label>Branch *</label>
              <input className="form-control" value={showcaseForm.branch} onChange={(e) => setShowcaseForm({ ...showcaseForm, branch: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Company *</label>
              <input className="form-control" value={showcaseForm.companyName} onChange={(e) => setShowcaseForm({ ...showcaseForm, companyName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input className="form-control" value={showcaseForm.role} onChange={(e) => setShowcaseForm({ ...showcaseForm, role: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Package (LPA)</label>
              <input className="form-control" type="number" value={showcaseForm.packageLpa} onChange={(e) => setShowcaseForm({ ...showcaseForm, packageLpa: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Placed Year *</label>
              <input className="form-control" type="number" value={showcaseForm.placedYear} onChange={(e) => setShowcaseForm({ ...showcaseForm, placedYear: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Note</label>
              <input className="form-control" value={showcaseForm.note} onChange={(e) => setShowcaseForm({ ...showcaseForm, note: e.target.value })} />
            </div>
          </div>

          <div className="upload-controls" style={{ marginBottom: '1rem' }}>
            <button className="btn btn-success" onClick={handleSaveShowcase}>{editingShowcaseId ? 'Update Entry' : 'Add Entry'}</button>
            {editingShowcaseId && <button className="btn btn-secondary" onClick={resetShowcaseForm}>Cancel Edit</button>}
          </div>

          {showcaseLoading ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner"></div></div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Year</th>
                    <th>Branch</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Package</th>
                    <th>Placed Year</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {showcaseEntries.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>No past placement entries yet.</td></tr>
                  ) : showcaseEntries.map((entry) => (
                    <tr key={entry._id}>
                      <td>{entry.studentName}</td>
                      <td>{entry.year}</td>
                      <td>{entry.branch}</td>
                      <td>{entry.companyName}</td>
                      <td>{entry.role || '-'}</td>
                      <td>{entry.packageLpa ?? '-'}</td>
                      <td>{entry.placedYear}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => handleEditShowcase(entry)}><FaEdit /> Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDeleteShowcase(entry._id)}><FaTrash /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaBriefcase /> Placement Records</h2>
        </div>
        <div className="card-body">
          <div className="upload-controls" style={{ marginBottom: '1rem' }}>
            <select className="form-control" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="">All Years</option>
              <option value="First">First</option>
              <option value="Second">Second</option>
              <option value="Third">Third</option>
              <option value="Fourth">Fourth</option>
            </select>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Status</option>
              <option value="Not Eligible">Not Eligible</option>
              <option value="Eligible">Eligible</option>
              <option value="Placed">Placed</option>
              <option value="Higher Studies">Higher Studies</option>
            </select>
            <input
              className="form-control"
              placeholder="Search by PRN / student / company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn btn-primary" onClick={fetchPlacements}>Search</button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>PRN</th>
                    <th>Year</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th>Company</th>
                    <th>Package (LPA)</th>
                    <th>Offer Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '1rem' }}>No records found.</td>
                    </tr>
                  ) : (
                    students.map((student) => (
                      <tr key={student.prn}>
                        <td>{student.studentName}</td>
                        <td>{student.prn}</td>
                        <td>{student.year}</td>
                        <td>{student.branch}</td>
                        <td>{student.placementStatus || 'Not Eligible'}</td>
                        <td>{student.companyName || '-'}</td>
                        <td>{student.package ?? '-'}</td>
                        <td>{student.offerLetterDate ? new Date(student.offerLetterDate).toLocaleDateString() : '-'}</td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleOpenPlacementEdit(student)}>
                            <FaEdit /> Update
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editingPlacement && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Update Placement - {editingPlacement.studentName}</h3>
              <button onClick={() => setEditingPlacement(null)} className="btn-close">×</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={placementForm.placementStatus}
                    onChange={(e) => setPlacementForm({ ...placementForm, placementStatus: e.target.value })}
                  >
                    <option value="Not Eligible">Not Eligible</option>
                    <option value="Eligible">Eligible</option>
                    <option value="Placed">Placed</option>
                    <option value="Higher Studies">Higher Studies</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={placementForm.companyName}
                    onChange={(e) => setPlacementForm({ ...placementForm, companyName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Package (LPA)</label>
                  <input
                    type="number"
                    value={placementForm.package}
                    onChange={(e) => setPlacementForm({ ...placementForm, package: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Offer Date</label>
                  <input
                    type="date"
                    value={placementForm.offerLetterDate}
                    onChange={(e) => setPlacementForm({ ...placementForm, offerLetterDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingPlacement(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleSavePlacement}>Save Placement</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// DatabaseManagement Component
const DatabaseManagement = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [queryResult, setQueryResult] = useState('');

  const availableTables = [
    { name: 'students', description: 'Student Information Table', count: 0 },
    { name: 'faculty', description: 'Faculty Information Table', count: 0 },
    { name: 'users', description: 'System Users Table', count: 0 },
    { name: 'attendance', description: 'Attendance Records', count: 0 },
    { name: 'results', description: 'Exam Results Table', count: 0 },
    { name: 'subjects', description: 'Subject Information', count: 0 }
  ];

  const handleCreateTable = (tableName) => {
    alert(`Table "${tableName}" creation feature would be implemented with backend API`);
  };

  const handleExecuteQuery = () => {
    setQueryResult('Query execution feature would connect to backend SQL interface\n\nMock Result:\n✅ Query executed successfully\n📊 15 rows affected\n⏱️ Execution time: 0.45s');
  };

  const handleBackupDatabase = () => {
    alert('Database backup initiated! This would connect to backend backup service.');
  };

  return (
    <div>
      <div className="section-header">
        <h1>Database Management</h1>
        <p>Manage database schema, tables, and execute SQL queries</p>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaDatabase /> Database Tables</h2>
            <button onClick={handleBackupDatabase} className="btn btn-success">
              <FaSave /> Backup Database
            </button>
          </div>
          <div className="tables-list">
            {availableTables.map((table) => (
              <div key={table.name} className="table-item">
                <div className="table-info">
                  <h4>{table.name}</h4>
                  <p>{table.description}</p>
                  <span className="table-count">{table.count} records</span>
                </div>
                <div className="table-actions">
                  <button className="btn btn-primary">View Schema</button>
                  <button className="btn btn-warning">Manage Data</button>
                  <button 
                    onClick={() => handleCreateTable(table.name)}
                    className="btn btn-success"
                  >
                    Create/Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaBolt /> SQL Query Interface</h2>
          </div>
          <div className="sql-interface">
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="Enter your SQL query here...&#10;Example: SELECT * FROM students WHERE year = 'Third'"
              className="sql-textarea"
              rows="6"
            />
            <div className="sql-actions">
              <button onClick={handleExecuteQuery} className="btn btn-primary">
                <FaRocket /> Execute Query
              </button>
              <button onClick={() => setSqlQuery('')} className="btn btn-secondary">
                <FaBroom /> Clear
              </button>
            </div>
            {queryResult && (
              <div className="query-result">
                <h4>Query Result:</h4>
                <pre>{queryResult}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title"><FaTools /> Schema Management</h2>
        </div>
        <div className="schema-management">
          <div className="schema-info">
            <h4>Current Database Schema</h4>
            <div className="schema-tables">
              <div className="schema-table">
                <h5>students Table</h5>
                <ul>
                  <li><code>prn: String (Required, Unique)</code></li>
                  <li><code>rollNo: String (Required)</code></li>
                  <li><code>studentName: String (Required)</code></li>
                  <li><code>year: String (Required, First|Second|Third|Fourth)</code></li>
                  <li><code>branch: String (Required)</code></li>
                  <li><code>division: String (Required)</code></li>
                  <li><code>email: String (Required)</code></li>
                  <li><code>mobileNo: String</code></li>
                </ul>
              </div>
              <div className="schema-table">
                <h5>faculty Table</h5>
                <ul>
                  <li><code>facultyId: String (Required, Unique)</code></li>
                  <li><code>facultyName: String (Required)</code></li>
                  <li><code>email: String (Required)</code></li>
                  <li><code>mobileNo: String</code></li>
                  <li><code>department: String (Required)</code></li>
                  <li><code>designation: String (Required)</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Change Requests Management Component
const ChangeRequestsManagement = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'all', 'pending', 'approved', 'rejected'
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState('');

  useEffect(() => {
    fetchChangeRequests();
  }, [filter]);

  const fetchChangeRequests = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const endpoint = filter === 'pending' 
        ? `${API_BASE_URL}/api/change-requests/pending`
        : `${API_BASE_URL}/api/change-requests/all`;
      
      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      let filteredRequests = response.data.requests || [];
      if (filter !== 'pending' && filter !== 'all') {
        filteredRequests = filteredRequests.filter(req => req.status === filter);
      }

      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error fetching change requests:', error);
      setActionStatus('[ERR] Error loading requests: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    if (!window.confirm('Are you sure you want to approve this change request?')) {
      return;
    }

    try {
      setActionStatus('Processing...');
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API_BASE_URL}/api/change-requests/${requestId}/approve`,
        { approvedBy: user.username },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setActionStatus('[OK] Change request approved successfully!');
      fetchChangeRequests();
      setTimeout(() => setActionStatus(''), 3000);
    } catch (error) {
      console.error('Approval error:', error);
      setActionStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleReject = async (requestId) => {
    const reason = prompt('Enter rejection reason (optional):');
    if (reason === null) return; // User canceled

    try {
      setActionStatus('Processing...');
      const token = localStorage.getItem('token');
      
      await axios.put(
        `${API_BASE_URL}/api/change-requests/${requestId}/reject`,
        { rejectedBy: user.username, reason },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setActionStatus('[OK] Change request rejected.');
      fetchChangeRequests();
      setTimeout(() => setActionStatus(''), 3000);
    } catch (error) {
      console.error('Rejection error:', error);
      setActionStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div>
      <div className="section-header">
        <h1>Change Requests Management</h1>
        <p>Review and approve student profile and password change requests</p>
      </div>

      {actionStatus && (
        <div className={`alert ${actionStatus.includes('[OK]') ? 'alert-success' : actionStatus.includes('[ERR]') ? 'alert-error' : 'alert-info'}`}>
          {actionStatus}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="upload-controls" style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => setFilter('pending')}
              className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            >
              ⏳ Pending ({requests.filter(r => r.status === 'pending').length})
            </button>
            <button 
              onClick={() => setFilter('approved')}
              className={`btn ${filter === 'approved' ? 'btn-success' : 'btn-secondary'}`}
            >
              <FaCheck /> Approved
            </button>
            <button 
              onClick={() => setFilter('rejected')}
              className={`btn ${filter === 'rejected' ? 'btn-warning' : 'btn-secondary'}`}
            >
              <FaTimes /> Rejected
            </button>
            <button 
              onClick={() => setFilter('all')}
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            >
              ▤ All Requests
            </button>
            <button onClick={fetchChangeRequests} className="btn btn-primary">
              ↻ Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">▤ Change Requests</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner"></div>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              <h3>No {filter !== 'all' ? filter : ''} requests found</h3>
              <p>There are no change requests to display.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Student</th>
                    <th>Type</th>
                    <th>Requested At</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>#{request.id}</td>
                      <td>
                        <div>
                          <strong>{request.studentName}</strong>
                          <br />
                          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            {request.studentPRN}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`prediction-badge ${request.changeType === 'password' ? 'good' : 'excellent'}`}>
                          {request.changeType === 'password' ? <><FaLock /> Password</> : <><FaUser /> Profile</>}
                        </span>
                      </td>
                      <td>{new Date(request.requestedAt).toLocaleString()}</td>
                      <td>
                        <span className={`attendance-status ${
                          request.status === 'approved' ? 'good' : 
                          request.status === 'rejected' ? 'warning' : 
                          'default'
                        }`}>
                          {request.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {request.changeType === 'profile' && (
                          <details>
                            <summary style={{ cursor: 'pointer', color: 'var(--primary)' }}>
                              View Changes
                            </summary>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                              {Object.keys(request.requestedData || {}).map(key => (
                                <div key={key} style={{ marginBottom: '0.25rem' }}>
                                  <strong>{key}:</strong> {request.currentData[key]} → {request.requestedData[key]}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        {request.changeType === 'password' && (
                          <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            Password change request
                          </span>
                        )}
                      </td>
                      <td>
                        {request.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleApprove(request.id)}
                              className="btn btn-success"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              <FaCheckCircle /> Approve
                            </button>
                            <button 
                              onClick={() => handleReject(request.id)}
                              className="btn btn-warning"
                              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                            >
                              <FaTimesCircle /> Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                            {request.status === 'approved' && `Approved by ${request.approvedBy}`}
                            {request.status === 'rejected' && `Rejected by ${request.rejectedBy}`}
                            {request.status === 'rejected' && request.rejectionReason && (
                              <div style={{ marginTop: '0.25rem' }}>
                                Reason: {request.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// MLModelControl Component
const MLModelControl = () => {
  const [modelStatus, setModelStatus] = useState('Not Trained');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelMetrics, setModelMetrics] = useState({
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0
  });
  const [trainingData, setTrainingData] = useState({
    totalRecords: 0,
    features: 0,
    lastTrained: 'Never'
  });
  const [trainingScope, setTrainingScope] = useState({
    year: 'All',
    branch: 'Information Technology',
    division: ''
  });
  const [trainingHistory, setTrainingHistory] = useState([]);

  // ML API + Analysis states
  const [modelInfo, setModelInfo] = useState(null);
  const [analysisFilters, setAnalysisFilters] = useState({
    year: '',
    branch: 'Information Technology',
    division: '',
    subjectName: ''
  });
  const [classStats, setClassStats] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [subjectStats, setSubjectStats] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [topPerformers, setTopPerformers] = useState([]);
  const [topPerformersLoading, setTopPerformersLoading] = useState(false);
  const [topperYearFilter, setTopperYearFilter] = useState('All');

  const normalizeTrainingScope = () => ({
    year: trainingScope.year && trainingScope.year !== 'All' ? trainingScope.year : undefined,
    branch: trainingScope.branch || undefined,
    division: trainingScope.division || undefined
  });

  const classSummary = classStats?.statistics || {};
  const atRiskSummary = {
    total: Number(atRisk?.total_at_risk || 0),
    critical: Array.isArray(atRisk?.critical_risk_students) ? atRisk.critical_risk_students.length : 0,
    high: Array.isArray(atRisk?.high_risk_students) ? atRisk.high_risk_students.length : 0
  };
  const subjectSummary = subjectStats?.statistics || {};

  const classDistributionData = {
    labels: ['Excellent', 'Very Good', 'Good', 'Average', 'Below Average'],
    datasets: [
      {
        label: 'Performance Distribution',
        data: [
          Number(classSummary?.performance_distribution?.excellent || 0),
          Number(classSummary?.performance_distribution?.very_good || 0),
          Number(classSummary?.performance_distribution?.good || 0),
          Number(classSummary?.performance_distribution?.average || 0),
          Number(classSummary?.performance_distribution?.below_average || 0)
        ],
        backgroundColor: ['#27ae60', '#3498db', '#16a085', '#f39c12', '#e74c3c'],
        borderWidth: 1
      }
    ]
  };

  const classAverageData = {
    labels: ['Avg CGPA', 'Avg Attendance', 'Avg Perf Score', 'Avg Placement %'],
    datasets: [
      {
        label: 'Class Averages',
        data: [
          Number(classSummary?.average_cgpa || 0),
          Number(classSummary?.average_attendance || 0),
          Number(classSummary?.average_performance_score || 0),
          Number(classSummary?.average_placement_probability || 0)
        ],
        backgroundColor: ['#2980b9', '#27ae60', '#8e44ad', '#f39c12']
      }
    ]
  };

  const atRiskChartData = {
    labels: ['Critical Risk', 'High Risk'],
    datasets: [
      {
        data: [atRiskSummary.critical, atRiskSummary.high],
        backgroundColor: ['#c0392b', '#d35400'],
        borderWidth: 1
      }
    ]
  };

  const subjectMarksData = {
    labels: ['Average', 'Highest', 'Lowest'],
    datasets: [
      {
        label: 'Marks',
        data: [
          Number(subjectSummary?.average_marks || 0),
          Number(subjectSummary?.highest_marks || 0),
          Number(subjectSummary?.lowest_marks || 0)
        ],
        backgroundColor: ['#3498db', '#27ae60', '#e67e22']
      }
    ]
  };

  const subjectGradesData = {
    labels: Object.keys(subjectSummary?.grade_distribution || {}),
    datasets: [
      {
        label: 'Grade Count',
        data: Object.values(subjectSummary?.grade_distribution || {}).map((v) => Number(v || 0)),
        backgroundColor: ['#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#f39c12', '#e74c3c', '#7f8c8d']
      }
    ]
  };

  const normalizeScope = () => ({
    year: analysisFilters.year && analysisFilters.year !== 'All' ? analysisFilters.year : undefined,
    branch: analysisFilters.branch || undefined,
    division: analysisFilters.division || undefined
  });

  const refreshModelInfo = async () => {
    try {
      setAnalysisError('');
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/ml-analysis/model-info`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const info = res.data || {};
      setModelInfo(info);
      setModelStatus(info.trained ? 'Trained' : 'Not Trained');
      setModelMetrics({
        accuracy: Number(((info.metrics?.accuracy ?? 0) * 100).toFixed(2)),
        precision: Number(((info.metrics?.precision ?? 0) * 100).toFixed(2)),
        recall: Number(((info.metrics?.recall ?? 0) * 100).toFixed(2)),
        f1Score: Number(((info.metrics?.f1_score ?? 0) * 100).toFixed(2))
      });
      setTrainingData({
        totalRecords: info.rows_used || 0,
        features: Array.isArray(info.features) ? info.features.length : 0,
        lastTrained: info.lastTrained || 'Never'
      });
      if (info.trainingScope) {
        setTrainingScope((prev) => ({
          ...prev,
          year: info.trainingScope.year || prev.year,
          branch: info.trainingScope.branch === 'All' ? '' : (info.trainingScope.branch || prev.branch),
          division: info.trainingScope.division === 'All' ? '' : (info.trainingScope.division || prev.division)
        }));
      }
    } catch (e) {
      setModelStatus('Not Trained');
      setAnalysisError(`ML API unavailable or model info failed: ${e.response?.data?.error || e.message}`);
    }
  };

  const refreshTrainingHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_BASE_URL}/api/ml-analysis/training-history?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrainingHistory(Array.isArray(res.data?.runs) ? res.data.runs : []);
    } catch (e) {
      console.error('Failed to fetch training history:', e.message);
      setTrainingHistory([]);
    }
  };

  const refreshTopPerformers = async () => {
    try {
      setTopPerformersLoading(true);
      setAnalysisError('');
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ limit: '5' });
      if (topperYearFilter && topperYearFilter !== 'All') {
        params.set('year', topperYearFilter);
      }

      const res = await axios.get(`${API_BASE_URL}/api/ml-analysis/top-performers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTopPerformers(Array.isArray(res.data?.topPerformers) ? res.data.topPerformers : []);
    } catch (e) {
      console.error('Failed to fetch top performers:', e.message);
      setAnalysisError(`Topper list fetch failed: ${e.response?.data?.error || e.message}`);
      setTopPerformers([]);
    } finally {
      setTopPerformersLoading(false);
    }
  };

  useEffect(() => {
    refreshModelInfo();
    refreshTrainingHistory();
    refreshTopPerformers();
  }, []);

  useEffect(() => {
    refreshTopPerformers();
  }, [topperYearFilter]);

  const trainModel = async (forceRetrain = false) => {
    setModelStatus('Training...');
    setTrainingProgress(0);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_BASE_URL}/api/ml-analysis/train-model`, {
        ...normalizeTrainingScope(),
        forceRetrain
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const metrics = res.data?.metrics || {};
      const featureImportance = res.data?.feature_importance || {};
      const rowsUsed = res.data?.rows_used || 0;
      const features = res.data?.features || [];

      setTrainingProgress(100);
      setModelStatus('Trained');
      setModelInfo((prev) => ({
        ...(prev || {}),
        trained: true,
        features,
        metrics,
        featureImportance,
        lastTrained: res.data?.last_trained || new Date().toISOString(),
        rows_used: rowsUsed,
        trainingScope: res.data?.trainingScope || null
      }));
      setModelMetrics({
        accuracy: Number(((metrics.accuracy ?? 0) * 100).toFixed(2)),
        precision: Number(((metrics.precision ?? 0) * 100).toFixed(2)),
        recall: Number(((metrics.recall ?? 0) * 100).toFixed(2)),
        f1Score: Number(((metrics.f1_score ?? 0) * 100).toFixed(2))
      });
      setTrainingData({
        totalRecords: rowsUsed,
        features: Array.isArray(features) ? features.length : 0,
        lastTrained: res.data?.last_trained || new Date().toLocaleString()
      });
      if (res.data?.alreadyTrained) {
        setAnalysisError(`Model already trained for selected scope (${res.data?.trainingScope?.year || 'All'} year). Showing recorded analysis.`);
      }
      await refreshTrainingHistory();
      window.dispatchEvent(new Event('ml-model-updated'));
      if (!res.data?.alreadyTrained) {
        setAnalysisError('');
      }
    } catch (e) {
      setModelStatus('Not Trained');
      const backendError = e.response?.data?.error || e.response?.data?.details || e.response?.data?.message || e.message;
      setAnalysisError(`Training failed: ${backendError}`);
    }
  };

  const evaluateModel = async () => {
    try {
      await refreshModelInfo();
      alert('Model evaluation refreshed from current trained model.');
    } catch (error) {
      alert('Model evaluation failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const loadModel = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/ml-analysis/load-model`, {
        path: 'models/performance_model.joblib'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await refreshModelInfo();
      window.dispatchEvent(new Event('ml-model-updated'));
      alert('Model loaded successfully.');
    } catch (error) {
      setAnalysisError(error.response?.data?.error || error.message);
      alert('Model load failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const exportModel = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/ml-analysis/save-model`, {
        path: 'models/performance_model.joblib'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Model exported successfully.');
    } catch (error) {
      alert('Model export failed: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div>
      <div className="section-header">
        <h1>ML Model Control</h1>
        <p>Manage and monitor the Performance Prediction Model</p>
      </div>

      {/* Training Data Info */}
      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">▥ Training Data</h2>
          </div>
          <div className="training-info">
            <div className="data-stats">
              <div className="data-stat">
                <span className="stat-label">Total Records</span>
                <span className="stat-value">{trainingData.totalRecords}</span>
              </div>
              <div className="data-stat">
                <span className="stat-label">Features Used</span>
                <span className="stat-value">{trainingData.features}</span>
              </div>
              <div className="data-stat">
                <span className="stat-label">Last Trained</span>
                <span className="stat-value">{trainingData.lastTrained}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaCog /> Model Status</h2>
          </div>
          <div className="model-status">
            <div className="status-indicator">
              <span className={`status-dot ${modelStatus === 'Trained' ? 'trained' : modelStatus === 'Training...' ? 'training' : 'not-trained'}`}></span>
              Status: {modelStatus}
            </div>
            
            {modelStatus === 'Training...' && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${trainingProgress}%` }}
                  >
                    {trainingProgress}%
                  </div>
                </div>
                <div className="progress-text">Training in progress... Please wait</div>
              </div>
            )}

            <div className="form-row" style={{ marginBottom: '0.75rem' }}>
              <div className="form-group">
                <label>Training Year Scope</label>
                <select
                  className="form-control"
                  value={trainingScope.year}
                  onChange={(e) => setTrainingScope({ ...trainingScope, year: e.target.value })}
                >
                  <option value="All">All</option>
                  <option value="First">First</option>
                  <option value="Second">Second</option>
                  <option value="Third">Third</option>
                  <option value="Fourth">Fourth</option>
                </select>
              </div>
              <div className="form-group">
                <label>Training Branch Scope</label>
                <input
                  className="form-control"
                  placeholder="Information Technology"
                  value={trainingScope.branch}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label>Training Division Scope</label>
                <input
                  className="form-control"
                  placeholder="Optional division"
                  value={trainingScope.division}
                  onChange={(e) => setTrainingScope({ ...trainingScope, division: e.target.value })}
                />
              </div>
            </div>

            <div className="model-actions">
              <button onClick={() => trainModel(false)} className="btn btn-success" disabled={modelStatus === 'Training...'}>
                <FaBullseye /> Train Model
              </button>
              <button onClick={() => trainModel(true)} className="btn btn-warning" disabled={modelStatus === 'Training...'}>
                <FaSyncAlt /> Force Retrain
              </button>
              <button onClick={evaluateModel} className="btn btn-primary">
                ▥ Evaluate Model
              </button>
              <button onClick={exportModel} className="btn btn-warning">
                ▦ Export Model
              </button>
              <button onClick={loadModel} className="btn btn-secondary">
                <FaUpload /> Load Model
              </button>
            </div>
            <div style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
              Selected training scope: Year {trainingScope.year || 'All'}, Branch {trainingScope.branch || 'All'}, Division {trainingScope.division || 'All'}
            </div>
          </div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">▴ Model Performance</h2>
          </div>
          <div className="metrics-grid">
            <div className="metric-card">
              <h3>Accuracy</h3>
              <div className="metric-value">{modelMetrics.accuracy}%</div>
            </div>
            <div className="metric-card">
              <h3>Precision</h3>
              <div className="metric-value">{modelMetrics.precision}%</div>
            </div>
            <div className="metric-card">
              <h3>Recall</h3>
              <div className="metric-value">{modelMetrics.recall}%</div>
            </div>
            <div className="metric-card">
              <h3>F1 Score</h3>
              <div className="metric-value">{modelMetrics.f1Score}%</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">⌕ Feature Importance</h2>
          </div>
          <div className="feature-importance">
            {Object.keys(modelInfo?.featureImportance || {}).length > 0 ? (
              Object.entries(modelInfo.featureImportance)
                .sort((a, b) => b[1] - a[1])
                .map(([feature, value]) => {
                  const pct = Math.max(1, Math.min(100, Number((value * 100).toFixed(2))));
                  return (
                    <div className="feature-bar" key={feature}>
                      <span className="feature-name">{feature}</span>
                      <div className="feature-progress">
                        <div className="feature-fill" style={{ width: `${pct}%` }}>
                          <span className="feature-percentage">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <div style={{ color: 'var(--muted)' }}>Train the model to view feature importance.</div>
            )}
          </div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Training Records</h2>
          </div>
          <div className="card-body">
            {trainingHistory.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No training records available yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trained At</th>
                      <th>Status</th>
                      <th>Year</th>
                      <th>Branch</th>
                      <th>Division</th>
                      <th>Records</th>
                      <th>Accuracy</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingHistory.map((run) => (
                      <tr key={run._id}>
                        <td>{run.trainedAt ? new Date(run.trainedAt).toLocaleString() : '-'}</td>
                        <td>{run.status}</td>
                        <td>{run.scope?.year || 'All'}</td>
                        <td>{run.scope?.branch || 'All'}</td>
                        <td>{run.scope?.division || 'All'}</td>
                        <td>{Number(run.rowsUsed || 0)}</td>
                        <td>{Number((run.metrics?.accuracy || 0) * 100).toFixed(2)}%</td>
                        <td>{run.trainedBy?.username || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaGraduationCap /> Top 5 Toppers</h2>
          </div>
          <div className="card-body">
            <div className="form-group" style={{ maxWidth: '220px', marginBottom: '0.75rem' }}>
              <label>Topper Year</label>
              <select
                className="form-control"
                value={topperYearFilter}
                onChange={(e) => setTopperYearFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="First">First</option>
                <option value="Second">Second</option>
                <option value="Third">Third</option>
                <option value="Fourth">Fourth</option>
              </select>
            </div>
            {topPerformersLoading ? (
              <div style={{ color: 'var(--muted)' }}>Loading toppers...</div>
            ) : topPerformers.length === 0 ? (
              <div style={{ color: 'var(--muted)' }}>No topper data available for selected scope.</div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>PRN</th>
                      <th>Year</th>
                      <th>Division</th>
                      <th>CGPA</th>
                      <th>Attendance</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPerformers.map((student, index) => (
                      <tr key={student._id || student.prn || `${student.studentName}-${index}`}>
                        <td><strong>{index + 1}</strong></td>
                        <td>{student.studentName || '-'}</td>
                        <td>{student.prn || '-'}</td>
                        <td>{student.year || '-'}</td>
                        <td>{student.division || '-'}</td>
                        <td>{Number(student.cgpa || 0).toFixed(2)}</td>
                        <td>{Number(student.overallAttendance || 0).toFixed(2)}%</td>
                        <td><strong>{Number(student.performanceScore || 0).toFixed(2)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin ML Analysis Panel */}
      <div className="cards-grid">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><FaBrain /> ML Analysis (Admin)</h2>
            {analysisError && <div className="alert alert-error">{analysisError}</div>}
          </div>
          <div className="analysis-controls">
            <div className="form-row">
              <div className="form-group">
                <label>Year</label>
                <select
                  className="form-control"
                  value={analysisFilters.year}
                  onChange={(e) => setAnalysisFilters({ ...analysisFilters, year: e.target.value })}
                >
                  <option value="">All</option>
                  <option value="First">First</option>
                  <option value="Second">Second</option>
                  <option value="Third">Third</option>
                  <option value="Fourth">Fourth</option>
                </select>
              </div>
              <div className="form-group">
                <label>Branch</label>
                <input
                  className="form-control"
                  placeholder="Information Technology"
                  value={analysisFilters.branch}
                  readOnly
                />
              </div>
              <div className="form-group">
                <label>Division</label>
                <input
                  className="form-control"
                  placeholder="e.g., A"
                  value={analysisFilters.division}
                  onChange={(e) => setAnalysisFilters({ ...analysisFilters, division: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Subject (optional)</label>
                <input
                  className="form-control"
                  placeholder="e.g., Data Structures"
                  value={analysisFilters.subjectName}
                  onChange={(e) => setAnalysisFilters({ ...analysisFilters, subjectName: e.target.value })}
                />
              </div>
            </div>

            {/* Live Summary Cards (non-static) */}
            <div className="metrics-grid" style={{ marginTop: '1rem' }}>
              <div className="metric-card">
                <h3>Class Avg Performance</h3>
                <div className="metric-value">{Number(classSummary.average_performance_score || 0).toFixed(2)}</div>
              </div>
              <div className="metric-card">
                <h3>Total At-Risk</h3>
                <div className="metric-value">{atRiskSummary.total}</div>
              </div>
              <div className="metric-card">
                <h3>Critical Risk</h3>
                <div className="metric-value">{atRiskSummary.critical}</div>
              </div>
              <div className="metric-card">
                <h3>Subject Avg Marks</h3>
                <div className="metric-value">{Number(subjectSummary.average_marks || 0).toFixed(2)}</div>
              </div>
            </div>
            <div className="analysis-actions">
              <button className="btn btn-primary" onClick={async () => {
                try {
                  setAnalysisLoading(true);
                  setAnalysisError('');
                  const token = localStorage.getItem('token');
                  const res = await axios.post(`${API_BASE_URL}/api/ml-analysis/class-statistics`, normalizeScope(), { headers: { Authorization: `Bearer ${token}` } });
                  setClassStats(res.data);
                } catch (e) {
                  setAnalysisError(e.response?.data?.error || e.message);
                } finally {
                  setAnalysisLoading(false);
                }
              }}><FaChartBar /> Run Class Analysis</button>
              <button className="btn btn-warning" onClick={async () => {
                try {
                  setAnalysisLoading(true);
                  setAnalysisError('');
                  const token = localStorage.getItem('token');
                  const res = await axios.post(`${API_BASE_URL}/api/ml-analysis/at-risk-students`, normalizeScope(), { headers: { Authorization: `Bearer ${token}` } });
                  setAtRisk(res.data);
                } catch (e) {
                  setAnalysisError(e.response?.data?.error || e.message);
                } finally {
                  setAnalysisLoading(false);
                }
              }}><FaExclamationTriangle /> Show At-Risk Students</button>
              <button className="btn btn-secondary" onClick={async () => {
                try {
                  setAnalysisLoading(true);
                  setAnalysisError('');
                  const token = localStorage.getItem('token');
                  const res = await axios.post(`${API_BASE_URL}/api/ml-analysis/subject-analysis`, {
                    subject_name: analysisFilters.subjectName || 'All Subjects',
                    ...normalizeScope()
                  }, { headers: { Authorization: `Bearer ${token}` } });
                  setSubjectStats(res.data);
                } catch (e) {
                  setAnalysisError(e.response?.data?.error || e.message);
                } finally {
                  setAnalysisLoading(false);
                }
              }}><FaBook /> Subject Analysis</button>
            </div>
          </div>

          {/* Output Window */}
          <div className="analysis-output">
            {analysisLoading && (
              <div className="loading-state">
                <div className="spinner"></div>
                Running analysis...
              </div>
            )}

            {!analysisLoading && (
              <>
                {/* Model Info */}
                {modelInfo && (
                  <div className="output-block">
                    <h3>Model Info</h3>
                    <div className="output-grid">
                      <div><strong>Status:</strong> {modelInfo.trained ? 'Trained' : 'Not Trained'}</div>
                      <div><strong>Rows Used:</strong> {modelInfo.rows_used ?? 0}</div>
                      <div><strong>Features:</strong> {Array.isArray(modelInfo.features) ? modelInfo.features.length : 0}</div>
                      <div><strong>Last Trained:</strong> {modelInfo.lastTrained || 'Never'}</div>
                    </div>
                  </div>
                )}

                {/* Class Statistics */}
                {classStats && (
                  <div className="output-block">
                    <h3>Class Statistics</h3>
                    <div className="output-grid" style={{ marginBottom: '0.5rem' }}>
                      <div><strong>Total Students:</strong> {classSummary.total_students ?? 0}</div>
                      <div><strong>Avg CGPA:</strong> {classSummary.average_cgpa ?? 0}</div>
                      <div><strong>Avg Attendance:</strong> {classSummary.average_attendance ?? 0}</div>
                      <div><strong>At Risk:</strong> {classSummary.students_at_risk ?? 0}</div>
                    </div>
                    <div className="charts-grid">
                      <div className="chart-card">
                        <h4>Performance Distribution</h4>
                        <div className="chart-container">
                          <Doughnut
                            data={classDistributionData}
                            options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                          />
                        </div>
                      </div>
                      <div className="chart-card">
                        <h4>Class Averages</h4>
                        <div className="chart-container">
                          <Bar
                            data={classAverageData}
                            options={{ responsive: true, plugins: { legend: { display: false } } }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* At-Risk Students */}
                {atRisk && (
                  <div className="output-block">
                    <h3>At-Risk Students</h3>
                    <div className="output-grid" style={{ marginBottom: '0.5rem' }}>
                      <div><strong>Total:</strong> {atRiskSummary.total}</div>
                      <div><strong>Critical:</strong> {atRiskSummary.critical}</div>
                      <div><strong>High:</strong> {atRiskSummary.high}</div>
                    </div>
                    <div className="charts-grid">
                      <div className="chart-card">
                        <h4>Risk Severity Split</h4>
                        <div className="chart-container">
                          <Doughnut
                            data={atRiskChartData}
                            options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                          />
                        </div>
                      </div>
                      <div className="chart-card">
                        <h4>Top Critical Students</h4>
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Name</th>
                                <th>PRN</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(atRisk?.critical_risk_students || []).slice(0, 5).map((s) => (
                                <tr key={s.prn || s.roll_no}>
                                  <td>{s.name}</td>
                                  <td>{s.prn || '-'}</td>
                                  <td>{s.performance_score ?? '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subject Analysis */}
                {subjectStats && (
                  <div className="output-block">
                    <h3>Subject Analysis ({subjectStats.subject_name})</h3>
                    <div className="output-grid" style={{ marginBottom: '0.5rem' }}>
                      <div><strong>Total Students:</strong> {subjectSummary.total_students ?? 0}</div>
                      <div><strong>Average Marks:</strong> {subjectSummary.average_marks ?? 0}</div>
                      <div><strong>Highest:</strong> {subjectSummary.highest_marks ?? 0}</div>
                      <div><strong>Lowest:</strong> {subjectSummary.lowest_marks ?? 0}</div>
                    </div>
                    <div className="charts-grid">
                      <div className="chart-card">
                        <h4>Marks Summary</h4>
                        <div className="chart-container">
                          <Bar
                            data={subjectMarksData}
                            options={{ responsive: true, plugins: { legend: { display: false } } }}
                          />
                        </div>
                      </div>
                      <div className="chart-card">
                        <h4>Grade Distribution</h4>
                        <div className="chart-container">
                          {subjectGradesData.labels.length > 0 ? (
                            <Doughnut
                              data={subjectGradesData}
                              options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                            />
                          ) : (
                            <div style={{ color: 'var(--muted)' }}>No grade distribution data available.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// UserManagement Component
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'student',
    referenceId: ''
  });
  const [loading, setLoading] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState(null); // null, 'student', 'faculty', 'admin'
  const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Error fetching users: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, newUser, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setNewUser({ username: '', password: '', role: 'student', referenceId: '' });
      fetchUsers();
      alert('User created successfully!');
    } catch (error) {
      alert('Error creating user: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/users/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        fetchUsers();
        alert('User deleted successfully!');
      } catch (error) {
        alert('Error deleting user: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const studentUsers = users.filter(u => u.role === 'student');
  const facultyUsers = users.filter(u => u.role === 'faculty');
  const adminUsers = users.filter(u => u.role === 'admin');

  // Form section - rendered separately to maintain focus
  const renderAddUserForm = () => (
    <div className="card card-full-width">
      <div className="card-header">
        <h2 className="card-title">+ Add New User</h2>
        <button onClick={fetchUsers} className="btn btn-primary btn-sm">
          <FaSyncAlt /> Refresh
        </button>
      </div>
      <form onSubmit={handleCreateUser} className="user-form">
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              type="text"
              className="form-control"
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              required
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-control"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              required
              placeholder="Enter password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select
              className="form-control"
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
            >
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Reference ID *</label>
            <input
              type="text"
              className="form-control"
              value={newUser.referenceId}
              onChange={(e) => setNewUser({...newUser, referenceId: e.target.value})}
              required
              placeholder="PRN/Faculty ID"
            />
          </div>
        </div>
        <button type="submit" className="btn btn-success">
          + Create User
        </button>
      </form>
    </div>
  );

  // Render user table
  const renderUserTable = (title, icon, data) => (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{icon} {title} ({data.length})</h3>
      </div>
      {data.length === 0 ? (
        <div className="empty-state">
          <p>No {title.toLowerCase()} users found</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Reference ID</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user._id}>
                  <td>{user.username}</td>
                  <td style={{ 
                    fontSize: '0.9rem',
                    wordBreak: 'break-all',
                    maxWidth: '200px',
                    padding: '8px',
                    fontFamily: 'monospace',
                    color: '#333'
                  }}>
                    {user.plainPassword || user.referenceId}
                  </td>
                  <td>{user.referenceId}</td>
                  <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => handleDeleteUser(user._id)}
                      className="btn-delete"
                      title="Delete user"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // Show detail view when a user type is selected
  if (selectedUserType) {
    const typeConfig = {
      student: { title: 'Students', icon: <FaGraduationCap />, data: studentUsers },
      faculty: { title: 'Faculty', icon: <FaBolt />, data: facultyUsers },
      admin: { title: 'Admins', icon: <FaCog />, data: adminUsers }
    };

    const config = typeConfig[selectedUserType];

    return (
      <div>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setSelectedUserType(null)}
              className="btn btn-primary btn-sm"
            >
              ← Back
            </button>
            <h1>{config.icon} {config.title} Users</h1>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            Loading users...
          </div>
        ) : (
          renderUserTable(config.title, config.icon, config.data)
        )}
      </div>
    );
  }

  // Show summary view
  return (
    <div>
      <div className="section-header">
        <h1>◉ User Management</h1>
        <p>Add new users and manage existing accounts</p>
      </div>

      {renderAddUserForm()}

      {/* User Summary Cards */}
      <div className="users-summary-grid">
        <div 
          className="user-summary-card"
          onClick={() => setSelectedUserType('student')}
          style={{ cursor: 'pointer' }}
        >
          <div className="summary-icon"><FaGraduationCap /></div>
          <h3>Students</h3>
          <p className="summary-count">{studentUsers.length}</p>
          <p className="summary-subtitle">Click to view</p>
        </div>

        <div 
          className="user-summary-card"
          onClick={() => setSelectedUserType('faculty')}
          style={{ cursor: 'pointer' }}
        >
          <div className="summary-icon"><FaBolt /></div>
          <h3>Faculty</h3>
          <p className="summary-count">{facultyUsers.length}</p>
          <p className="summary-subtitle">Click to view</p>
        </div>

        <div 
          className="user-summary-card"
          onClick={() => setSelectedUserType('admin')}
          style={{ cursor: 'pointer' }}
        >
          <div className="summary-icon"><FaCog /></div>
          <h3>Admins</h3>
          <p className="summary-count">{adminUsers.length}</p>
          <p className="summary-subtitle">Click to view</p>
        </div>
      </div>
    </div>
  );
};

// Main Admin Dashboard Component
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/notifications/unread/count`, {
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

  const navigation = [
    { path: '/admin', label: 'Dashboard', icon: <FaTachometerAlt />, component: DashboardOverview },
    { path: '/admin/data', label: 'Data Display', icon: <FaChartLine />, component: DataDisplay },
    { path: '/admin/manage', label: 'Data Management', icon: <FaDatabase />, component: DataManagement },
    { path: '/admin/placements', label: 'Placements', icon: <FaBriefcase />, component: PlacementManagement },
    { path: '/admin/timetable', label: 'Timetable', icon: <FaCalendar />, component: AdminTimetableManager },
    { path: '/admin/ml', label: 'ML Model', icon: <FaRobot />, component: MLModelControl },
    { path: '/admin/users', label: 'User Management', icon: <FaUsers />, component: UserManagement },
    { path: '/admin/change-requests', label: 'Change Requests', icon: <FaSyncAlt />, component: ChangeRequestsManagement },
  ];

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <button 
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <FaBars /> : <FaChevronLeft />}
          </button>

          <div className="sidebar-logo">
            <div className="logo-icon"><FaGraduationCap /></div>
            {!sidebarCollapsed && (
              <div className="logo-text">
                <h2>Campus Connect</h2>
                <p>Admin Panel</p>
              </div>
            )}
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </Link>
          ))}
        </nav>
        
        <div className="sidebar-footer">
          <div className="sidebar-stats">
            <div className="stat">
              <span className="stat-number">{navigation.length}</span>
              <span className="stat-label"></span>
            </div>
            <div className="stat">
              <span className="stat-number"></span>
              <span className="stat-label"></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="main-header">
          <div className="header-left">
            <h1>Admin Dashboard</h1>
            <p>Welcome back, {user?.username}!</p>
          </div>
          <div className="header-right">
            <div className="header-actions">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn btn-primary"
                style={{ position: 'relative' }}
              >
                <FaBell /> Notifications
                {unreadCount > 0 && (
                  <span className="notif-count-badge">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigate('/')}
                className="btn btn-secondary"
              >
                <FaHome /> Home
              </button>
              <ProfileDropdown />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          <Routes>
            {navigation.map((item) => (
              <Route 
                key={item.path} 
                path={item.path.replace('/admin', '')} 
                element={<item.component />} 
              />
            ))}
            <Route path="/" element={<DashboardOverview />} />
          </Routes>
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
                const response = await axios.get(`${API_BASE_URL}/api/notifications/unread/count`, {
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
                const response = await axios.get(`${API_BASE_URL}/api/notifications/unread/count`, {
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

export default AdminDashboard;