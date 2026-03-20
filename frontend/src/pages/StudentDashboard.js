import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';
import TimetableBoard from '../components/TimetableBoard';
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
  FaGraduationCap, FaChartLine, FaBook, FaClipboardList, FaCog, FaUser,
  FaBell, FaCheck, FaTimes, FaClock, FaFileAlt, FaDoorOpen, FaBars,
  FaChevronLeft, FaEdit, FaCalendar, FaBriefcase, FaHome, FaChartBar,
  FaCheckCircle, FaBullseye, FaClipboard, FaLock, FaQrcode
} from 'react-icons/fa';
import './StudentDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const AUTH_API_BASE_URL = process.env.REACT_APP_AUTH_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const AUTH_API_FALLBACK_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000`;
const localStorage = window.sessionStorage;

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
const ProfileDropdown = ({ onSettingsClick, onViewProfile }) => {
  const { user, logout, updateProfilePhoto } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const avatarSrc = user?.profilePhoto
    ? `${AUTH_API_FALLBACK_BASE_URL}${user.profilePhoto}`
    : '';

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
              <p className="role-badge student">Student</p>
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
              className="profile-btn"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              <FaEdit /> {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
            </button>
            <button 
              className="profile-btn"
              onClick={() => {
                setIsOpen(false);
                onViewProfile();
              }}
            >
              <FaUser /> View Profile
            </button>
            <button 
              className="profile-btn"
              onClick={() => {
                setIsOpen(false);
                onSettingsClick();
              }}
            >
              <FaCog /> Settings
            </button>
            <button onClick={logout} className="profile-btn logout">
              <FaDoorOpen /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [fullAnalysis, setFullAnalysis] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentForms, setAssignmentForms] = useState({});
  const [assignmentStatus, setAssignmentStatus] = useState({});
  const [studentTimetable, setStudentTimetable] = useState(null);
  const [studentTimetableEntries, setStudentTimetableEntries] = useState([]);
  const [studentTimetableLoading, setStudentTimetableLoading] = useState(false);
  const [scanSessionCode, setScanSessionCode] = useState('');
  const [attendanceScanStatus, setAttendanceScanStatus] = useState('');
  const [lastPresenceRequest, setLastPresenceRequest] = useState(null);
  const [presenceSessionInfo, setPresenceSessionInfo] = useState(null);
  const [sendingPresenceRequest, setSendingPresenceRequest] = useState(false);
  const [pastPlacements, setPastPlacements] = useState([]);
  const [pastPlacementsLoading, setPastPlacementsLoading] = useState(false);
  
  // Settings Modal States
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile'); // 'profile' or 'password'
  const [profileChangeForm, setProfileChangeForm] = useState({});
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [submitStatus, setSubmitStatus] = useState('');

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

  useEffect(() => {
    fetchStudentData();
  }, []);

  useEffect(() => {
    if (activeTab === 'Courses') {
      fetchCourses();
    }
    if (activeTab === 'Assignments') {
      fetchAssignments();
    }
    if (activeTab === 'Schedule') {
      fetchStudentTimetable();
    }
    if (activeTab === 'Placements') {
      fetchPastPlacements();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'AttendanceScan') return undefined;
    if (!scanSessionCode || !lastPresenceRequest) return undefined;

    const interval = setInterval(() => {
      fetchPresenceRequestStatus(scanSessionCode);
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, scanSessionCode, lastPresenceRequest?._id]);

  const fetchStudentTimetable = async () => {
    try {
      setStudentTimetableLoading(true);
      const token = localStorage.getItem('token');
      const params = {};
      if (studentData?.batch) {
        params.batch = studentData.batch;
      }

      const response = await axios.get(`${API_BASE_URL}/api/student/timetable`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      setStudentTimetable(response.data.timetable || null);
      setStudentTimetableEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching student timetable:', error);
      setStudentTimetable(null);
      setStudentTimetableEntries([]);
    } finally {
      setStudentTimetableLoading(false);
    }
  };

  const handleOpenSettings = () => {
    // Initialize profile change form with current data
    if (studentData) {
      setProfileChangeForm({
        studentName: studentData.studentName || '',
        email: studentData.email || '',
        mobileNo: studentData.mobileNo || '',
        address: studentData.address || ''
      });
    }
    setShowSettingsModal(true);
  };

  const handleViewProfile = () => {
    setShowProfileDetails(true);
    setActiveTab('Dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProfileChangeRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmitStatus('Submitting...');
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_BASE_URL}/api/change-requests/profile`,
        {
          studentPRN: user.referenceId,
          requestedBy: user.username,
          changeType: 'profile',
          currentData: {
            studentName: studentData.studentName,
            email: studentData.email,
            mobileNo: studentData.mobileNo,
            address: studentData.address
          },
          requestedData: profileChangeForm
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setSubmitStatus('[OK] Profile change request submitted! Waiting for admin approval.');
      setTimeout(() => {
        setSubmitStatus('');
        setShowSettingsModal(false);
      }, 3000);
    } catch (error) {
      console.error('Profile change request error:', error);
      setSubmitStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handlePasswordChangeRequest = async (e) => {
    e.preventDefault();
    
    // Validate passwords
    if (passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword) {
      setSubmitStatus('[ERR] New passwords do not match!');
      return;
    }

    if (passwordChangeForm.newPassword.length < 6) {
      setSubmitStatus('[ERR] Password must be at least 6 characters long!');
      return;
    }

    try {
      setSubmitStatus('Submitting...');
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_BASE_URL}/api/change-requests/password`,
        {
          studentPRN: user.referenceId,
          requestedBy: user.username,
          changeType: 'password',
          currentPassword: passwordChangeForm.currentPassword,
          newPassword: passwordChangeForm.newPassword
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setSubmitStatus('[OK] Password change request submitted! Waiting for admin approval.');
      setPasswordChangeForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => {
        setSubmitStatus('');
        setShowSettingsModal(false);
      }, 3000);
    } catch (error) {
      console.error('Password change request error:', error);
      setSubmitStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!user?.referenceId) {
        console.error('No student PRN found in user data');
        setMockData();
        setLoading(false);
        return;
      }

      // Fetch specific student profile using their PRN
      const profileResponse = await axios.get(
        `${API_BASE_URL}/api/students/${user.referenceId}/profile`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      const { student, summary } = profileResponse.data;

      if (student) {
        setStudentData(student);
        
        // Set actual semester marks
        if (student.semesterMarks && student.semesterMarks.length > 0) {
          setMarks(student.semesterMarks);
        }
        
        // Fetch ML analysis from backend by PRN
        let mlPayload = null;
        try {
          const mlResponse = await axios.get(
            `${API_BASE_URL}/api/ml-analysis/student-prn/${student.prn}`,
            {
              headers: { 'Authorization': `Bearer ${token}` }
            }
          );
          mlPayload = mlResponse.data;
        } catch (mlError) {
          console.error('ML analysis fetch failed:', mlError.message);
        }

        // Fetch full analysis payload for direct dashboard visibility
        try {
          if (student._id) {
            const fullAnalysisResponse = await axios.get(
              `${API_BASE_URL}/api/ml-analysis/student/${student._id}/full-analysis`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            );
            setFullAnalysis(fullAnalysisResponse.data || null);
          }
        } catch (fullAnalysisError) {
          console.error('Full analysis fetch failed:', fullAnalysisError.message);
          setFullAnalysis(mlPayload || null);
        }

        const performanceDetails = mlPayload?.individual?.performance || null;
        const subjectAnalysis = mlPayload?.subjects?.subject_wise_analysis || {};

        const flattenedSubjects = Object.values(subjectAnalysis || {})
          .flat()
          .map((sub) => ({
            subject: sub.subject_name || 'Subject',
            prediction: sub.performance_rating || 'Average',
            confidence: Number(sub.subject_score || 0)
          }));

        setPerformance({
          predictions: flattenedSubjects.length > 0
            ? flattenedSubjects
            : [
                { subject: 'Academic Performance', prediction: performanceDetails?.performance_category || 'Average', confidence: Number(performanceDetails?.overall_performance_score || 50) }
              ],
          overall: (performanceDetails?.performance_category || 'Average'),
          cgpa: student.cgpa || summary.cgpa || 0,
          attendance: summary.attendance || 0,
          riskLevel: performanceDetails?.risk_level || 'Medium Risk',
          recommendations: performanceDetails?.recommendations || []
        });

        // Use actual attendance data if available
        const attendanceBySubject = student.attendance?.length > 0
          ? student.attendance[0].subjects || []
          : [];

        setAttendance({
          overall: summary.attendance || 0,
          bySubject: attendanceBySubject.length > 0 
            ? attendanceBySubject.map(sub => ({
                subject: sub.subjectName,
                attended: sub.attendedClasses,
                total: sub.totalClasses,
                percentage: ((sub.attendedClasses / sub.totalClasses) * 100).toFixed(1)
              }))
            : [
                { subject: 'Data Structures', attended: 45, total: 50, percentage: 90 },
                { subject: 'Algorithms', attended: 42, total: 50, percentage: 84 },
                { subject: 'Database Systems', attended: 48, total: 50, percentage: 96 },
                { subject: 'Operating Systems', attended: 38, total: 50, percentage: 76 },
                { subject: 'Computer Networks', attended: 44, total: 50, percentage: 88 },
                { subject: 'Software Engineering', attended: 46, total: 50, percentage: 92 }
              ]
        });
      } else {
        setMockData();
      }
    } catch (error) {
      console.error('Error fetching student data:', error);
      console.error('Error details:', error.response?.data);
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
      const response = await axios.get(`${API_BASE_URL}/api/courses`, {
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
      const response = await axios.get(`${API_BASE_URL}/api/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setAssignments(response.data.assignments || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const fetchPastPlacements = async () => {
    try {
      setPastPlacementsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/placement-showcase`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 20 }
      });
      setPastPlacements(Array.isArray(response.data?.placements) ? response.data.placements : []);
    } catch (error) {
      console.error('Error fetching past placements:', error);
      setPastPlacements([]);
    } finally {
      setPastPlacementsLoading(false);
    }
  };

  const handleAssignmentFieldChange = (assignmentId, field, value) => {
    setAssignmentForms((prev) => ({
      ...prev,
      [assignmentId]: {
        ...prev[assignmentId],
        [field]: value
      }
    }));
  };

  const handleSubmitAssignment = async (assignmentId) => {
    try {
      setAssignmentStatus((prev) => ({ ...prev, [assignmentId]: 'Submitting...' }));
      const token = localStorage.getItem('token');
      const form = assignmentForms[assignmentId] || {};

      if (!form.file) {
        setAssignmentStatus((prev) => ({ ...prev, [assignmentId]: '❌ Please attach a PDF file' }));
        return;
      }

      const formData = new FormData();
      formData.append('submissionText', form.submissionText || '');
      formData.append('file', form.file);

      const response = await axios.post(
        `${API_BASE_URL}/api/assignments/${assignmentId}/submissions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setAssignmentStatus((prev) => ({ ...prev, [assignmentId]: '✅ Submitted' }));
      setAssignments((prev) => prev.map(a =>
        a._id === assignmentId ? { ...a, mySubmission: response.data.submission } : a
      ));
    } catch (error) {
      console.error('Error submitting assignment:', error);
      setAssignmentStatus((prev) => ({ ...prev, [assignmentId]: '❌ Submit failed' }));
    }
  };

  const fetchPresenceRequestStatus = async (sessionCodeArg) => {
    const targetCode = String(sessionCodeArg || scanSessionCode || '').trim().toUpperCase();
    if (!targetCode) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/attendance-sessions/${targetCode}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setPresenceSessionInfo(response.data?.session || null);
      setLastPresenceRequest(response.data?.request || null);

      const requestStatus = response.data?.request?.status;
      if (requestStatus === 'approved') {
        setAttendanceScanStatus('[OK] Attendance approved by faculty.');
      } else if (requestStatus === 'rejected') {
        setAttendanceScanStatus('[ERR] Attendance request rejected by faculty.');
      } else {
        setAttendanceScanStatus('Request sent. Show this screen to faculty for verification.');
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        setAttendanceScanStatus('[ERR] ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleSendPresenceRequest = async () => {
    const normalizedCode = String(scanSessionCode || '').trim().toUpperCase();

    if (!normalizedCode) {
      setAttendanceScanStatus('[ERR] Enter the session code from the faculty QR.');
      return;
    }

    try {
      setSendingPresenceRequest(true);
      setAttendanceScanStatus('Sending presence request...');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/api/attendance-sessions/${normalizedCode}/request`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setScanSessionCode(normalizedCode);
      setLastPresenceRequest(response.data?.request || null);
      setPresenceSessionInfo({ sessionCode: normalizedCode, subjectName: 'Attendance Session' });
      setAttendanceScanStatus(response.data?.message || 'Request sent. Show this screen to faculty.');
      await fetchPresenceRequestStatus(normalizedCode);
    } catch (error) {
      setAttendanceScanStatus('[ERR] ' + (error.response?.data?.message || error.message));
    } finally {
      setSendingPresenceRequest(false);
    }
  };

  const setMockData = () => {
    setStudentData({
      prn: user?.referenceId || 'PRN2023001',
      rollNo: user?.referenceId || 'CS202301',
      studentName: user?.username || 'Student',
      year: 'Third',
      branch: 'Computer Science',
      division: 'A',
      email: user?.username ? `${user.username}@college.edu` : 'student@college.edu',
      mobileNo: 'N/A',
      cgpa: 0
    });

    setPerformance({
      predictions: [
        { subject: 'Data Structures', prediction: 'Excellent', confidence: 87 },
        { subject: 'Algorithms', prediction: 'Good', confidence: 78 },
        { subject: 'Database Systems', prediction: 'Excellent', confidence: 92 },
        { subject: 'Operating Systems', prediction: 'Average', confidence: 65 }
      ],
      overall: 'Good',
      cgpa: 8.5,
      attendance: 85
    });

    setFullAnalysis(null);

    setAttendance({
      overall: 85,
      bySubject: [
        { subject: 'Data Structures', attended: 45, total: 50, percentage: 90 },
        { subject: 'Algorithms', attended: 42, total: 50, percentage: 84 },
        { subject: 'Database Systems', attended: 48, total: 50, percentage: 96 },
        { subject: 'Operating Systems', attended: 38, total: 50, percentage: 76 }
      ]
    });
  };

  // Chart data
  // Read CSS variables at runtime so chart colors follow theme
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

  const performanceData = {
    labels: performance?.predictions.map(p => p.subject) || [],
    datasets: [
      {
        label: 'Confidence Score',
        data: performance?.predictions.map(p => p.confidence) || [],
        backgroundColor: [
          primary,
          success,
          primary,
          warning,
          success,
          primary
        ],
        borderWidth: 2,
        borderColor: cardBg
      }
    ]
  };

  const attendanceData = {
    labels: attendance?.bySubject.map(a => a.subject) || [],
    datasets: [
      {
        label: 'Attendance %',
        data: attendance?.bySubject.map(a => a.percentage) || [],
        borderColor: success,
        backgroundColor: `rgba(${hexToRgb(success)}, 0.12)`,
        tension: 0.4,
        fill: true
      }
    ]
  };

  const fullPerf = fullAnalysis?.individual?.performance || {};
  const fullTrend = Array.isArray(fullAnalysis?.improvement?.trend_data) ? fullAnalysis.improvement.trend_data : [];
  const fullSubjectRows = Object.values(fullAnalysis?.subjects?.subject_wise_analysis || {})
    .flat()
    .filter(Boolean);
  const topFullSubjects = [...fullSubjectRows]
    .sort((a, b) => Number(b.total_marks || 0) - Number(a.total_marks || 0))
    .slice(0, 8);

  const fullPerformanceChartData = {
    labels: ['Overall', 'Attendance', 'Subject', 'Improvement', 'Consistency'],
    datasets: [
      {
        label: 'Score',
        data: [
          Number(fullPerf?.overall_performance_score || 0),
          Number(fullPerf?.attendance_score || 0),
          Number(fullPerf?.subject_performance_score || 0),
          Number(fullPerf?.improvement_trend || 0),
          Number(fullPerf?.consistency_score || 0)
        ],
        backgroundColor: [primary, success, '#9b59b6', warning, '#2c3e50']
      }
    ]
  };

  const fullPlacementChartData = {
    labels: ['Placement Probability', 'Remaining'],
    datasets: [
      {
        data: [
          Number(fullPerf?.placement_probability || 0),
          Math.max(0, 100 - Number(fullPerf?.placement_probability || 0))
        ],
        backgroundColor: [success, '#dfe6e9']
      }
    ]
  };

  const fullTrendChartData = {
    labels: fullTrend.map((point) => `Sem ${point.semester}`),
    datasets: [
      {
        label: 'SGPA',
        data: fullTrend.map((point) => Number(point.sgpa || 0)),
        borderColor: primary,
        backgroundColor: `rgba(${hexToRgb(primary)}, 0.15)`,
        fill: true,
        tension: 0.25
      }
    ]
  };

  const fullSubjectChartData = {
    labels: topFullSubjects.map((sub) => sub.subject_name || sub.subject_code || 'Subject'),
    datasets: [
      {
        label: 'Marks',
        data: topFullSubjects.map((sub) => Number(sub.total_marks || 0)),
        backgroundColor: '#8e44ad'
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
    <div className={`student-dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Sidebar */}
  <div className="sidebar">
        <div className="sidebar-header">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <FaBars /> : <FaChevronLeft />}
          </button>
          <div className="sidebar-logo">
            <div className="logo-icon"><FaGraduationCap /></div>
            <div className="logo-text">
              <h2>Campus Connect</h2>
              <p>Student Portal</p>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav" aria-label="Student navigation">
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Dashboard');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Dashboard');
              }
            }}
          ><span className="nav-icon"><FaChartLine /></span><span className="nav-label">Dashboard</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Courses' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Courses');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Courses');
              }
            }}
          ><span className="nav-icon"><FaBook /></span><span className="nav-label">My Courses</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Assignments' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Assignments');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Assignments');
              }
            }}
          ><span className="nav-icon"><FaEdit /></span><span className="nav-label">Assignments</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Schedule' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Schedule');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Schedule');
              }
            }}
          ><span className="nav-icon"><FaCalendar /></span><span className="nav-label">Schedule</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'AttendanceScan' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('AttendanceScan');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('AttendanceScan');
              }
            }}
          ><span className="nav-icon"><FaQrcode /></span><span className="nav-label">Scan Attendance</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Placements' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Placements');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Placements');
              }
            }}
          ><span className="nav-icon"><FaBriefcase /></span><span className="nav-label">Placements</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Results' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Results');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Results');
              }
            }}
          ><span className="nav-icon"><FaFileAlt /></span><span className="nav-label">Results</span></a>
        </nav>
        
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="main-header">
          <div className="header-left">
            <h1>Student Dashboard</h1>
            <p>Welcome back, {studentData?.studentName || user?.username}!</p>
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
              <ProfileDropdown onSettingsClick={handleOpenSettings} onViewProfile={handleViewProfile} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {/* Render different content depending on activeTab */}
          {activeTab === 'Dashboard' ? (
            <>
              {/* Statistics Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon"><FaChartBar /></div>
                  <div className="stat-info">
                    <h3>{performance?.cgpa || '8.5'}</h3>
                    <p>Current CGPA</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><FaCheckCircle /></div>
                  <div className="stat-info">
                    <h3>{attendance?.overall || '85'}%</h3>
                    <p>Overall Attendance</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><FaClipboardList /></div>
                  <div className="stat-info">
                    <h3>6</h3>
                    <p>Subjects</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-info">
                    <h3>{performance?.overall || 'Good'}</h3>
                    <p>Performance</p>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="charts-grid">
                <div className="chart-card">
                  <h3>Subject-wise Performance</h3>
                  <div className="chart-container">
                    <Bar 
                      data={performanceData}
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
                <div className="chart-card">
                  <h3>Attendance Trend</h3>
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

              {/* Performance Predictions */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><FaCog /> AI Performance Predictions</h2>
                </div>
                <div className="card-body">
                  <div className="overall-prediction">
                    <h3>Overall Performance: 
                      <span className={`prediction ${performance?.overall.toLowerCase()}`}>
                        {performance?.overall}
                      </span>
                    </h3>
                    <p>Based on your attendance, marks, and study patterns</p>
                    {performance?.riskLevel && (
                      <p><strong>Risk Level:</strong> {performance.riskLevel}</p>
                    )}
                  </div>

                  {Array.isArray(performance?.recommendations) && performance.recommendations.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4>Recommendations</h4>
                      <ul>
                        {performance.recommendations.slice(0, 4).map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="predictions-grid">
                    {performance?.predictions.map((item, index) => (
                      <div key={index} className="prediction-card">
                        <h4>{item.subject}</h4>
                        <div className="prediction-details">
                          <div className={`prediction-badge ${item.prediction.toLowerCase()}`}>
                            {item.prediction}
                          </div>
                          <div className="confidence">
                            <span className="confidence-value">{item.confidence}%</span>
                            <span className="confidence-label">Confidence</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Attendance Details */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><FaBullseye /> Full Analysis Overview</h2>
                </div>
                <div className="card-body">
                  {fullAnalysis ? (
                    <>
                      <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                        <div className="stat-card">
                          <div className="stat-icon"><FaChartLine /></div>
                          <div className="stat-info">
                            <h3>{fullAnalysis?.individual?.performance?.overall_performance_score ?? 'N/A'}</h3>
                            <p>Overall Score</p>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon"><FaClipboard /></div>
                          <div className="stat-info">
                            <h3>{fullAnalysis?.individual?.performance?.performance_category || 'N/A'}</h3>
                            <p>Category</p>
                          </div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-icon"><FaLock /></div>
                          <div className="stat-info">
                            <h3>{fullAnalysis?.individual?.performance?.risk_level || 'N/A'}</h3>
                            <p>Risk Level</p>
                          </div>
                        </div>
                      </div>

                      {Array.isArray(fullAnalysis?.individual?.performance?.recommendations) && fullAnalysis.individual.performance.recommendations.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <h4>Personalized Recommendations</h4>
                          <ul>
                            {fullAnalysis.individual.performance.recommendations.slice(0, 6).map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="charts-grid" style={{ marginBottom: '1rem' }}>
                        <div className="chart-card">
                          <h3>Performance Components</h3>
                          <div className="chart-container">
                            <Bar
                              data={fullPerformanceChartData}
                              options={{ responsive: true, plugins: { legend: { display: false } } }}
                            />
                          </div>
                        </div>
                        <div className="chart-card">
                          <h3>Placement Probability</h3>
                          <div className="chart-container">
                            <Doughnut
                              data={fullPlacementChartData}
                              options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="charts-grid">
                        <div className="chart-card">
                          <h3>Semester SGPA Trend</h3>
                          <div className="chart-container">
                            {fullTrendChartData.labels.length > 0 ? (
                              <Line
                                data={fullTrendChartData}
                                options={{ responsive: true, plugins: { legend: { display: false } } }}
                              />
                            ) : (
                              <p style={{ color: 'var(--text-secondary)' }}>No semester trend available.</p>
                            )}
                          </div>
                        </div>
                        <div className="chart-card">
                          <h3>Top Subject Scores</h3>
                          <div className="chart-container">
                            {fullSubjectChartData.labels.length > 0 ? (
                              <Bar
                                data={fullSubjectChartData}
                                options={{ responsive: true, plugins: { legend: { display: false } } }}
                              />
                            ) : (
                              <p style={{ color: 'var(--text-secondary)' }}>No subject score data available.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-secondary)' }}>Detailed analysis is not available yet. Please try again in a moment.</p>
                  )}
                </div>
              </div>

              {/* Attendance Details */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><FaCalendar /> Attendance Details</h2>
                </div>
                <div className="card-body">
                  <div className="attendance-table">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Attended</th>
                          <th>Total</th>
                          <th>Percentage</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendance?.bySubject.map((item, index) => (
                          <tr key={index}>
                            <td>{item.subject}</td>
                            <td>{item.attended}</td>
                            <td>{item.total}</td>
                            <td>
                              <div className="percentage-bar">
                                <div 
                                  className="percentage-fill"
                                  style={{ width: `${item.percentage}%` }}
                                >
                                  {item.percentage}%
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className={`attendance-status ${item.percentage >= 75 ? 'good' : 'warning'}`}>
                                {item.percentage >= 75 ? 'Good' : 'Needs Improvement'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="quick-actions-section">
                <h3>Quick Actions</h3>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => setActiveTab('Schedule')}>
                    <span className="action-icon"><FaEdit /></span>
                    <span>View TimeTable</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('AttendanceScan')}>
                    <span className="action-icon"><FaQrcode /></span>
                    <span>Scan Attendance QR</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('Results')}>
                    <span className="action-icon"><FaClipboard /></span>
                    <span>Check Results</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('Placements')}>
                    <span className="action-icon"><FaBriefcase /></span>
                    <span>Placement Cell</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('Courses')}>
                    <span className="action-icon"><FaBook /></span>
                    <span>Study Materials</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Placeholder / Tab content for non-dashboard tabs */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">{activeTab}</h2>
                </div>
                <div className="card-body">
                  {/* Example lightweight content for a few tabs */}
                  {activeTab === 'Courses' && (
                    <div>
                      {coursesLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <div className="spinner"></div>
                          Loading courses...
                        </div>
                      ) : courses.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                          <p>No courses assigned yet.</p>
                        </div>
                      ) : (
                        <div className="subjects-grid">
                          {courses.map((course) => (
                            <div key={course._id} className="subject-card">
                              <h4>{course.title}</h4>
                              <p className="stat-label">Code: {course.code}</p>
                              <p className="stat-label">Year: {course.year} | Branch: {course.branch} | Div: {course.division}</p>
                              {course.description && (
                                <p className="stat-label">{course.description}</p>
                              )}
                              {course.attachmentUrl && (
                                <a
                                  href={`${API_BASE_URL}${course.attachmentUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="stat-label"
                                >
                                  <FaFileAlt /> View Course PDF
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Assignments' && (
                    <div>
                      {assignmentsLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <div className="spinner"></div>
                          Loading assignments...
                        </div>
                      ) : assignments.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                          <p>No assignments yet.</p>
                        </div>
                      ) : (
                        <div className="predictions-grid">
                          {assignments.map((assignment) => (
                            <div key={assignment._id} className="prediction-card" style={{ textAlign: 'left' }}>
                              <h4>{assignment.title}</h4>
                              <p className="confidence-label">Due: {new Date(assignment.dueDate).toLocaleString()}</p>
                              {assignment.description && (
                                <p className="confidence-label">{assignment.description}</p>
                              )}
                              {assignment.attachmentUrl && (
                                <a
                                  href={`${API_BASE_URL}${assignment.attachmentUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="confidence-label"
                                >
                                  <FaFileAlt /> Download Assignment PDF
                                </a>
                              )}

                              {assignment.mySubmission ? (
                                <div style={{ marginTop: '0.75rem', color: 'var(--success)' }}>
                                  <FaCheckCircle /> Submitted on {new Date(assignment.mySubmission.submittedAt).toLocaleString()}
                                </div>
                              ) : (
                                <div style={{ marginTop: '1rem' }}>
                                  <textarea
                                    className="form-control"
                                    rows="3"
                                    placeholder="Write your submission message or link..."
                                    value={assignmentForms[assignment._id]?.submissionText || ''}
                                    onChange={(e) => handleAssignmentFieldChange(assignment._id, 'submissionText', e.target.value)}
                                  />
                                  <input
                                    type="file"
                                    className="form-control"
                                    style={{ marginTop: '0.5rem' }}
                                    accept="application/pdf"
                                    onChange={(e) => handleAssignmentFieldChange(assignment._id, 'file', e.target.files?.[0] || null)}
                                  />
                                  <button
                                    className="btn btn-primary"
                                    style={{ marginTop: '0.75rem' }}
                                    onClick={() => handleSubmitAssignment(assignment._id)}
                                  >
                                    Submit Assignment
                                  </button>
                                  {assignmentStatus[assignment._id] && (
                                    <div style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
                                      {assignmentStatus[assignment._id]}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Schedule' && (
                    <div>
                      {studentTimetableLoading ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div className="spinner"></div>
                        </div>
                      ) : (
                        <TimetableBoard
                          timetable={studentTimetable}
                          entries={studentTimetableEntries}
                          title="My Weekly Schedule"
                          subtitle="Filtered by your class/division/batch"
                          highlightCurrent
                          allowPrint
                          allowExport
                        />
                      )}
                    </div>
                  )}

                  {activeTab === 'AttendanceScan' && (
                    <div>
                      <h3 style={{ marginBottom: '1rem' }}><FaQrcode /> Scan & Verify Attendance</h3>
                      <p className="confidence-label" style={{ marginBottom: '1rem' }}>
                        Scan the faculty QR in your app and enter the session code (or paste it) to send your presence request.
                      </p>

                      <div className="form-row">
                        <div className="form-group" style={{ maxWidth: '320px' }}>
                          <label>Session Code *</label>
                          <input
                            className="form-control"
                            placeholder="e.g. A1B2C3"
                            value={scanSessionCode}
                            onChange={(e) => setScanSessionCode(String(e.target.value || '').toUpperCase())}
                            maxLength={12}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={handleSendPresenceRequest} disabled={sendingPresenceRequest}>
                          {sendingPresenceRequest ? 'Sending...' : 'Send Presence Request'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => fetchPresenceRequestStatus(scanSessionCode)}>
                          Refresh Request Status
                        </button>
                      </div>

                      {attendanceScanStatus && (
                        <p className="confidence-label" style={{ marginTop: '0.85rem' }}>{attendanceScanStatus}</p>
                      )}

                      {lastPresenceRequest && (
                        <div className="card" style={{ marginTop: '1rem' }}>
                          <div className="card-header">
                            <h2 className="card-title">Request Sent</h2>
                          </div>
                          <div className="card-body">
                            <p className="confidence-label"><strong>Name:</strong> {studentData?.studentName || user?.username}</p>
                            <p className="confidence-label"><strong>PRN:</strong> {studentData?.prn || user?.referenceId}</p>
                            <p className="confidence-label"><strong>Session Code:</strong> {presenceSessionInfo?.sessionCode || scanSessionCode}</p>
                            <p className="confidence-label"><strong>Status:</strong> {String(lastPresenceRequest.status || 'pending').toUpperCase()}</p>
                            <p className="confidence-label"><strong>Requested At:</strong> {new Date(lastPresenceRequest.requestedAt || Date.now()).toLocaleString()}</p>
                            <p className="confidence-label" style={{ marginTop: '0.75rem' }}>
                              Show this screen to the faculty for identity verification.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'Placements' && (
                    <div>
                      <div className="stat-card" style={{ maxWidth: 520 }}>
                        <div className="stat-icon"><FaBriefcase /></div>
                        <div className="stat-info">
                          <h3>Placement Status: {studentData?.placementStatus || 'Not Eligible'}</h3>
                          <p className="confidence-label">
                            Company: {studentData?.companyName || 'Not assigned'}
                          </p>
                          <p className="confidence-label">
                            Package (LPA): {studentData?.package ?? 'N/A'}
                          </p>
                          <p className="confidence-label">
                            Offer Date: {studentData?.offerLetterDate ? new Date(studentData.offerLetterDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="card" style={{ marginTop: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title"><FaBriefcase /> Past Placed Students</h2>
                        </div>
                        <div className="card-body">
                          {pastPlacementsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}><div className="spinner"></div></div>
                          ) : pastPlacements.length === 0 ? (
                            <p style={{ color: 'var(--muted)' }}>No past placement records available.</p>
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
                                    <th>Package (LPA)</th>
                                    <th>Placed Year</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pastPlacements.map((entry) => (
                                    <tr key={entry._id}>
                                      <td>{entry.studentName}</td>
                                      <td>{entry.year}</td>
                                      <td>{entry.branch}</td>
                                      <td>{entry.companyName}</td>
                                      <td>{entry.role || '-'}</td>
                                      <td>{entry.packageLpa ?? '-'}</td>
                                      <td>{entry.placedYear}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'Results' && (
                    <div>
                      {marks.length > 0 ? (
                        <div className="results-section">
                          {marks.map((semesterMark, idx) => (
                            <div key={idx} className="semester-result" style={{ marginBottom: '2rem' }}>
                              <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>
                                {semesterMark.year} Year - Semester {semesterMark.semester}
                                {semesterMark.academicYear && ` (${semesterMark.academicYear})`}
                              </h3>
                              
                              {/* Semester Summary */}
                              <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                                <div className="stat-card">
                                  <div className="stat-icon"><FaChartBar /></div>
                                  <div className="stat-info">
                                    <h3>{semesterMark.sgpa || 'N/A'}</h3>
                                    <p>SGPA</p>
                                  </div>
                                </div>
                                <div className="stat-card">
                                  <div className="stat-icon"><FaChartLine /></div>
                                  <div className="stat-info">
                                    <h3>{semesterMark.cgpa || studentData?.cgpa || 'N/A'}</h3>
                                    <p>CGPA</p>
                                  </div>
                                </div>
                                <div className="stat-card">
                                  <div className="stat-icon"><FaCheckCircle /></div>
                                  <div className="stat-info">
                                    <h3>{semesterMark.status || 'Pass'}</h3>
                                    <p>Status</p>
                                  </div>
                                </div>
                                <div className="stat-card">
                                  <div className="stat-icon"><FaBullseye /></div>
                                  <div className="stat-info">
                                    <h3>{semesterMark.totalCredits || 'N/A'}</h3>
                                    <p>Credits</p>
                                  </div>
                                </div>
                              </div>

                              {/* Marks Summary */}
                              {(semesterMark.internalTotal || semesterMark.externalTotal) && (
                                <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                  {semesterMark.internalTotal && (
                                    <div style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)' }}>Internal Marks</p>
                                      <h4 style={{ margin: '0.5rem 0 0 0', color: 'var(--text)' }}>
                                        {semesterMark.internalTotal} ({semesterMark.internalPercentage?.toFixed(2)}%)
                                      </h4>
                                    </div>
                                  )}
                                  {semesterMark.externalTotal && (
                                    <div style={{ padding: '1rem', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--muted)' }}>External Marks</p>
                                      <h4 style={{ margin: '0.5rem 0 0 0', color: 'var(--text)' }}>
                                        {semesterMark.externalTotal} ({semesterMark.externalPercentage?.toFixed(2)}%)
                                      </h4>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Subject-wise Results */}
                              {semesterMark.subjects && semesterMark.subjects.length > 0 && (
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Subject Code</th>
                                      <th>Subject Name</th>
                                      <th>Internal</th>
                                      <th>External</th>
                                      <th>Total</th>
                                      <th>Credits</th>
                                      <th>Grade</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {semesterMark.subjects.map((subject, subIdx) => (
                                      <tr key={subIdx}>
                                        <td>{subject.subjectCode || 'N/A'}</td>
                                        <td>{subject.subjectName || 'N/A'}</td>
                                        <td>{subject.internalMarks ?? '-'}</td>
                                        <td>{subject.externalMarks ?? '-'}</td>
                                        <td><strong>{subject.totalMarks ?? '-'}</strong></td>
                                        <td>{subject.credits ?? '-'}</td>
                                        <td>
                                          <span className={`prediction-badge ${subject.grade?.toLowerCase() || 'default'}`}>
                                            {subject.grade || 'N/A'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><FaClipboard /></div>
                          <h3>No Results Available</h3>
                          <p>Your semester results will appear here once they are published.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showProfileDetails && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '1rem'
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '760px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title"><FaUser /> Student Profile</h2>
              <button className="btn btn-secondary" onClick={() => setShowProfileDetails(false)}><FaTimes /></button>
            </div>
            <div className="card-body">
              {studentData && (
                <div className="profile-grid">
                  <div className="profile-item">
                    <label>Name:</label>
                    <span>{studentData.studentName}</span>
                  </div>
                  <div className="profile-item">
                    <label>PRN:</label>
                    <span>{studentData.prn}</span>
                  </div>
                  <div className="profile-item">
                    <label>Roll No:</label>
                    <span>{studentData.rollNo}</span>
                  </div>
                  <div className="profile-item">
                    <label>Year:</label>
                    <span className={`year-badge ${studentData.year.toLowerCase()}`}>
                      {studentData.year} Year
                    </span>
                  </div>
                  <div className="profile-item">
                    <label>Branch:</label>
                    <span>{studentData.branch}</span>
                  </div>
                  <div className="profile-item">
                    <label>Division:</label>
                    <span>{studentData.division}</span>
                  </div>
                  <div className="profile-item">
                    <label>Email:</label>
                    <span>{studentData.email}</span>
                  </div>
                  <div className="profile-item">
                    <label>Mobile:</label>
                    <span>{studentData.mobileNo}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3><FaCog /> Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="btn-close">×</button>
            </div>
            
            {/* Settings Tabs */}
            <div className="settings-tabs" style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: '1.5rem' }}>
              <button
                className={`settings-tab ${settingsTab === 'profile' ? 'active' : ''}`}
                onClick={() => setSettingsTab('profile')}
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: 'none',
                  background: settingsTab === 'profile' ? 'var(--primary)' : 'transparent',
                  color: settingsTab === 'profile' ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.3s'
                }}
              >
                <FaUser /> Profile Details
              </button>
              <button
                className={`settings-tab ${settingsTab === 'password' ? 'active' : ''}`}
                onClick={() => setSettingsTab('password')}
                style={{
                  flex: 1,
                  padding: '1rem',
                  border: 'none',
                  background: settingsTab === 'password' ? 'var(--primary)' : 'transparent',
                  color: settingsTab === 'password' ? '#fff' : 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.3s'
                }}
              >
                <FaLock /> Change Password
              </button>
            </div>

            <div className="modal-body">
              {submitStatus && (
                <div className={`alert ${submitStatus.includes('[OK]') ? 'alert-success' : submitStatus.includes('[ERR]') ? 'alert-error' : 'alert-info'}`} style={{ marginBottom: '1rem' }}>
                  {submitStatus}
                </div>
              )}

              {/* Profile Change Form */}
              {settingsTab === 'profile' && (
                <form onSubmit={handleProfileChangeRequest}>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.studentName || ''}
                      onChange={(e) => setProfileChangeForm({...profileChangeForm, studentName: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={profileChangeForm.email || ''}
                      onChange={(e) => setProfileChangeForm({...profileChangeForm, email: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.mobileNo || ''}
                      onChange={(e) => setProfileChangeForm({...profileChangeForm, mobileNo: e.target.value})}
                      placeholder="Enter 10-digit mobile number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Address</label>
                    <textarea
                      className="form-control"
                      value={profileChangeForm.address || ''}
                      onChange={(e) => setProfileChangeForm({...profileChangeForm, address: e.target.value})}
                      rows="3"
                      placeholder="Enter your complete address"
                    />
                  </div>
                  <div className="alert alert-info" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                    ℹ️ <strong>Note:</strong> Your profile change request will be sent to the admin for approval. Changes will be reflected after admin approval.
                  </div>
                  <div className="modal-footer" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => setShowSettingsModal(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit Request
                    </button>
                  </div>
                </form>
              )}

              {/* Password Change Form */}
              {settingsTab === 'password' && (
                <form onSubmit={handlePasswordChangeRequest}>
                  <div className="form-group">
                    <label>Current Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={passwordChangeForm.currentPassword}
                      onChange={(e) => setPasswordChangeForm({...passwordChangeForm, currentPassword: e.target.value})}
                      required
                      placeholder="Enter your current password"
                    />
                  </div>
                  <div className="form-group">
                    <label>New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={passwordChangeForm.newPassword}
                      onChange={(e) => setPasswordChangeForm({...passwordChangeForm, newPassword: e.target.value})}
                      required
                      placeholder="Enter new password (min 6 characters)"
                      minLength="6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={passwordChangeForm.confirmPassword}
                      onChange={(e) => setPasswordChangeForm({...passwordChangeForm, confirmPassword: e.target.value})}
                      required
                      placeholder="Re-enter new password"
                      minLength="6"
                    />
                  </div>
                  <div className="alert alert-info" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                    ℹ️ <strong>Note:</strong> Your password change request will be sent to the admin for approval. After approval, you will need to login with your new password.
                  </div>
                  <div className="modal-footer" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <button type="button" onClick={() => setShowSettingsModal(false)} className="btn btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Submit Request
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

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

export default StudentDashboard;