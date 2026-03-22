import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import NotificationCenter from '../components/NotificationCenter';
import TimetableBoard from '../components/TimetableBoard';
import { fetchWithCacheSWR, prefetchWithCache } from '../utils/resilientFetch';
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
  FaChalkboardTeacher, FaChartLine, FaClipboardList, FaCog, FaUser,
  FaBell, FaCheck, FaTimes, FaUsers, FaBook, FaDoorOpen, FaBars,
  FaChevronLeft, FaGraduationCap, FaChartBar, FaBookOpen, FaEdit,
  FaCalendar, FaHome, FaCheckCircle, FaClock, FaFileAlt, FaLock, FaQrcode, FaBriefcase
} from 'react-icons/fa';
import './FacultyDashboard.css';
import './StudentDashboard.css';

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
const ProfileDropdown = ({ onViewProfile, onOpenSettings }) => {
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
              <p className="role-badge faculty">Faculty</p>
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
                onOpenSettings();
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

const FacultyDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [facultyData, setFacultyData] = useState(null);
  const [teachingData, setTeachingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [courses, setCourses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [courseForm, setCourseForm] = useState({
    title: '',
    code: '',
    description: '',
    year: 'First',
    branch: 'Information Technology',
    division: 'A',
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
  const [profileChangeForm, setProfileChangeForm] = useState({});
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [submitStatus, setSubmitStatus] = useState('');
  const [facultyTimetable, setFacultyTimetable] = useState(null);
  const [facultyTimetableEntries, setFacultyTimetableEntries] = useState([]);
  const [facultyTimetableLoading, setFacultyTimetableLoading] = useState(false);
  const [facultySubjectAnalysis, setFacultySubjectAnalysis] = useState([]);
  const [subjectAnalysisLoading, setSubjectAnalysisLoading] = useState(false);
  const [subjectAnalysisError, setSubjectAnalysisError] = useState('');
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [manuallyAddedSubjects, setManuallyAddedSubjects] = useState([]);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [availableSubjectsLoading, setAvailableSubjectsLoading] = useState(false);
  const [manualSubjectForm, setManualSubjectForm] = useState({
    subjectCode: '',
    subjectName: '',
    year: 'First',
    division: 'A',
    semester: ''
  });
  const [addSubjectLoading, setAddSubjectLoading] = useState(false);
  const [addSubjectStatus, setAddSubjectStatus] = useState('');
  const [facultyStudentsAnalysis, setFacultyStudentsAnalysis] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [studentsYearFilter, setStudentsYearFilter] = useState('All');
  const [studentsAnalysisLoading, setStudentsAnalysisLoading] = useState(false);
  const [studentsAnalysisError, setStudentsAnalysisError] = useState('');
  const [selectedStudentAnalysis, setSelectedStudentAnalysis] = useState(null);
  const [selectedStudentAnalysisLoading, setSelectedStudentAnalysisLoading] = useState(false);
  const [selectedStudentAnalysisError, setSelectedStudentAnalysisError] = useState('');
  const [showStudentAnalysisModal, setShowStudentAnalysisModal] = useState(false);
  const [selectedStudentMeta, setSelectedStudentMeta] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({
    prn: '',
    month: 'Overall',
    year: new Date().getFullYear().toString(),
    subjectName: '',
    type: 'theory',
    totalClasses: '',
    attendedClasses: ''
  });
  const [marksForm, setMarksForm] = useState({
    prn: '',
    year: 'First',
    semester: '1',
    academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    subjectName: '',
    subjectCode: '',
    internalMarks: '',
    externalMarks: '',
    credits: '4',
    grade: ''
  });
  const [attendanceStatus, setAttendanceStatus] = useState('');
  const [marksStatus, setMarksStatus] = useState('');
  const [attendanceSessionForm, setAttendanceSessionForm] = useState({
    subjectName: '',
    year: 'ALL',
    branch: 'ALL',
    division: 'ALL',
    month: 'Overall',
    attendanceYear: new Date().getFullYear(),
    type: 'theory',
    expiresInMinutes: 15
  });
  const [activeAttendanceSession, setActiveAttendanceSession] = useState(null);
  const [attendanceQr, setAttendanceQr] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sessionActionStatus, setSessionActionStatus] = useState('');
  const [sessionLoading, setSessionLoading] = useState(false);
  const [attendanceSessionHistory, setAttendanceSessionHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);
  const [approvedStudentsForSession, setApprovedStudentsForSession] = useState([]);
  const [pastPlacements, setPastPlacements] = useState([]);
  const [pastPlacementsLoading, setPastPlacementsLoading] = useState(false);
  const preloadedStudentAnalysisIdsRef = useRef(new Set());

  const selectedPerformance = selectedStudentAnalysis?.individual?.performance || {};
  const selectedTrend = Array.isArray(selectedStudentAnalysis?.improvement?.trend_data)
    ? selectedStudentAnalysis.improvement.trend_data
    : [];
  const selectedSubjectRows = Object.values(selectedStudentAnalysis?.subjects?.subject_wise_analysis || {})
    .flat()
    .filter(Boolean);
  const topSelectedSubjects = [...selectedSubjectRows]
    .sort((a, b) => Number(b.total_marks || 0) - Number(a.total_marks || 0))
    .slice(0, 8);

  const selectedPerformanceChartData = {
    labels: ['Overall', 'Attendance', 'Subject', 'Improvement', 'Consistency'],
    datasets: [
      {
        label: 'Score',
        data: [
          Number(selectedPerformance?.overall_performance_score || 0),
          Number(selectedPerformance?.attendance_score || 0),
          Number(selectedPerformance?.subject_performance_score || 0),
          Number(selectedPerformance?.improvement_trend || 0),
          Number(selectedPerformance?.consistency_score || 0)
        ],
        backgroundColor: ['#2980b9', '#16a085', '#8e44ad', '#f39c12', '#2c3e50']
      }
    ]
  };

  const selectedRiskChartData = {
    labels: ['Placement Probability', 'Remaining Gap'],
    datasets: [
      {
        data: [
          Number(selectedPerformance?.placement_probability || 0),
          Math.max(0, 100 - Number(selectedPerformance?.placement_probability || 0))
        ],
        backgroundColor: ['#27ae60', '#dfe6e9']
      }
    ]
  };

  const selectedTrendChartData = {
    labels: selectedTrend.map((point) => `Sem ${point.semester}`),
    datasets: [
      {
        label: 'SGPA Trend',
        data: selectedTrend.map((point) => Number(point.sgpa || 0)),
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.2)',
        tension: 0.25,
        fill: true
      }
    ]
  };

  const selectedSubjectChartData = {
    labels: topSelectedSubjects.map((sub) => sub.subject_name || sub.subject_code || 'Subject'),
    datasets: [
      {
        label: 'Marks',
        data: topSelectedSubjects.map((sub) => Number(sub.total_marks || 0)),
        backgroundColor: '#9b59b6'
      }
    ]
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Just now';

    const eventTime = new Date(timestamp).getTime();
    if (Number.isNaN(eventTime)) return 'Just now';

    const diffMs = Date.now() - eventTime;
    const diffSeconds = Math.max(1, Math.floor(diffMs / 1000));

    if (diffSeconds < 60) return `${diffSeconds} sec ago`;

    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const getActivityIcon = (activityType) => {
    switch (activityType) {
      case 'attendance':
        return <FaCheckCircle />;
      case 'assignment':
        return <FaEdit />;
      case 'course':
        return <FaBookOpen />;
      default:
        return <FaClock />;
    }
  };

  const handleViewProfile = () => {
    setShowProfileDetails(true);
    setActiveTab('Dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenSettings = () => {
    if (facultyData) {
      setProfileChangeForm({
        facultyName: facultyData.facultyName || '',
        email: facultyData.email || '',
        mobileNo: facultyData.mobileNo || '',
        department: facultyData.department || '',
        designation: facultyData.designation || ''
      });
    }
    setShowSettingsModal(true);
  };

  const handleProfileChangeRequest = async (e) => {
    e.preventDefault();
    try {
      setSubmitStatus('Submitting...');
      const token = localStorage.getItem('token');

      await axios.post(
        `${API_BASE_URL}/api/change-requests/profile`,
        {
          facultyId: user.referenceId,
          requestedBy: user.username,
          requesterRole: 'faculty',
          changeType: 'profile',
          currentData: {
            facultyName: facultyData?.facultyName,
            email: facultyData?.email,
            mobileNo: facultyData?.mobileNo,
            department: facultyData?.department,
            designation: facultyData?.designation
          },
          requestedData: profileChangeForm
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSubmitStatus('[OK] Profile change request submitted! Waiting for admin approval.');
      setTimeout(() => {
        setSubmitStatus('');
        setShowSettingsModal(false);
      }, 3000);
    } catch (error) {
      setSubmitStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

  const handlePasswordChangeRequest = async (e) => {
    e.preventDefault();

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

      await axios.post(
        `${API_BASE_URL}/api/change-requests/password`,
        {
          facultyId: user.referenceId,
          requestedBy: user.username,
          requesterRole: 'faculty',
          changeType: 'password',
          currentPassword: passwordChangeForm.currentPassword,
          newPassword: passwordChangeForm.newPassword
        },
        {
          headers: { Authorization: `Bearer ${token}` }
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
      setSubmitStatus('[ERR] Error: ' + (error.response?.data?.message || error.message));
    }
  };

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
    fetchFacultyData();
  }, []);

  useEffect(() => {
    let intervalId;

    const startActivityPolling = async () => {
      await fetchRecentActivities();
      intervalId = setInterval(fetchRecentActivities, 10000);
    };

    startActivityPolling();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [facultyData?.facultyId, user?.referenceId]);

  useEffect(() => {
    const facultyId = (facultyData?.facultyId || user?.referenceId || '').toUpperCase();
    if (!facultyId) return;

    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Predictive pre-loading based on common faculty navigation flows.
    const warmLikelyTabs = async () => {
      if (activeTab === 'Dashboard') {
        await Promise.all([
          prefetchWithCache({ url: `${API_BASE_URL}/api/courses`, headers, ttlMs: 60000 }),
          prefetchWithCache({ url: `${API_BASE_URL}/api/assignments`, headers, ttlMs: 60000 })
        ]);
      } else if (activeTab === 'Courses') {
        await prefetchWithCache({ url: `${API_BASE_URL}/api/assignments`, headers, ttlMs: 60000 });
      }
    };

    warmLikelyTabs();
  }, [activeTab, facultyData?.facultyId, user?.referenceId]);

  useEffect(() => {
    if (!showStudentAnalysisModal) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setShowStudentAnalysisModal(false);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showStudentAnalysisModal]);

  useEffect(() => {
    if (activeTab === 'Subjects') {
      fetchFacultySubjectAnalysis();
      fetchManualSubjects();
      fetchAvailableSubjects();
    }
    if (activeTab === 'Students') {
      fetchFacultyStudentsAnalysis({ showLoading: facultyStudentsAnalysis.length === 0 });
    }
    if (activeTab === 'Courses') {
      fetchCourses();
    }
    if (activeTab === 'Assignments') {
      fetchCourses();
      fetchAssignments();
    }
    if (activeTab === 'Timetable') {
      fetchFacultyTimetable();
    }
    if (activeTab === 'Placements') {
      fetchPastPlacements();
    }
  }, [activeTab, facultyData?._id, studentsYearFilter]);

  useEffect(() => {
    if (activeTab !== 'MarkAttendance') return undefined;

    fetchActiveAttendanceSession();
    fetchAttendanceSessionHistory();
    const interval = setInterval(fetchActiveAttendanceSession, 4000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchFacultySubjectAnalysis = async () => {
    try {
      const facultyIdentifier = facultyData?._id || facultyData?.facultyId || user?.referenceId;
      if (!facultyIdentifier) return;
      setSubjectAnalysisLoading(true);
      setSubjectAnalysisError('');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/ml-analysis/faculty/${facultyIdentifier}/subject-analysis`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFacultySubjectAnalysis(response.data?.subjects || []);
    } catch (error) {
      console.error('Error fetching faculty subject analysis:', error);
      setSubjectAnalysisError(error.response?.data?.error || error.message);
      setFacultySubjectAnalysis([]);
    } finally {
      setSubjectAnalysisLoading(false);
    }
  };

  const fetchManualSubjects = async () => {
    try {
      const facultyIdentifier = facultyData?.facultyId || user?.referenceId;
      if (!facultyIdentifier) return;
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/faculty/${facultyIdentifier}/manual-subjects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setManuallyAddedSubjects(response.data?.manuallyAddedSubjects || []);
      setAssignedSubjects(response.data?.assignedSubjects || []);
    } catch (error) {
      console.error('Error fetching manual subjects:', error);
    }
  };

  const fetchAvailableSubjects = async () => {
    try {
      const facultyIdentifier = facultyData?.facultyId || user?.referenceId;
      if (!facultyIdentifier) return;
      
      setAvailableSubjectsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/faculty/${facultyIdentifier}/available-subjects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableSubjects(response.data?.availableSubjects || []);
    } catch (error) {
      console.error('Error fetching available subjects:', error);
      setAvailableSubjects([]);
    } finally {
      setAvailableSubjectsLoading(false);
    }
  };

  const handleSelectSubject = (subjectCode, subjectName) => {
    setManualSubjectForm({
      ...manualSubjectForm,
      subjectCode,
      subjectName
    });
  };

  const handleAddManualSubject = async (e) => {
    e.preventDefault();
    try {
      if (!manualSubjectForm.subjectCode || !manualSubjectForm.subjectName) {
        setAddSubjectStatus('[ERR] Subject code and name are required!');
        return;
      }

      const facultyIdentifier = facultyData?.facultyId || user?.referenceId;
      if (!facultyIdentifier) return;

      setAddSubjectLoading(true);
      setAddSubjectStatus('');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/api/faculty/${facultyIdentifier}/manual-subjects`,
        manualSubjectForm,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setAddSubjectStatus('[OK] Subject added successfully!');
      setManualSubjectForm({
        subjectCode: '',
        subjectName: '',
        year: 'First',
        division: 'A',
        semester: ''
      });
      
      // Refresh the subjects list and analysis
      fetchManualSubjects();
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchFacultySubjectAnalysis();
    } catch (error) {
      setAddSubjectStatus('[ERR] ' + (error.response?.data?.message || error.message));
    } finally {
      setAddSubjectLoading(false);
    }
  };

  const handleRemoveManualSubject = async (subjectCode) => {
    if (!window.confirm('Are you sure you want to remove this subject?')) return;

    try {
      const facultyIdentifier = facultyData?.facultyId || user?.referenceId;
      if (!facultyIdentifier) return;

      const token = localStorage.getItem('token');

      await axios.delete(
        `${API_BASE_URL}/api/faculty/${facultyIdentifier}/manual-subjects/${subjectCode}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setAddSubjectStatus('[OK] Subject removed successfully!');
      
      // Refresh the subjects list and analysis
      fetchManualSubjects();
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchFacultySubjectAnalysis();
    } catch (error) {
      setAddSubjectStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchFacultyStudentsAnalysisList = async ({ showLoading = true } = {}) => {
    const facultyIdentifier = facultyData?._id || facultyData?.facultyId || user?.referenceId;
    if (!facultyIdentifier) {
      return [];
    }

    if (showLoading) {
      setStudentsAnalysisLoading(true);
    }

    try {
      setStudentsAnalysisError('');
      const token = localStorage.getItem('token');

      const params = new URLSearchParams();
      if (studentsYearFilter && studentsYearFilter !== 'All') {
        params.set('year', studentsYearFilter);
      }
      const analysisUrl = `${API_BASE_URL}/api/ml-analysis/faculty/${facultyIdentifier}/students-analysis${params.toString() ? `?${params.toString()}` : ''}`;

      const toTopPerformers = (students = []) => (
        [...students]
          .sort((a, b) => Number(b.performanceScore || 0) - Number(a.performanceScore || 0))
          .slice(0, 5)
      );

      const response = await fetchWithCacheSWR({
        url: analysisUrl,
        method: 'get',
        headers: { Authorization: `Bearer ${token}` },
        ttlMs: 2 * 60 * 1000,
        retries: 2,
        backgroundRefresh: true,
        onFreshData: (freshData) => {
          const freshStudents = Array.isArray(freshData?.students) ? freshData.students : [];
          setFacultyStudentsAnalysis(freshStudents);
          const freshTop = Array.isArray(freshData?.topPerformers) && freshData.topPerformers.length
            ? freshData.topPerformers
            : toTopPerformers(freshStudents);
          setTopPerformers(freshTop);
        }
      });

      const students = Array.isArray(response.data?.students) ? response.data.students : [];
      setFacultyStudentsAnalysis(students);
      const responseTop = Array.isArray(response.data?.topPerformers) && response.data.topPerformers.length
        ? response.data.topPerformers
        : toTopPerformers(students);
      setTopPerformers(responseTop);
      return students;
    } catch (error) {
      setStudentsAnalysisError(error.response?.data?.error || error.message);
      setTopPerformers([]);
      return [];
    } finally {
      if (showLoading) {
        setStudentsAnalysisLoading(false);
      }
    }
  };

  const fetchFacultyStudentsAnalysis = async ({ showLoading = true } = {}) => {
    try {
      await fetchFacultyStudentsAnalysisList({ showLoading });
    } catch (error) {
      console.error('Error fetching faculty students analysis list:', error);
      setStudentsAnalysisError(error.response?.data?.error || error.message);
      setFacultyStudentsAnalysis([]);
      setTopPerformers([]);
    }
  };

  const prefetchStudentAnalysis = async (studentId) => {
    if (!studentId || preloadedStudentAnalysisIdsRef.current.has(studentId)) return;

    const token = localStorage.getItem('token');
    const didPrefetch = await prefetchWithCache({
      url: `${API_BASE_URL}/api/ml-analysis/student/${studentId}/full-analysis`,
      headers: { Authorization: `Bearer ${token}` },
      ttlMs: 5 * 60 * 1000,
      retries: 1
    });

    if (didPrefetch) {
      preloadedStudentAnalysisIdsRef.current.add(studentId);
    }
  };

  const openStudentAnalysisModal = (student) => {
    if (!student?._id) {
      setSelectedStudentAnalysisError('Invalid student selection. Please refresh and try again.');
      return;
    }

    setSelectedStudentMeta(student);
    setSelectedStudentAnalysisError('');
    setShowStudentAnalysisModal(true);
    fetchFullStudentAnalysis(student._id);
  };

  const fetchFullStudentAnalysis = async (studentId) => {
    try {
      if (!studentId) {
        setSelectedStudentAnalysisError('Invalid student selection. Please refresh and try again.');
        return;
      }
      setSelectedStudentAnalysisLoading(true);
      setSelectedStudentAnalysisError('');
      setSelectedStudentAnalysis(null);
      const token = localStorage.getItem('token');
      const response = await fetchWithCacheSWR({
        url: `${API_BASE_URL}/api/ml-analysis/student/${studentId}/full-analysis`,
        method: 'get',
        headers: { Authorization: `Bearer ${token}` },
        ttlMs: 5 * 60 * 1000,
        retries: 2,
        backgroundRefresh: true,
        onFreshData: (freshData) => {
          setSelectedStudentAnalysis(freshData || null);
          preloadedStudentAnalysisIdsRef.current.add(studentId);
        }
      });
      setSelectedStudentAnalysis(response.data || null);
      preloadedStudentAnalysisIdsRef.current.add(studentId);
    } catch (error) {
      console.error('Error fetching full student analysis:', error);
      setSelectedStudentAnalysisError(error.response?.data?.error || error.message);
    } finally {
      setSelectedStudentAnalysisLoading(false);
    }
  };

  const fetchFacultyTimetable = async () => {
    try {
      setFacultyTimetableLoading(true);
      const token = localStorage.getItem('token');
      const staffId = (facultyData?.facultyId || user?.referenceId || '').toUpperCase();
      if (!staffId) {
        setFacultyTimetable(null);
        setFacultyTimetableEntries([]);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/faculty/timetable/${staffId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setFacultyTimetable(response.data.timetable || null);
      setFacultyTimetableEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error fetching faculty timetable:', error);
      setFacultyTimetable(null);
      setFacultyTimetableEntries([]);
    } finally {
      setFacultyTimetableLoading(false);
    }
  };

  const fetchPastPlacements = async () => {
    try {
      setPastPlacementsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/placement-showcase`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 30 }
      });
      setPastPlacements(Array.isArray(response.data?.placements) ? response.data.placements : []);
    } catch (error) {
      console.error('Error fetching past placements:', error);
      setPastPlacements([]);
    } finally {
      setPastPlacementsLoading(false);
    }
  };

  const fetchFacultyData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch faculty profile
      const facultyResponse = await axios.get(`${API_BASE_URL}/api/faculty`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Find current faculty
      const currentFaculty = facultyResponse.data.find(
        faculty => (faculty.facultyId || '').toUpperCase() === (user.referenceId || '').toUpperCase()
      );

      if (currentFaculty) {
        setFacultyData(currentFaculty);
      } else {
        setMockData();
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

  const fetchRecentActivities = async () => {
    try {
      const facultyId = (facultyData?.facultyId || user?.referenceId || '').toUpperCase();
      if (!facultyId) {
        setRecentActivities([]);
        return;
      }

      setActivitiesLoading(true);
      const token = localStorage.getItem('token');
      const requestUrl = `${API_BASE_URL}/api/dashboard/faculty/${facultyId}/activities?limit=10`;

      const response = await fetchWithCacheSWR({
        url: requestUrl,
        method: 'get',
        headers: { Authorization: `Bearer ${token}` },
        ttlMs: 30000,
        retries: 2,
        backgroundRefresh: true,
        onFreshData: (freshData) => {
          const freshActivities = Array.isArray(freshData?.activities) ? freshData.activities : [];
          setRecentActivities(freshActivities);
        }
      });

      setRecentActivities(Array.isArray(response.data?.activities) ? response.data.activities : []);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    } finally {
      setActivitiesLoading(false);
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

      const response = await axios.post(`${API_BASE_URL}/api/courses`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setCourseForm({
        title: '',
        code: '',
        description: '',
        year: 'First',
        branch: 'Information Technology',
        division: 'A',
        semester: '',
        file: null
      });
      setCourses((prev) => [response.data.course, ...prev]);
      await fetchRecentActivities();
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

      const response = await axios.post(`${API_BASE_URL}/api/assignments`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setAssignmentForm({ courseId: '', title: '', description: '', dueDate: '', totalMarks: '', file: null });
      setAssignments((prev) => [response.data.assignment, ...prev]);
      await fetchRecentActivities();
    } catch (error) {
      console.error('Error creating assignment:', error);
    }
  };

  const fetchSubmissions = async (assignmentId) => {
    try {
      setSelectedAssignmentId(assignmentId);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/assignments/${assignmentId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSubmissions(response.data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const deriveGradeFromMarks = (internal, external) => {
    const total = Number(internal || 0) + Number(external || 0);
    if (total >= 90) return 'O';
    if (total >= 80) return 'A+';
    if (total >= 70) return 'A';
    if (total >= 60) return 'B+';
    if (total >= 50) return 'B';
    if (total >= 40) return 'C';
    return 'F';
  };

  const handleSubmitAttendance = async () => {
    try {
      if (!attendanceForm.prn || !attendanceForm.subjectName || !attendanceForm.totalClasses || !attendanceForm.attendedClasses) {
        setAttendanceStatus('[ERR] PRN, subject, total and attended classes are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const studentRes = await axios.get(`${API_BASE_URL}/api/students/${attendanceForm.prn}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const student = studentRes.data?.student;
      if (!student) {
        setAttendanceStatus('[ERR] Student not found.');
        return;
      }

      const targetMonth = attendanceForm.month || 'Overall';
      const targetYear = Number(attendanceForm.year || new Date().getFullYear());
      const existingAttendance = Array.isArray(student.attendance) ? student.attendance : [];
      const monthEntry = existingAttendance.find(
        (a) => a.month === targetMonth && Number(a.year) === targetYear
      );

      const nextSubject = {
        subjectName: attendanceForm.subjectName,
        type: attendanceForm.type || 'theory',
        totalClasses: Number(attendanceForm.totalClasses),
        attendedClasses: Number(attendanceForm.attendedClasses)
      };

      const existingSubjects = Array.isArray(monthEntry?.subjects) ? monthEntry.subjects : [];
      const withoutSameSubject = existingSubjects.filter(
        (s) => !(
          String(s.subjectName || '').toLowerCase() === String(nextSubject.subjectName).toLowerCase() &&
          String(s.type || 'theory') === String(nextSubject.type)
        )
      );

      const payload = {
        month: targetMonth,
        year: targetYear,
        subjects: [...withoutSameSubject, nextSubject]
      };

      await axios.post(`${API_BASE_URL}/api/students/${attendanceForm.prn}/attendance`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setAttendanceStatus('[OK] Attendance saved successfully.');
      setAttendanceForm((prev) => ({
        ...prev,
        subjectName: '',
        totalClasses: '',
        attendedClasses: ''
      }));
    } catch (error) {
      setAttendanceStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const handleSubmitMarks = async () => {
    try {
      if (!marksForm.prn || !marksForm.subjectName || marksForm.internalMarks === '' || marksForm.externalMarks === '') {
        setMarksStatus('[ERR] PRN, subject name, internal and external marks are required.');
        return;
      }

      const token = localStorage.getItem('token');
      const internalMarks = Number(marksForm.internalMarks);
      const externalMarks = Number(marksForm.externalMarks);
      const totalMarks = internalMarks + externalMarks;
      const grade = marksForm.grade || deriveGradeFromMarks(internalMarks, externalMarks);

      const payload = {
        year: marksForm.year,
        semester: Number(marksForm.semester),
        academicYear: marksForm.academicYear,
        subjects: [
          {
            subjectCode: marksForm.subjectCode,
            subjectName: marksForm.subjectName,
            internalMarks,
            externalMarks,
            totalMarks,
            credits: Number(marksForm.credits || 4),
            grade
          }
        ]
      };

      await axios.post(`${API_BASE_URL}/api/students/${marksForm.prn}/marks`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setMarksStatus('[OK] Marks saved successfully.');
      setMarksForm((prev) => ({
        ...prev,
        subjectName: '',
        subjectCode: '',
        internalMarks: '',
        externalMarks: '',
        grade: ''
      }));
    } catch (error) {
      setMarksStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const fetchActiveAttendanceSession = async () => {
    try {
      setSessionLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/attendance-sessions/active`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActiveAttendanceSession(response.data?.session || null);
      setAttendanceQr(response.data?.qr || null);
      setPendingRequests(response.data?.requests || []);
    } catch (error) {
      console.error('Error fetching active attendance session:', error);
      setSessionActionStatus('[ERR] Could not refresh attendance session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const fetchAttendanceSessionHistory = async () => {
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/attendance-sessions/history?limit=25`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAttendanceSessionHistory(response.data?.sessions || []);
    } catch (error) {
      console.error('Error fetching attendance session history:', error);
      setSessionActionStatus('[ERR] Could not load session history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateAttendanceSession = async () => {
    try {
      if (!attendanceSessionForm.subjectName || !attendanceSessionForm.subjectName.trim()) {
        setSessionActionStatus('[ERR] Subject name is required to generate QR.');
        return;
      }

      setSessionActionStatus('Generating attendance session...');
      const token = localStorage.getItem('token');

      const payload = {
        subjectName: attendanceSessionForm.subjectName.trim(),
        year: attendanceSessionForm.year || 'ALL',
        branch: attendanceSessionForm.branch || 'ALL',
        division: attendanceSessionForm.division || 'ALL',
        month: attendanceSessionForm.month || 'Overall',
        attendanceYear: Number(attendanceSessionForm.attendanceYear || new Date().getFullYear()),
        type: attendanceSessionForm.type || 'theory',
        expiresInMinutes: Number(attendanceSessionForm.expiresInMinutes || 15)
      };

      const response = await axios.post(`${API_BASE_URL}/api/attendance-sessions/create`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setActiveAttendanceSession(response.data?.session || null);
      setAttendanceQr(response.data?.qr || null);
      setPendingRequests([]);
      setSessionActionStatus('[OK] Session QR generated. Ask students to scan and send request.');
      await fetchAttendanceSessionHistory();
      await fetchRecentActivities();
    } catch (error) {
      setSessionActionStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAttendanceSessionFieldChange = (field, value) => {
    setAttendanceSessionForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApproveAttendanceRequest = async (requestId) => {
    if (!activeAttendanceSession?._id || !requestId) return;

    try {
      setSessionActionStatus('Approving request...');
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/attendance-sessions/${activeAttendanceSession._id}/approve/${requestId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessionActionStatus('[OK] Request approved.');
      await fetchActiveAttendanceSession();
      await fetchAttendanceSessionHistory();
    } catch (error) {
      setSessionActionStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const handleApproveAllAttendanceRequests = async () => {
    if (!activeAttendanceSession?._id) return;

    try {
      setSessionActionStatus('Approving all pending requests...');
      const token = localStorage.getItem('token');
      const response = await axios.put(
        `${API_BASE_URL}/api/attendance-sessions/${activeAttendanceSession._id}/approve-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessionActionStatus(`[OK] Approved ${response.data?.approvedCount || 0} request(s).`);
      await fetchActiveAttendanceSession();
      await fetchAttendanceSessionHistory();
    } catch (error) {
      setSessionActionStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCloseAttendanceSession = async () => {
    if (!activeAttendanceSession?._id) return;

    try {
      setSessionActionStatus('Closing attendance session...');
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_BASE_URL}/api/attendance-sessions/${activeAttendanceSession._id}/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setActiveAttendanceSession(null);
      setAttendanceQr(null);
      setPendingRequests([]);
      setSessionActionStatus('[OK] Session closed successfully.');
      await fetchAttendanceSessionHistory();
    } catch (error) {
      setSessionActionStatus('[ERR] ' + (error.response?.data?.message || error.message));
    }
  };

  const handleViewApprovedStudents = async (sessionId) => {
    if (!sessionId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/attendance-sessions/${sessionId}/approved-students`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSelectedHistorySession(response.data?.session || null);
      setApprovedStudentsForSession(response.data?.approvedStudents || []);
    } catch (error) {
      setSessionActionStatus('[ERR] ' + (error.response?.data?.message || error.message));
      setSelectedHistorySession(null);
      setApprovedStudentsForSession([]);
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
    <div className={`faculty-dashboard ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
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
              <p>Faculty Portal</p>
            </div>
          </div>
        </div>
        
        <nav className="sidebar-nav" aria-label="Faculty navigation">
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
          ><span className="nav-icon"><FaChartBar /></span><span className="nav-label">Dashboard</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Subjects' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Subjects');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Subjects');
              }
            }}
          ><span className="nav-icon"><FaBook /></span><span className="nav-label">My Subjects</span></a>
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
          ><span className="nav-icon"><FaBookOpen /></span><span className="nav-label">Courses</span></a>
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
            className={`nav-item ${activeTab === 'MarkAttendance' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('MarkAttendance');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('MarkAttendance');
              }
            }}
          ><span className="nav-icon"><FaEdit /></span><span className="nav-label">Mark Attendance</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'EnterMarks' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('EnterMarks');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('EnterMarks');
              }
            }}
          ><span className="nav-icon"><FaClipboardList /></span><span className="nav-label">Enter Marks</span></a>
          <a
            role="button"
            tabIndex={0}
            className={`nav-item ${activeTab === 'Students' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Students');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Students');
              }
            }}
          ><span className="nav-icon"><FaUsers /></span><span className="nav-label">Students</span></a>
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
            className={`nav-item ${activeTab === 'Timetable' ? 'active' : ''}`}
            onClick={() => {
              setShowProfileDetails(false);
              setActiveTab('Timetable');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setShowProfileDetails(false);
                setActiveTab('Timetable');
              }
            }}
          ><span className="nav-icon"><FaCalendar /></span><span className="nav-label">Timetable</span></a>
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
              <ProfileDropdown onViewProfile={handleViewProfile} onOpenSettings={handleOpenSettings} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content">
          {activeTab === 'Dashboard' ? (
            <>
              {/* Statistics Cards */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon"><FaBook /></div>
                  <div className="stat-info">
                    <h3>{teachingData?.subjects.length || 0}</h3>
                    <p>Teaching Subjects</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><FaUsers /></div>
                  <div className="stat-info">
                    <h3>{teachingData?.totalStudents || 0}</h3>
                    <p>Total Students</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><FaCheckCircle /></div>
                  <div className="stat-info">
                    <h3>{teachingData?.averageAttendance || 0}%</h3>
                    <p>Avg Attendance</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon"><FaEdit /></div>
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
                  <h2 className="card-title"><FaBook /> Teaching Subjects</h2>
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
                  <button className="quick-action-btn" onClick={() => setActiveTab('MarkAttendance')}>
                    <span className="action-icon"><FaEdit /></span>
                    <span>Mark Today's Attendance</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('EnterMarks')}>
                    <span className="action-icon"><FaClipboardList /></span>
                    <span>Enter Exam Marks</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('Students')}>
                    <span className="action-icon"><FaUsers /></span>
                    <span>Student Performance</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('Subjects')}>
                    <span className="action-icon"><FaChartBar /></span>
                    <span>Generate Reports</span>
                  </button>
                </div>
              </div>

              {/* Recent Activities */}
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title"><FaClock /> Recent Activities</h2>
                </div>
                <div className="card-body">
                  <div className="activities-list">
                    {activitiesLoading && recentActivities.length === 0 && (
                      <div className="activity-item skeleton-activity" aria-hidden="true">
                        <div className="activity-icon skeleton-icon" />
                        <div className="activity-content">
                          <div className="skeleton-line skeleton-line-title" />
                          <div className="skeleton-line skeleton-line-subtitle" />
                        </div>
                      </div>
                    )}

                    {!activitiesLoading && recentActivities.length === 0 && (
                      <div className="activity-item">
                        <div className="activity-icon"><FaClock /></div>
                        <div className="activity-content">
                          <p>No recent activity yet.</p>
                          <span className="activity-time">New actions will appear here in real time</span>
                        </div>
                      </div>
                    )}

                    {recentActivities.map((activity) => (
                      <div className="activity-item" key={activity.id || `${activity.type}-${activity.timestamp}`}>
                        <div className="activity-icon">{getActivityIcon(activity.type)}</div>
                        <div className="activity-content">
                          <p>{activity.details ? `${activity.title} - ${activity.details}` : activity.title}</p>
                          <span className="activity-time">{formatTimeAgo(activity.timestamp)}</span>
                        </div>
                      </div>
                    ))}
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
                  {activeTab === 'Subjects' && (
                    <div>
                      <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">Add Subject Manually</h2>
                        </div>
                        <div className="card-body">
                          {availableSubjectsLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                              <div className="spinner"></div>
                              Loading available subjects...
                            </div>
                          ) : availableSubjects.length > 0 ? (
                            <div style={{ marginBottom: '1.5rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                                Quick Select from Available Subjects
                              </label>
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                                gap: '0.5rem',
                                marginBottom: '1rem'
                              }}>
                                {availableSubjects.map((subject, idx) => (
                                  <button
                                    key={idx}
                                    className="btn"
                                    style={{
                                      backgroundColor: 
                                        manualSubjectForm.subjectCode === subject.subjectCode 
                                          ? 'var(--primary)' 
                                          : 'var(--muted-bg)',
                                      color: 
                                        manualSubjectForm.subjectCode === subject.subjectCode 
                                          ? 'white' 
                                          : 'inherit',
                                      border: '1px solid var(--border)',
                                      padding: '0.5rem',
                                      fontSize: '0.85rem',
                                      textAlign: 'left',
                                      whiteSpace: 'normal',
                                      height: 'auto'
                                    }}
                                    onClick={() => handleSelectSubject(subject.subjectCode, subject.subjectName)}
                                  >
                                    <strong>{subject.subjectCode}</strong> - {subject.subjectName}
                                  </button>
                                ))}
                              </div>
                              <hr style={{ margin: '1rem 0' }} />
                            </div>
                          ) : null}

                          <form onSubmit={handleAddManualSubject}>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Subject Code *</label>
                                <input
                                  className="form-control"
                                  placeholder="Select from above or enter manually"
                                  value={manualSubjectForm.subjectCode}
                                  onChange={(e) => setManualSubjectForm({ ...manualSubjectForm, subjectCode: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="form-group">
                                <label>Subject Name *</label>
                                <input
                                  className="form-control"
                                  placeholder="Select from above or enter manually"
                                  value={manualSubjectForm.subjectName}
                                  onChange={(e) => setManualSubjectForm({ ...manualSubjectForm, subjectName: e.target.value })}
                                  required
                                />
                              </div>
                            </div>
                            <div className="form-row">
                              <div className="form-group">
                                <label>Year</label>
                                <select
                                  className="form-control"
                                  value={manualSubjectForm.year}
                                  onChange={(e) => setManualSubjectForm({ ...manualSubjectForm, year: e.target.value })}
                                >
                                  <option value="First">First</option>
                                  <option value="Second">Second</option>
                                  <option value="Third">Third</option>
                                  <option value="Fourth">Fourth</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Division</label>
                                <select
                                  className="form-control"
                                  value={manualSubjectForm.division}
                                  onChange={(e) => setManualSubjectForm({ ...manualSubjectForm, division: e.target.value })}
                                >
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                </select>
                              </div>
                              <div className="form-group">
                                <label>Semester</label>
                                <input
                                  type="number"
                                  className="form-control"
                                  placeholder="e.g., 1, 2"
                                  value={manualSubjectForm.semester}
                                  onChange={(e) => setManualSubjectForm({ ...manualSubjectForm, semester: e.target.value })}
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              className="btn btn-primary"
                              disabled={addSubjectLoading}
                            >
                              {addSubjectLoading ? 'Adding...' : 'Add Subject'}
                            </button>
                            {addSubjectStatus && (
                              <p style={{
                                marginTop: '0.5rem',
                                color: addSubjectStatus.includes('[OK]') ? 'var(--success)' : 'var(--danger)'
                              }}>
                                {addSubjectStatus}
                              </p>
                            )}
                          </form>
                        </div>
                      </div>

                      <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">My Subjects (Assigned & Manual)</h2>
                        </div>
                        <div className="card-body">
                          <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Assigned Subjects ({assignedSubjects.length})</h4>
                            {assignedSubjects.length === 0 ? (
                              <p style={{ color: 'var(--muted)' }}>No assigned subjects.</p>
                            ) : (
                              <div className="subjects-grid">
                                {assignedSubjects.map((subject, i) => (
                                  <div key={`assigned-${i}`} className="subject-card" style={{ opacity: 0.9, borderLeft: '4px solid var(--primary)' }}>
                                    <h4>{subject.subjectName}</h4>
                                    <p className="stat-label">Code: {subject.subjectCode}</p>
                                    <p className="stat-label">Year: {subject.year || 'N/A'}</p>
                                    <p className="stat-label">Division: {subject.division || 'N/A'}</p>
                                    <p className="stat-label" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                      <strong>Assigned by Admin</strong>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div>
                            <h4 style={{ marginBottom: '0.5rem' }}>Manually Added Subjects ({manuallyAddedSubjects.length})</h4>
                            {manuallyAddedSubjects.length === 0 ? (
                              <p style={{ color: 'var(--muted)' }}>No manually added subjects. Add one above to get started!</p>
                            ) : (
                              <div className="subjects-grid">
                                {manuallyAddedSubjects.map((subject, i) => (
                                  <div key={`manual-${i}`} className="subject-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                      <h4>{subject.subjectName}</h4>
                                      <button
                                        className="btn btn-small"
                                        style={{
                                          padding: '0.25rem 0.5rem',
                                          fontSize: '0.8rem',
                                          backgroundColor: 'var(--danger)',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '4px',
                                          cursor: 'pointer'
                                        }}
                                        onClick={() => handleRemoveManualSubject(subject.subjectCode)}
                                      >
                                        × Remove
                                      </button>
                                    </div>
                                    <p className="stat-label">Code: {subject.subjectCode}</p>
                                    <p className="stat-label">Year: {subject.year || 'N/A'}</p>
                                    <p className="stat-label">Division: {subject.division || 'N/A'}</p>
                                    <p className="stat-label" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                      Added: {new Date(subject.addedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-header">
                          <h2 className="card-title">Subject Analysis</h2>
                        </div>
                        <div className="card-body">
                          {subjectAnalysisLoading ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                              <div className="spinner"></div>
                              Loading subject analysis...
                            </div>
                          ) : subjectAnalysisError ? (
                            <p style={{ color: 'var(--danger)' }}>{subjectAnalysisError}</p>
                          ) : facultySubjectAnalysis.length === 0 ? (
                            <p style={{ color: 'var(--muted)' }}>No subject analysis available yet. Add subjects above to generate analysis.</p>
                          ) : (
                            <div className="subjects-grid">
                              {facultySubjectAnalysis.map((subject, i) => (
                                <div key={i} className="subject-card" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                  <h4>{subject.subject}</h4>
                                  {subject.isManuallyAdded && (
                                    <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--warning)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', marginBottom: '0.5rem', display: 'inline-block' }}>
                                      Manual
                                    </span>
                                  )}
                                  <p className="stat-label">Avg Marks: {subject.stats?.average_marks ?? 0}</p>
                                  <p className="stat-label">Highest: {subject.stats?.highest_marks ?? 0}</p>
                                  <p className="stat-label">Lowest: {subject.stats?.lowest_marks ?? 0}</p>
                                  <p className="stat-label">Students: {subject.stats?.total_students ?? 0}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
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
                              <select
                                className="form-control"
                                value={courseForm.year}
                                onChange={(e) => setCourseForm({ ...courseForm, year: e.target.value })}
                              >
                                <option value="First">First</option>
                                <option value="Second">Second</option>
                                <option value="Third">Third</option>
                                <option value="Fourth">Fourth</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Branch *</label>
                              <input
                                className="form-control"
                                value={courseForm.branch}
                                readOnly
                              />
                            </div>
                            <div className="form-group">
                              <label>Division *</label>
                              <select
                                className="form-control"
                                value={courseForm.division}
                                onChange={(e) => setCourseForm({ ...courseForm, division: e.target.value })}
                              >
                                <option value="A">A</option>
                                <option value="B">B</option>
                              </select>
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
                                      href={`${API_BASE_URL}${assignment.attachmentUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="confidence-label"
                                    >
                                      <FaFileAlt /> View Assignment PDF
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
                                            <a href={`${API_BASE_URL}${sub.fileUrl}`} target="_blank" rel="noreferrer">Download File</a>
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
                      <h3 style={{ marginBottom: '1rem' }}><FaQrcode /> Scan & Verify Attendance Workflow</h3>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Subject Name *</label>
                          <input
                            className="form-control"
                            value={attendanceSessionForm.subjectName}
                            onChange={(e) => handleAttendanceSessionFieldChange('subjectName', e.target.value)}
                            placeholder="e.g. Data Structures"
                          />
                        </div>
                        <div className="form-group">
                          <label>Year Scope</label>
                          <input
                            className="form-control"
                            value={attendanceSessionForm.year}
                            onChange={(e) => handleAttendanceSessionFieldChange('year', e.target.value)}
                            placeholder="ALL / First / Second / Third / Fourth"
                          />
                        </div>
                        <div className="form-group">
                          <label>Branch Scope</label>
                          <input
                            className="form-control"
                            value={attendanceSessionForm.branch}
                            onChange={(e) => handleAttendanceSessionFieldChange('branch', e.target.value)}
                            placeholder="ALL / Computer Science"
                          />
                        </div>
                        <div className="form-group">
                          <label>Division Scope</label>
                          <input
                            className="form-control"
                            value={attendanceSessionForm.division}
                            onChange={(e) => handleAttendanceSessionFieldChange('division', e.target.value)}
                            placeholder="ALL / A / B"
                          />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Month</label>
                          <input
                            className="form-control"
                            value={attendanceSessionForm.month}
                            onChange={(e) => handleAttendanceSessionFieldChange('month', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Attendance Year</label>
                          <input
                            className="form-control"
                            type="number"
                            value={attendanceSessionForm.attendanceYear}
                            onChange={(e) => handleAttendanceSessionFieldChange('attendanceYear', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Type</label>
                          <select
                            className="form-control"
                            value={attendanceSessionForm.type}
                            onChange={(e) => handleAttendanceSessionFieldChange('type', e.target.value)}
                          >
                            <option value="theory">Theory</option>
                            <option value="practical">Practical</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Expires In (minutes)</label>
                          <input
                            className="form-control"
                            type="number"
                            min="1"
                            max="120"
                            value={attendanceSessionForm.expiresInMinutes}
                            onChange={(e) => handleAttendanceSessionFieldChange('expiresInMinutes', e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={handleGenerateAttendanceSession}>Generate Session QR</button>
                        <button className="btn btn-secondary" onClick={fetchActiveAttendanceSession}>Refresh Pending List</button>
                        {activeAttendanceSession && (
                          <button className="btn btn-warning" onClick={handleCloseAttendanceSession}>Close Session</button>
                        )}
                      </div>

                      {sessionActionStatus && <p className="confidence-label" style={{ marginTop: '0.75rem' }}>{sessionActionStatus}</p>}

                      {activeAttendanceSession && (
                        <div className="card" style={{ marginTop: '1rem' }}>
                          <div className="card-header">
                            <h2 className="card-title">Active Session: {activeAttendanceSession.subjectName}</h2>
                          </div>
                          <div className="card-body">
                            <p className="confidence-label">Session Code: <strong>{activeAttendanceSession.sessionCode}</strong></p>
                            <p className="confidence-label">Pending: <strong>{activeAttendanceSession.pendingCount || 0}</strong> | Approved: <strong>{activeAttendanceSession.approvedCount || 0}</strong></p>
                            <p className="confidence-label">Expires At: {new Date(activeAttendanceSession.expiresAt).toLocaleString()}</p>
                            <p className="confidence-label">Class Scope: {activeAttendanceSession.classScope?.year || 'ALL'} | {activeAttendanceSession.classScope?.branch || 'ALL'} | {activeAttendanceSession.classScope?.division || 'ALL'}</p>

                            {attendanceQr?.imageUrl && (
                              <div style={{ marginTop: '1rem' }}>
                                <img
                                  src={attendanceQr.imageUrl}
                                  alt="Attendance Session QR"
                                  style={{ width: '220px', maxWidth: '100%', borderRadius: '10px', border: '1px solid var(--border)' }}
                                />
                              </div>
                            )}

                            <div style={{ marginTop: '1rem' }}>
                              <h4>Pending Approval ({pendingRequests.length})</h4>
                              {pendingRequests.length > 0 && (
                                <button className="btn btn-success" style={{ marginBottom: '0.75rem' }} onClick={handleApproveAllAttendanceRequests}>
                                  Approve All
                                </button>
                              )}

                              {sessionLoading ? (
                                <p className="confidence-label">Refreshing pending requests...</p>
                              ) : pendingRequests.length === 0 ? (
                                <p className="confidence-label">No pending requests right now. Students will appear here in near real-time.</p>
                              ) : (
                                <div className="notification-list">
                                  {pendingRequests.map((request) => (
                                    <div key={request._id} className="notification-item">
                                      <div className="notification-body">
                                        <div className="notification-title">{request.studentName || 'Student'} ({request.studentPRN})</div>
                                        <div className="notification-message">Requested at {new Date(request.requestedAt).toLocaleTimeString()}</div>
                                      </div>
                                      <div>
                                        <button
                                          className="btn btn-success"
                                          onClick={() => handleApproveAttendanceRequest(request._id)}
                                        >
                                          Approve
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="card" style={{ marginTop: '1rem' }}>
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h2 className="card-title">Attendance Sessions</h2>
                          <button className="btn btn-secondary" onClick={fetchAttendanceSessionHistory}>Refresh Sessions</button>
                        </div>
                        <div className="card-body">
                          {historyLoading ? (
                            <p className="confidence-label">Loading session history...</p>
                          ) : attendanceSessionHistory.length === 0 ? (
                            <p className="confidence-label">No attendance sessions found yet.</p>
                          ) : (
                            <div className="table-responsive">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Session Code</th>
                                    <th>Subject</th>
                                    <th>Status</th>
                                    <th>Created At</th>
                                    <th>Approved</th>
                                    <th>Pending</th>
                                    <th>Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {attendanceSessionHistory.map((sessionRow) => (
                                    <tr key={sessionRow._id}>
                                      <td>{sessionRow.sessionCode}</td>
                                      <td>{sessionRow.subjectName}</td>
                                      <td>{sessionRow.status}</td>
                                      <td>{new Date(sessionRow.createdAt).toLocaleString()}</td>
                                      <td>{sessionRow.approvedCount || 0}</td>
                                      <td>{sessionRow.pendingCount || 0}</td>
                                      <td>
                                        <button
                                          className="btn btn-primary"
                                          onClick={() => handleViewApprovedStudents(sessionRow._id)}
                                        >
                                          View Approved Students
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedHistorySession && (
                        <div className="card" style={{ marginTop: '1rem' }}>
                          <div className="card-header">
                            <h2 className="card-title">
                              Approved Students: {selectedHistorySession.subjectName} ({selectedHistorySession.sessionCode})
                            </h2>
                          </div>
                          <div className="card-body">
                            {approvedStudentsForSession.length === 0 ? (
                              <p className="confidence-label">No approved student requests for this session yet.</p>
                            ) : (
                              <div className="table-responsive">
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>Student Name</th>
                                      <th>PRN</th>
                                      <th>Requested At</th>
                                      <th>Approved At</th>
                                      <th>Approved By</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {approvedStudentsForSession.map((studentRow) => (
                                      <tr key={studentRow.requestId}>
                                        <td>{studentRow.studentName || 'N/A'}</td>
                                        <td>{studentRow.studentPRN}</td>
                                        <td>{studentRow.requestedAt ? new Date(studentRow.requestedAt).toLocaleString() : '-'}</td>
                                        <td>{studentRow.approvedAt ? new Date(studentRow.approvedAt).toLocaleString() : '-'}</td>
                                        <td>{studentRow.approvedBy || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="card" style={{ marginTop: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title">Manual Attendance Entry (Legacy)</h2>
                        </div>
                        <div className="card-body">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Student PRN *</label>
                              <input className="form-control" value={attendanceForm.prn} onChange={(e) => setAttendanceForm({ ...attendanceForm, prn: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <label>Month</label>
                              <input className="form-control" value={attendanceForm.month} onChange={(e) => setAttendanceForm({ ...attendanceForm, month: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <label>Year</label>
                              <input className="form-control" type="number" value={attendanceForm.year} onChange={(e) => setAttendanceForm({ ...attendanceForm, year: e.target.value })} />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Subject Name *</label>
                              <input className="form-control" value={attendanceForm.subjectName} onChange={(e) => setAttendanceForm({ ...attendanceForm, subjectName: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <label>Type</label>
                              <select className="form-control" value={attendanceForm.type} onChange={(e) => setAttendanceForm({ ...attendanceForm, type: e.target.value })}>
                                <option value="theory">Theory</option>
                                <option value="practical">Practical</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Total Classes *</label>
                              <input className="form-control" type="number" value={attendanceForm.totalClasses} onChange={(e) => setAttendanceForm({ ...attendanceForm, totalClasses: e.target.value })} />
                            </div>
                            <div className="form-group">
                              <label>Attended Classes *</label>
                              <input className="form-control" type="number" value={attendanceForm.attendedClasses} onChange={(e) => setAttendanceForm({ ...attendanceForm, attendedClasses: e.target.value })} />
                            </div>
                          </div>
                          <button className="btn btn-primary" onClick={handleSubmitAttendance}>Save Attendance</button>
                        </div>
                      </div>

                      {attendanceStatus && <p className="confidence-label" style={{ marginTop: '0.75rem' }}>{attendanceStatus}</p>}
                    </div>
                  )}

                  {activeTab === 'EnterMarks' && (
                    <div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Student PRN *</label>
                          <input className="form-control" value={marksForm.prn} onChange={(e) => setMarksForm({ ...marksForm, prn: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Year</label>
                          <select className="form-control" value={marksForm.year} onChange={(e) => setMarksForm({ ...marksForm, year: e.target.value })}>
                            <option value="First">First</option>
                            <option value="Second">Second</option>
                            <option value="Third">Third</option>
                            <option value="Fourth">Fourth</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Semester</label>
                          <input className="form-control" type="number" min="1" max="8" value={marksForm.semester} onChange={(e) => setMarksForm({ ...marksForm, semester: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Academic Year</label>
                          <input className="form-control" value={marksForm.academicYear} onChange={(e) => setMarksForm({ ...marksForm, academicYear: e.target.value })} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Subject Name *</label>
                          <input className="form-control" value={marksForm.subjectName} onChange={(e) => setMarksForm({ ...marksForm, subjectName: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Subject Code</label>
                          <input className="form-control" value={marksForm.subjectCode} onChange={(e) => setMarksForm({ ...marksForm, subjectCode: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Internal Marks *</label>
                          <input className="form-control" type="number" value={marksForm.internalMarks} onChange={(e) => setMarksForm({ ...marksForm, internalMarks: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>External Marks *</label>
                          <input className="form-control" type="number" value={marksForm.externalMarks} onChange={(e) => setMarksForm({ ...marksForm, externalMarks: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Credits</label>
                          <input className="form-control" type="number" value={marksForm.credits} onChange={(e) => setMarksForm({ ...marksForm, credits: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Grade (optional)</label>
                          <input className="form-control" value={marksForm.grade} onChange={(e) => setMarksForm({ ...marksForm, grade: e.target.value.toUpperCase() })} placeholder="Auto if empty" />
                        </div>
                      </div>
                      <button className="btn btn-success" onClick={handleSubmitMarks}>Save Marks</button>
                      {marksStatus && <p className="confidence-label" style={{ marginTop: '0.75rem' }}>{marksStatus}</p>}
                    </div>
                  )}

                  {activeTab === 'Students' && (
                    <div>
                      <div className="form-group" style={{ maxWidth: '220px', marginBottom: '0.75rem' }}>
                        <label>Topper Year</label>
                        <select
                          className="form-control"
                          value={studentsYearFilter}
                          onChange={(e) => setStudentsYearFilter(e.target.value)}
                        >
                          <option value="All">All</option>
                          <option value="First">First</option>
                          <option value="Second">Second</option>
                          <option value="Third">Third</option>
                          <option value="Fourth">Fourth</option>
                        </select>
                      </div>

                      <div className="card" style={{ marginBottom: '1rem' }}>
                        <div className="card-header">
                          <h2 className="card-title"><FaChartLine /> Top 5 Performers</h2>
                        </div>
                        <div className="card-body">
                          {topPerformers.length === 0 ? (
                            <p style={{ color: 'var(--muted)' }}>No topper data available.</p>
                          ) : (
                            <div className="table-responsive">
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Rank</th>
                                    <th>Student Name</th>
                                    <th>PRN</th>
                                    <th>Year</th>
                                    <th>Division</th>
                                    <th>CGPA</th>
                                    <th>Attendance</th>
                                    <th>Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {topPerformers.map((student, idx) => (
                                    <tr key={`top-${student._id || student.prn || idx}`}>
                                      <td><strong>#{idx + 1}</strong></td>
                                      <td>{student.studentName}</td>
                                      <td>{student.prn}</td>
                                      <td>{student.year}</td>
                                      <td>{student.division}</td>
                                      <td>{Number(student.cgpa || 0).toFixed(2)}</td>
                                      <td>{Number(student.overallAttendance || 0).toFixed(1)}%</td>
                                      <td><strong>{Number(student.performanceScore || 0).toFixed(2)}</strong></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>

                      {studentsAnalysisLoading ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div className="spinner"></div>
                          Loading students analysis...
                        </div>
                      ) : studentsAnalysisError ? (
                        <p style={{ color: 'var(--danger)' }}>{studentsAnalysisError}</p>
                      ) : facultyStudentsAnalysis.length === 0 ? (
                        <p style={{ color: 'var(--muted)' }}>No students found for analysis.</p>
                      ) : (
                        <div className="table-responsive">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Student Name</th>
                                <th>PRN</th>
                                <th>Year</th>
                                <th>Division</th>
                                <th>Placement</th>
                                <th>Company</th>
                                <th>Package</th>
                                <th>Score</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {facultyStudentsAnalysis.map((student) => (
                                <tr key={student._id}>
                                  <td>{student.studentName}</td>
                                  <td>{student.prn}</td>
                                  <td>{student.year}</td>
                                  <td>{student.division}</td>
                                  <td>{student.placementStatus || 'Not Eligible'}</td>
                                  <td>{student.companyName || '-'}</td>
                                  <td>{student.package ?? '-'}</td>
                                  <td>{Number(student.performanceScore || 0).toFixed(2)}</td>
                                  <td>{student.status}</td>
                                  <td>
                                    <button
                                      className="btn-small btn-primary"
                                      onMouseEnter={() => prefetchStudentAnalysis(student._id)}
                                      onFocus={() => prefetchStudentAnalysis(student._id)}
                                      onClick={() => openStudentAnalysisModal(student)}
                                    >
                                      Analysis
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  )}

                  {activeTab === 'Placements' && (
                    <div>
                      <div className="card">
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

                  {activeTab === 'Timetable' && (
                    <div>
                      {facultyTimetableLoading ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div className="spinner"></div>
                        </div>
                      ) : (
                        <TimetableBoard
                          timetable={facultyTimetable}
                          entries={facultyTimetableEntries}
                          title="My Teaching Timetable"
                          subtitle="Weekly faculty schedule"
                          highlightCurrent
                          allowPrint
                          allowExport
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Notification Center Modal */}
      {showStudentAnalysisModal && (
        <div className="modal-overlay" onClick={() => setShowStudentAnalysisModal(false)}>
          <div
            className="modal student-analysis-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                <FaChartLine /> Student Full Analysis
                {selectedStudentMeta?.studentName ? ` - ${selectedStudentMeta.studentName}` : ''}
              </h3>
              <button onClick={() => setShowStudentAnalysisModal(false)} className="btn-close">×</button>
            </div>

            <div className="modal-body">
              {selectedStudentAnalysisLoading && (
                <div className="analysis-loading-state">
                  <div className="spinner"></div>
                  <p>Preparing student analysis...</p>
                </div>
              )}

              {!selectedStudentAnalysisLoading && selectedStudentAnalysisError && (
                <p style={{ color: 'var(--danger)', margin: 0 }}>{selectedStudentAnalysisError}</p>
              )}

              {!selectedStudentAnalysisLoading && selectedStudentAnalysis && (
                <>
                  {selectedStudentAnalysis.error ? (
                    <p style={{ color: 'var(--danger)' }}>{selectedStudentAnalysis.error}</p>
                  ) : (
                    <>
                      <div className="output-grid" style={{ marginBottom: '1rem' }}>
                        <div><strong>Name:</strong> {selectedStudentAnalysis.student?.studentName}</div>
                        <div><strong>PRN:</strong> {selectedStudentAnalysis.student?.prn}</div>
                        <div><strong>Year:</strong> {selectedStudentAnalysis.student?.year}</div>
                        <div><strong>Division:</strong> {selectedStudentAnalysis.student?.division}</div>
                        <div><strong>Placement:</strong> {selectedStudentAnalysis.student?.placementStatus || 'Not Eligible'}</div>
                        <div><strong>Company:</strong> {selectedStudentAnalysis.student?.companyName || '-'}</div>
                        <div><strong>Package:</strong> {selectedStudentAnalysis.student?.package ?? '-'}</div>
                        <div><strong>Category:</strong> {selectedPerformance?.performance_category || '-'}</div>
                        <div><strong>Risk:</strong> {selectedPerformance?.risk_level || '-'}</div>
                      </div>

                      <div className="charts-grid">
                        <div className="chart-card">
                          <h3>Performance Components</h3>
                          <div className="chart-container">
                            <Bar
                              data={selectedPerformanceChartData}
                              options={{ responsive: true, plugins: { legend: { display: false } } }}
                            />
                          </div>
                        </div>
                        <div className="chart-card">
                          <h3>Placement Probability</h3>
                          <div className="chart-container">
                            <Doughnut
                              data={selectedRiskChartData}
                              options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="charts-grid" style={{ marginTop: '1rem' }}>
                        <div className="chart-card">
                          <h3>Semester SGPA Trend</h3>
                          <div className="chart-container">
                            {selectedTrendChartData.labels.length > 0 ? (
                              <Line
                                data={selectedTrendChartData}
                                options={{ responsive: true, plugins: { legend: { display: false } } }}
                              />
                            ) : (
                              <div style={{ color: 'var(--muted)' }}>No semester trend data available.</div>
                            )}
                          </div>
                        </div>
                        <div className="chart-card">
                          <h3>Top Subject Scores</h3>
                          <div className="chart-container">
                            {selectedSubjectChartData.labels.length > 0 ? (
                              <Bar
                                data={selectedSubjectChartData}
                                options={{ responsive: true, plugins: { legend: { display: false } } }}
                              />
                            ) : (
                              <div style={{ color: 'var(--muted)' }}>No subject score data available.</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="card" style={{ marginTop: '1rem' }}>
                        <div className="card-header">
                          <h3 className="card-title">Personalized Recommendations</h3>
                        </div>
                        <div className="card-body">
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            {(selectedPerformance?.recommendations || []).map((rec, idx) => (
                              <li key={`rec-${idx}`}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notification Center Modal */}
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
              <h2 className="card-title"><FaUser /> Faculty Profile</h2>
              <button className="btn btn-secondary" onClick={() => setShowProfileDetails(false)}><FaTimes /></button>
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
        </div>
      )}

      {/* Notification Center Modal */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3><FaCog /> Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="btn-close">×</button>
            </div>

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

              {settingsTab === 'profile' && (
                <form onSubmit={handleProfileChangeRequest}>
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.facultyName || ''}
                      onChange={(e) => setProfileChangeForm({ ...profileChangeForm, facultyName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={profileChangeForm.email || ''}
                      onChange={(e) => setProfileChangeForm({ ...profileChangeForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.mobileNo || ''}
                      onChange={(e) => setProfileChangeForm({ ...profileChangeForm, mobileNo: e.target.value })}
                      placeholder="Enter 10-digit mobile number"
                    />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.department || ''}
                      onChange={(e) => setProfileChangeForm({ ...profileChangeForm, department: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileChangeForm.designation || ''}
                      onChange={(e) => setProfileChangeForm({ ...profileChangeForm, designation: e.target.value })}
                    />
                  </div>
                  <div className="alert alert-info" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                    ℹ️ <strong>Note:</strong> Your profile change request will be sent to the admin for approval.
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

              {settingsTab === 'password' && (
                <form onSubmit={handlePasswordChangeRequest}>
                  <div className="form-group">
                    <label>Current Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={passwordChangeForm.currentPassword}
                      onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, currentPassword: e.target.value })}
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
                      onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, newPassword: e.target.value })}
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
                      onChange={(e) => setPasswordChangeForm({ ...passwordChangeForm, confirmPassword: e.target.value })}
                      required
                      placeholder="Re-enter new password"
                      minLength="6"
                    />
                  </div>
                  <div className="alert alert-info" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
                    ℹ️ <strong>Note:</strong> Your password change request will be sent to the admin for approval.
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

export default FacultyDashboard;