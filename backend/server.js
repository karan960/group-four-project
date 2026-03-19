
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();

// Middleware
const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001'
];

const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredCorsOrigins])];

const isPrivateNetworkFrontendOrigin = (origin) =>
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/.test(origin) ||
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/.test(origin) ||
  /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:3000$/.test(origin);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin) || isPrivateNetworkFrontendOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.options('*', cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/backups', express.static(path.join(__dirname, 'backups')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.xlsx', '.xls', '.csv'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExt)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel and CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Dept_database', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('✅ Connected to MongoDB');
});

// Import Models
const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');
const Notification = require('./models/Notification');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const mlRoutes = require('./routes/mlRoutes');
const mlAnalysisRoutes = require('./routes/mlAnalysisRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const changeRequestRoutes = require('./routes/changeRequestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const courseRoutes = require('./routes/courseRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const timetablePublicRoutes = require('./routes/timetablePublicRoutes');
const attendanceSessionRoutes = require('./routes/attendanceSessionRoutes');

// ==================== MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const jwtSecret = (process.env.JWT_SECRET || '').trim();
    const decoded = require('jsonwebtoken').verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// ==================== MAIN ROUTES ====================

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Campus Connect Backend API v2.0',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    status: 'running',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    endpoints: {
      authentication: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        profile: 'GET /api/auth/profile',
        changePassword: 'POST /api/auth/change-password',
        theme: 'GET /api/auth/theme, PUT /api/auth/theme'
      },
      students: {
        list: 'GET /api/students',
        getOne: 'GET /api/students/:prn',
        profile: 'GET /api/students/:prn/profile',
        create: 'POST /api/students',
        update: 'PUT /api/students/:prn',
        delete: 'DELETE /api/students/:prn',
        addMarks: 'POST /api/students/:prn/marks',
        addAttendance: 'POST /api/students/:prn/attendance',
        stats: 'GET /api/students/stats/summary'
      },
      faculty: {
        list: 'GET /api/faculty',
        getOne: 'GET /api/faculty/:facultyId',
        profile: 'GET /api/faculty/:facultyId/profile',
        create: 'POST /api/faculty',
        update: 'PUT /api/faculty/:facultyId',
        delete: 'DELETE /api/faculty/:facultyId',
        assignSubject: 'POST /api/faculty/:facultyId/subjects',
        stats: 'GET /api/faculty/stats/summary'
      },
      ml: {
        predict: 'POST /api/ml/predict/:prn',
        batchPredict: 'POST /api/ml/predict/batch',
        atRisk: 'GET /api/ml/at-risk'
      },
      dashboard: {
        admin: 'GET /api/dashboard/admin/dashboard',
        student: 'GET /api/dashboard/student/:prn',
        faculty: 'GET /api/dashboard/faculty/:facultyId',
        placement: 'GET /api/dashboard/placement/stats'
      },
      adminMaintenance: {
        resetDatabase: 'POST /api/admin/reset-database'
      },
      upload: 'POST /api/upload-excel'
    }
  });
});

// Use Route Modules
app.use('/api/auth', authRoutes);
app.use('/api/students', authMiddleware, studentRoutes);
app.use('/api/faculty', authMiddleware, facultyRoutes);
app.use('/api/ml', authMiddleware, mlRoutes);
app.use('/api/ml-analysis', authMiddleware, mlAnalysisRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/change-requests', authMiddleware, changeRequestRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/assignments', authMiddleware, assignmentRoutes);
app.use('/api/attendance-sessions', authMiddleware, attendanceSessionRoutes);
app.use('/api', authMiddleware, timetableRoutes);
app.use('/api', timetablePublicRoutes);

// ==================== ADMIN MAINTENANCE ====================
app.post('/api/admin/reset-database', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { confirmationText, preserveAdminUsers = true } = req.body || {};

    if (confirmationText !== 'DELETE ALL DATA') {
      return res.status(400).json({
        message: 'Invalid confirmation text. Use "DELETE ALL DATA" to proceed.'
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database is not connected' });
    }

    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    const deleteSummary = {};

    for (const { name } of collections) {
      if (!name) continue;

      if (name === 'users' && preserveAdminUsers) {
        const result = await User.deleteMany({ role: { $ne: 'admin' } });
        deleteSummary[name] = result.deletedCount || 0;
      } else {
        const result = await mongoose.connection.collection(name).deleteMany({});
        deleteSummary[name] = result.deletedCount || 0;
      }
    }

    const totalDeleted = Object.values(deleteSummary).reduce((sum, count) => sum + count, 0);

    res.json({
      message: 'Database reset completed successfully',
      performedBy: req.user?.username || 'admin',
      preserveAdminUsers,
      totalDeleted,
      deleteSummary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reset database', error: error.message });
  }
});

// ==================== EXCEL UPLOAD ENDPOINT ====================
app.post('/api/upload-excel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { type, mapping } = req.body;
    const columnMap = mapping ? JSON.parse(mapping) : {};
    const filePath = req.file.path;

    console.log('\n🟢 UPLOAD START - Type:', type, '| Mapping:', columnMap);

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data.length) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    // Log column names for debugging
    if (data[0]) {
      console.log('Excel columns found:', Object.keys(data[0]));
    }

    const defaults = {
      students: {
        srNo: ['Sr. No.', 'Sr No', 'S.No', 'sno', 'srNo', 'SR NO'],
        status: ['Status', 'status'],
        prn: ['PRN', 'prn', 'PRN NO', 'PRN No', 'PRN_NO'],
        seatNo: ['Seat no', 'Seat No', 'seatNo', 'Seat Number', 'Seat No.'],
        rollNo: ['Roll No', 'Roll No.', 'rollNo', 'rollno', 'Roll'],
        studentName: ['Student Name', 'Student Name ', 'studentName', 'Name of Student', 'name'],
        year: ['Year', 'year'],
        department: ['Department', 'department', 'Dept', 'dept'],
        branch: ['Branch', 'branch'],
        division: ['Division', 'division', 'Div', 'div'],
        email: ['Email', 'email'],
        mobileNo: ['Mobile No', 'Mobile No.', 'mobileNo', 'mobile', 'Phone'],
        fatherName: ['Father Name', 'fatherName'],
        motherName: ['Mother Name', 'motherName'],
        gender: ['Gender', 'gender'],
        admissionYear: ['Admission Year', 'admissionYear']
      },
      faculty: {
        facultyId: ['Faculty ID', 'facultyId', 'id'],
        facultyName: ['Faculty Name', 'facultyName', 'name'],
        email: ['Email', 'email'],
        mobileNo: ['Mobile No', 'mobileNo', 'mobile'],
        department: ['Department', 'department'],
        designation: ['Designation', 'designation'],
        qualification: ['Qualification', 'qualification'],
        experience: ['Experience', 'experience']
      },
      marks: {
        prn: ['PRN', 'prn', 'PRN NO', 'PRN No', 'PRN_NO'],
        semester: ['Semester', 'semester', 'Sem', 'sem'],
        year: ['Year', 'year'],
        seatNo: ['Seat no', 'Seat No', 'seatNo', 'Seat Number'],
        studentName: ['Name of Student', 'Name of S', 'Student Name', 'Name'],
        subjectCode: ['Subject Code', 'subjectCode'],
        subjectName: ['Subject Name', 'subjectName'],
        internalMarks: ['Internal Marks', 'internalMarks'],
        externalMarks: ['External Marks', 'externalMarks'],
        totalMarks: ['Total Marks', 'totalMarks'],
        credits: ['Credits', 'credits'],
        grade: ['Grade', 'grade'],
        inSemSub1: ['IN SEM sub 1', 'In SEM sub 1', 'INSEM sub 1', 'internal sem sub 1', 'IN SEM SUB 1', 'IN SEM sul', 'Internal Sub 1', 'InSem Sub 1', 'In-Sem Sub 1', 'Sem 1 Internal', 'subject 1 internal'],
        inSemSub2: ['IN SEM sub 2', 'In SEM sub 2', 'INSEM sub 2', 'internal sem sub 2', 'IN SEM SUB 2', 'Internal Sub 2', 'InSem Sub 2', 'In-Sem Sub 2', 'Sem 2 Internal', 'subject 2 internal'],
        inSemSub3: ['IN SEM sub 3', 'In SEM sub 3', 'INSEM sub 3', 'internal sem sub 3', 'IN SEM SUB 3', 'Internal Sub 3', 'InSem Sub 3', 'In-Sem Sub 3', 'Sem 3 Internal', 'subject 3 internal'],
        inSemSub4: ['IN SEM sub 4', 'In SEM sub 4', 'INSEM sub 4', 'internal sem sub 4', 'IN SEM SUB 4', 'Internal Sub 4', 'InSem Sub 4', 'In-Sem Sub 4', 'Sem 4 Internal', 'subject 4 internal'],
        inSemSub5: ['IN SEM sub 5', 'In SEM sub 5', 'INSEM sub 5', 'internal sem sub 5', 'IN SEM SUB 5', 'Internal Sub 5', 'InSem Sub 5', 'In-Sem Sub 5', 'Sem 5 Internal', 'subject 5 internal'],
        inSemTotal: ['IN SEM Total', 'In SEM Total', 'INSEM Total', 'internal sem total', 'IN SEM TOTAL', 'IN SEM To', 'Internal Total', 'InSem Total', 'In-Sem Total'],
        inSemPercentage: ['IN SEM Percentage', 'In SEM Percentage', 'INSEM Percentage', 'internal sem percentage', 'IN SEM PERCENTAGE', 'IN SEM Pe', 'Internal Percentage', 'InSem Percentage', 'In-Sem Percentage', 'Internal %'],
        endSemSub1: ['END SEM sub 1', 'End SEM sub 1', 'ENDSEM sub 1', 'external sem sub 1', 'END SEM SUB 1', 'END SEM s', 'External Sub 1', 'EndSem Sub 1', 'End-Sem Sub 1', 'Sem 1 External', 'subject 1 external'],
        endSemSub2: ['END SEM sub 2', 'End SEM sub 2', 'ENDSEM sub 2', 'external sem sub 2', 'END SEM SUB 2', 'END SEM r', 'External Sub 2', 'EndSem Sub 2', 'End-Sem Sub 2', 'Sem 2 External', 'subject 2 external'],
        endSemSub3: ['END SEM sub 3', 'End SEM sub 3', 'ENDSEM sub 3', 'external sem sub 3', 'END SEM SUB 3', 'External Sub 3', 'EndSem Sub 3', 'End-Sem Sub 3', 'Sem 3 External', 'subject 3 external'],
        endSemSub4: ['END SEM sub 4', 'End SEM sub 4', 'ENDSEM sub 4', 'external sem sub 4', 'END SEM SUB 4', 'External Sub 4', 'EndSem Sub 4', 'End-Sem Sub 4', 'Sem 4 External', 'subject 4 external'],
        endSemSub5: ['END SEM sub 5', 'End SEM sub 5', 'ENDSEM sub 5', 'external sem sub 5', 'END SEM SUB 5', 'External Sub 5', 'EndSem Sub 5', 'End-Sem Sub 5', 'Sem 5 External', 'subject 5 external'],
        endSemTotal: ['END SEM Total', 'End SEM Total', 'ENDSEM Total', 'external sem total', 'END SEM TOTAL', 'END SEM T', 'External Total', 'EndSem Total', 'End-Sem Total'],
        endSemPercentage: ['END SEM Percentage', 'End SEM Percentage', 'ENDSEM Percentage', 'external sem percentage', 'END SEM PERCENTAGE', 'END SEM I', 'External Percentage', 'EndSem Percentage', 'End-Sem Percentage', 'External %'],
        cgpa: ['CGPA', 'cgpa', 'CGPA', 'GPA', 'gpa']
      },
      attendance: {
        srNo: ['Sr. No.', 'Sr No', 'Sr No.', 'srNo', 'SR NO', 'Sr.No', 'sr no'],
        prn: ['PRN', 'prn', 'PRN NO', 'PRN No', 'PRN_NO', 'PRN.NO'],
        status: ['Status', 'status', 'Status'],
        rollNo: ['Roll No.', 'Roll No', 'rollNo', 'rollno', 'Roll', 'Roll Number'],
        studentName: ['Student Name', 'studentName', 'Name', 'Student Name ', 'name of student'],
        department: ['Department', 'department', 'Dept', 'dept', 'Dept.'],
        month: ['Month', 'month', 'Month Name'],
        year: ['Year', 'year', 'Year of Study'],
        subjectName: ['Subject Name', 'subjectName', 'Subject', 'Subject Code'],
        totalClasses: ['Total Classes', 'totalClasses', 'Total Lectures', 'total'],
        attendedClasses: ['Attended Classes', 'attendedClasses', 'Attended', 'Attended Lectures'],
        dsaTotalLectures: ['DSA - Total Lectures', 'DSA Total Lectures', 'DSA-Total Lectures', 'dsa total', 'DSA Total', 'DSA TOTAL LECTURES'],
        dsaAttended: ['DSA - Attended', 'DSA Attended', 'DSA-Attended', 'dsa attended', 'DSA ATTENDED'],
        dsaPercentage: ['DSA - Percentage', 'DSA Percentage', 'DSA-Percentage', 'dsa %', 'DSA Percentage %', 'DSA PERCENTAGE'],
        oopTotalLectures: ['OOP - Total Lectures', 'OOP Total Lectures', 'OOP-Total Lectures', 'oop total', 'OOP Total', 'OOP TOTAL LECTURES'],
        oopAttended: ['OOP - Attended', 'OOP Attended', 'OOP-Attended', 'oop attended', 'OOP ATTENDED'],
        oopPercentage: ['OOP - Percentage', 'OOP Percentage', 'OOP-Percentage', 'oop %', 'OOP Percentage %', 'OOP PERCENTAGE'],
        bcnTotalLectures: ['BCN - Total Lectures', 'BCN Total Lectures', 'BCN-Total Lectures', 'bcn total', 'BCN Total', 'BCN TOTAL LECTURES'],
        bcnAttended: ['BCN - Attended', 'BCN Attended', 'BCN-Attended', 'bcn attended', 'BCN ATTENDED'],
        bcnPercentage: ['BCN - Percentage', 'BCN Percentage', 'BCN-Percentage', 'bcn %', 'BCN Percentage %', 'BCN PERCENTAGE'],
        openElective1TotalLectures: ['Open Elective-1 - Total Lectures', 'Open Elective 1 - Total Lectures', 'Open Elective 1 Total', 'Open Elective1 Total'],
        openElective1Attended: ['Open Elective-1 - Attended', 'Open Elective 1 - Attended', 'Open Elective 1 Attended'],
        openElective1Percentage: ['Open Elective-1 - Percentage', 'Open Elective 1 - Percentage', 'Open Elective 1 Percentage'],
        deldTotalLectures: ['DELD - Total Lectures', 'DELD Total Lectures', 'DELD-Total Lectures', 'deld total', 'DELD Total', 'DELD TOTAL LECTURES'],
        deldAttended: ['DELD - Attended', 'DELD Attended', 'DELD-Attended', 'deld attended', 'DELD ATTENDED'],
        deldPercentage: ['DELD - Percentage', 'DELD Percentage', 'DELD-Percentage', 'deld %', 'DELD Percentage %', 'DELD PERCENTAGE'],
        pmeTotalLectures: ['PME - Total Lectures', 'PME Total Lectures', 'PME-Total Lectures', 'pme total', 'PME Total', 'PME TOTAL LECTURES'],
        pmeAttended: ['PME - Attended', 'PME Attended', 'PME-Attended', 'pme attended', 'PME ATTENDED'],
        pmePercentage: ['PME - Percentage', 'PME Percentage', 'PME-Percentage', 'pme %', 'PME Percentage %', 'PME PERCENTAGE'],
        uhvTotalLectures: ['UHV - Total Lectures', 'UHV Total Lectures', 'UHV-Total Lectures', 'uhv total', 'UHV Total', 'UHV TOTAL LECTURES'],
        uhvAttended: ['UHV - Attended', 'UHV Attended', 'UHV-Attended', 'uhv attended', 'UHV ATTENDED'],
        uhvPercentage: ['UHV - Percentage', 'UHV Percentage', 'UHV-Percentage', 'uhv %', 'UHV Percentage %', 'UHV PERCENTAGE'],
        dsalTotalPracticals: ['DSAL - Total Practicals', 'DSAL Total Practicals', 'DSAL-Total Practicals', 'dsal total', 'DSAL Total', 'DSAL TOTAL PRACTICALS'],
        dsalAttended: ['DSAL - Attended', 'DSAL Attended', 'DSAL-Attended', 'dsal attended', 'DSAL ATTENDED'],
        dsalPercentage: ['DSAL - Percentage', 'DSAL Percentage', 'DSAL-Percentage', 'dsal %', 'DSAL Percentage %', 'DSAL PERCENTAGE'],
        ooplTotalPracticals: ['OOPL - Total Practicals', 'OOPL Total Practicals', 'OOPL-Total Practicals', 'oopl total', 'OOPL Total', 'OOPL TOTAL PRACTICALS'],
        ooplAttended: ['OOPL - Attended', 'OOPL Attended', 'OOPL-Attended', 'oopl attended', 'OOPL ATTENDED'],
        ooplPercentage: ['OOPL - Percentage', 'OOPL Percentage', 'OOPL-Percentage', 'oopl %', 'OOPL Percentage %', 'OOPL PERCENTAGE'],
        ceplTotalPracticals: ['CEPL - Total Practicals', 'CEPL Total Practicals', 'CEPL-Total Practicals', 'cepl total', 'CEPL Total', 'CEPL TOTAL PRACTICALS'],
        ceplAttended: ['CEPL - Attended', 'CEPL Attended', 'CEPL-Attended', 'cepl attended', 'CEPL ATTENDED'],
        ceplPercentage: ['CEPL - Percentage', 'CEPL Percentage', 'CEPL-Percentage', 'cepl %', 'CEPL Percentage %', 'CEPL PERCENTAGE'],
        pmelTotalPracticals: ['PMEL - Total Practicals', 'PMEL Total Practicals', 'PMEL-Total Practicals', 'pmel total', 'PMEL Total', 'PMEL TOTAL PRACTICALS'],
        pmelAttended: ['PMEL - Attended', 'PMEL Attended', 'PMEL-Attended', 'pmel attended', 'PMEL ATTENDED'],
        pmelPercentage: ['PMEL - Percentage', 'PMEL Percentage', 'PMEL-Percentage', 'pmel %', 'PMEL Percentage %', 'PMEL PERCENTAGE'],
        totalTheoryLecturesAttended: ['Total Theory Lectures Attended', 'total theory lectures attended', 'Theory Lectures Attended', 'total theory attended'],
        totalLabPracticalsAttended: ['Total Lab Practicals Attended', 'total lab practicals attended', 'Lab Practicals Attended', 'total lab attended']
      }
    };

    const getVal = (row, logicalKey, typeKey) => {
      const keys = (columnMap[logicalKey] ? [].concat(columnMap[logicalKey]) : defaults[typeKey]?.[logicalKey]) || [];
      
      // First try exact match
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
      }
      
      // Then try case-insensitive and trimmed match
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const normalizedKey = k.toLowerCase().trim();
        const foundKey = rowKeys.find(rk => rk.toLowerCase().trim() === normalizedKey);
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
          return row[foundKey];
        }
      }
      
      // Finally try partial match (contains)
      for (const k of keys) {
        const normalizedKey = k.toLowerCase().trim();
        const foundKey = rowKeys.find(rk => rk.toLowerCase().includes(normalizedKey) || normalizedKey.includes(rk.toLowerCase()));
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
          return row[foundKey];
        }
      }
      
      return undefined;
    };

    let results = {
      total: data.length,
      successful: 0,
      failed: 0,
      errors: [],
      created: [],
      updated: []
    };

    if (type === 'students') {
      for (const [index, row] of data.entries()) {
        try {
          const studentData = {
            srNo: Number(getVal(row, 'srNo', 'students')) || undefined,
            status: getVal(row, 'status', 'students'),
            prn: getVal(row, 'prn', 'students'),
            seatNo: getVal(row, 'seatNo', 'students'),
            rollNo: getVal(row, 'rollNo', 'students'),
            studentName: getVal(row, 'studentName', 'students'),
            year: getVal(row, 'year', 'students'),
            department: getVal(row, 'department', 'students'),
            branch: getVal(row, 'branch', 'students'),
            division: getVal(row, 'division', 'students'),
            email: getVal(row, 'email', 'students'),
            mobileNo: getVal(row, 'mobileNo', 'students'),
            fatherName: getVal(row, 'fatherName', 'students'),
            motherName: getVal(row, 'motherName', 'students'),
            gender: getVal(row, 'gender', 'students'),
            admissionYear: getVal(row, 'admissionYear', 'students')
          };

          if (!studentData.prn || !studentData.rollNo || !studentData.studentName) {
            throw new Error('Missing required fields (PRN, Roll No, Name)');
          }

          const existingStudent = await Student.findOne({ prn: studentData.prn });
          
          if (existingStudent) {
            await Student.findOneAndUpdate({ prn: studentData.prn }, studentData);
            const defaultPassword = await bcrypt.hash(studentData.prn, 10);
            const existingUser = await User.findOne({ username: studentData.prn });
            if (existingUser) {
              existingUser.password = defaultPassword;
              existingUser.plainPassword = studentData.prn;
              existingUser.role = 'student';
              existingUser.referenceId = studentData.prn;
              existingUser.isActive = true;
              await existingUser.save();
            } else {
              await User.create({
                username: studentData.prn,
                password: defaultPassword,
                plainPassword: studentData.prn,
                role: 'student',
                referenceId: studentData.prn,
                isActive: true
              });
            }
            results.updated.push(studentData.prn);
          } else {
            const student = new Student(studentData);
            await student.save();

            const defaultPassword = await bcrypt.hash(studentData.prn, 10);
            const existingUser = await User.findOne({ username: studentData.prn });
            if (existingUser) {
              existingUser.password = defaultPassword;
              existingUser.plainPassword = studentData.prn;
              existingUser.role = 'student';
              existingUser.referenceId = studentData.prn;
              existingUser.isActive = true;
              await existingUser.save();
            } else {
              await User.create({
                username: studentData.prn,
                password: defaultPassword,
                plainPassword: studentData.prn, // Store original password for admin display
                role: 'student',
                referenceId: studentData.prn,
                isActive: true
              });
            }

            results.created.push(studentData.prn);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else if (type === 'faculty') {
      for (const [index, row] of data.entries()) {
        try {
          const facultyData = {
            facultyId: getVal(row, 'facultyId', 'faculty'),
            facultyName: getVal(row, 'facultyName', 'faculty'),
            email: getVal(row, 'email', 'faculty'),
            mobileNo: getVal(row, 'mobileNo', 'faculty'),
            department: getVal(row, 'department', 'faculty'),
            designation: getVal(row, 'designation', 'faculty'),
            qualification: getVal(row, 'qualification', 'faculty'),
            experience: getVal(row, 'experience', 'faculty')
          };

          if (!facultyData.facultyId || !facultyData.facultyName) {
            throw new Error('Missing required fields (Faculty ID, Name)');
          }

          const existingFaculty = await Faculty.findOne({ facultyId: facultyData.facultyId });
          
          if (existingFaculty) {
            await Faculty.findOneAndUpdate({ facultyId: facultyData.facultyId }, facultyData);
            results.updated.push(facultyData.facultyId);
          } else {
            const faculty = new Faculty(facultyData);
            await faculty.save();

            const defaultPassword = await bcrypt.hash(facultyData.facultyId, 10);
            await User.create({
              username: facultyData.facultyId,
              password: defaultPassword,
              plainPassword: facultyData.facultyId, // Store original password for admin display
              role: 'faculty',
              referenceId: facultyData.facultyId
            });

            results.created.push(facultyData.facultyId);
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else if (type === 'marks') {
      // Log first row columns for debugging
      if (data.length > 0) {
        const firstRowCols = Object.keys(data[0]);
        console.log('\n📊 MARKS UPLOAD DEBUG - First Row Columns:');
        console.log(firstRowCols);
      }

      for (const [index, row] of data.entries()) {
        try {
          const prn = getVal(row, 'prn', 'marks');
          let semester = Number(getVal(row, 'semester', 'marks'));
          const yearStr = getVal(row, 'year', 'marks');
          
          // If semester is not provided, derive from year (First->1, Second->3, Third->5, Fourth->7)
          if (!semester && yearStr) {
            const yearMap = { 'First': 1, 'Second': 3, 'Third': 5, 'Fourth': 7 };
            semester = yearMap[yearStr] || 1;
          }
          
          if (!prn) throw new Error('Missing required field: PRN');
          if (!semester) throw new Error('Missing required field: Semester or Year');

          const student = await Student.findOne({ prn });
          if (!student) throw new Error(`Student not found for PRN ${prn}`);

          // Check if this is multi-subject format (5 internal + 5 external subjects)
          const inSem1 = getVal(row, 'inSemSub1', 'marks');
          const endSem1 = getVal(row, 'endSemSub1', 'marks');
          
          if (index === 0) {
            console.log(`\n📌 Row 0: PRN=${prn}, Semester=${semester}, Year=${yearStr}`);
            console.log(`   inSem1=${inSem1}, endSem1=${endSem1}`);
            console.log(`   Format: ${(inSem1 !== undefined || endSem1 !== undefined) ? 'MULTI-SUBJECT' : 'SINGLE-SUBJECT'}`);
          }          let subjects = [];
          
          if (inSem1 !== undefined || endSem1 !== undefined) {
            // Multi-subject format - process 5 subjects
            for (let i = 1; i <= 5; i++) {
              const internalMarks = Number(getVal(row, `inSemSub${i}`, 'marks')) || 0;
              const externalMarks = Number(getVal(row, `endSemSub${i}`, 'marks')) || 0;
              const totalMarks = internalMarks + externalMarks;
              
              // Only add subject if there are marks
              if (totalMarks > 0) {
                let grade = '';
                if (totalMarks >= 90) grade = 'O';
                else if (totalMarks >= 80) grade = 'A+';
                else if (totalMarks >= 70) grade = 'A';
                else if (totalMarks >= 60) grade = 'B+';
                else if (totalMarks >= 55) grade = 'B';
                else if (totalMarks >= 50) grade = 'C';
                else if (totalMarks >= 45) grade = 'P';
                else grade = 'F';
                
                subjects.push({
                  subjectCode: `SUB${i}`,
                  subjectName: `Subject ${i}`,
                  internalMarks,
                  externalMarks,
                  totalMarks,
                  credits: 4,
                  grade
                });
              }
            }
          } else {
            // Single subject format
            const subjectEntry = {
              subjectCode: getVal(row, 'subjectCode', 'marks') || 'SUB1',
              subjectName: getVal(row, 'subjectName', 'marks') || 'Subject',
              internalMarks: Number(getVal(row, 'internalMarks', 'marks')) || 0,
              externalMarks: Number(getVal(row, 'externalMarks', 'marks')) || 0,
              totalMarks: Number(getVal(row, 'totalMarks', 'marks')) || 0,
              credits: Number(getVal(row, 'credits', 'marks')) || 4,
              grade: getVal(row, 'grade', 'marks') || ''
            };

            if (!subjectEntry.totalMarks) {
              subjectEntry.totalMarks = subjectEntry.internalMarks + subjectEntry.externalMarks;
            }
            
            if (!subjectEntry.grade) {
              const tm = subjectEntry.totalMarks;
              if (tm >= 90) subjectEntry.grade = 'O';
              else if (tm >= 80) subjectEntry.grade = 'A+';
              else if (tm >= 70) subjectEntry.grade = 'A';
              else if (tm >= 60) subjectEntry.grade = 'B+';
              else if (tm >= 55) subjectEntry.grade = 'B';
              else if (tm >= 50) subjectEntry.grade = 'C';
              else if (tm >= 45) subjectEntry.grade = 'P';
              else subjectEntry.grade = 'F';
            }
            
            subjects.push(subjectEntry);
          }

          if (subjects.length === 0) {
            throw new Error('No valid subject marks found');
          }

          const gradePoints = { O: 10, 'A+': 10, A: 9, 'B+': 8, B: 7, C: 6, P: 5, F: 0 };

          let semesterEntry = student.semesterMarks.find(s => s.semester === semester);
          if (!semesterEntry) {
            semesterEntry = { semester, year: yearStr, subjects: [], sgpa: 0 };
            student.semesterMarks.push(semesterEntry);
          } else {
            // Append to existing subjects
            semesterEntry.subjects = semesterEntry.subjects || [];
          }
          
          // Add all subjects
          subjects.forEach(sub => semesterEntry.subjects.push(sub));

          // Calculate SGPA
          const totalGp = semesterEntry.subjects.reduce((acc, s) => {
            const gp = gradePoints[s.grade?.toUpperCase()] ?? Math.min(10, Math.max(0, (s.totalMarks || 0) / 10));
            return acc + gp;
          }, 0);
          semesterEntry.sgpa = Number((totalGp / semesterEntry.subjects.length).toFixed(2));

          // Update CGPA from provided value or calculate
          const providedCgpa = Number(getVal(row, 'cgpa', 'marks'));
          if (providedCgpa && providedCgpa > 0) {
            student.cgpa = Number(providedCgpa.toFixed(2));
          } else {
            const avgCgpa = student.semesterMarks.reduce((acc, sem) => acc + (sem.sgpa || 0), 0) / (student.semesterMarks.length || 1);
            student.cgpa = Number(avgCgpa.toFixed(2));
          }

          await student.save();
          results.updated.push(prn);
          results.successful++;
        } catch (error) {
          console.log(`   ❌ Row ${index + 2} Error: ${error.message}`);
          try {
            const prn = getVal(row, 'prn', 'marks');
            const semester = getVal(row, 'semester', 'marks');
            console.log(`      PRN: ${prn}, Semester: ${semester}`);
          } catch (e) {
            console.log(`      Could not extract PRN/Semester`);
          }
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else if (type === 'attendance') {
      // Log first row columns for attendance debugging
      if (data.length > 0) {
        const firstRowCols = Object.keys(data[0]);
        console.log('\n📊 ATTENDANCE UPLOAD DEBUG - First Row Columns:');
        console.log(firstRowCols);
        console.log('\n📌 Checking critical fields on Row 0:');
        const prn = getVal(data[0], 'prn', 'attendance');
        const month = getVal(data[0], 'month', 'attendance');
        const year = getVal(data[0], 'year', 'attendance');
        console.log(`   PRN found: ${prn ? '✅ ' + prn : '❌ NOT FOUND'}`);
        console.log(`   Month found: ${month ? '✅ ' + month : '❌ NOT FOUND'}`);
        console.log(`   Year found: ${year ? '✅ ' + year : '❌ NOT FOUND'}`);
        if (!month || !year) {
          console.log('\n   ⚠️ LOOKING FOR THESE COLUMN NAME VARIANTS:');
          if (!month) {
            console.log(`   Month aliases: ['Month', 'month', 'Month Name']`);
            console.log(`   Actual columns in your Excel: ${firstRowCols.filter(col => col.toLowerCase().includes('month')).join(', ') || 'NONE matching "month"'}`);
          }
          if (!year) {
            console.log(`   Year aliases: ['Year', 'year', 'Year of Study']`);
            console.log(`   Actual columns in your Excel: ${firstRowCols.filter(col => col.toLowerCase().includes('year')).join(', ') || 'NONE matching "year"'}`);
          }
        }
        if (firstRowCols.length > 0 && data[0]) {
          console.log(`\n   First 3 column values:`, Object.entries(data[0]).slice(0, 3).map(([k, v]) => `${k}: "${v}"`).join(', '));
        }
      }

      for (const [index, row] of data.entries()) {
        try {
          const prn = getVal(row, 'prn', 'attendance');
          if (!prn) throw new Error('Missing required field (PRN)');

          const student = await Student.findOne({ prn });
          if (!student) throw new Error(`Student not found for PRN ${prn}`);

          const monthVal = getVal(row, 'month', 'attendance');
          const yearVal = Number(getVal(row, 'year', 'attendance'));

          if (index === 0) {
            console.log(`\n📌 Attendance Row 0: PRN=${prn}, Month=${monthVal}, Year=${yearVal}`);
          }

          const hasDetailedAttendance = [
            'dsaTotalLectures',
            'oopTotalLectures',
            'bcnTotalLectures',
            'openElective1TotalLectures',
            'deldTotalLectures',
            'pmeTotalLectures',
            'uhvTotalLectures',
            'dsalTotalPracticals',
            'ooplTotalPracticals',
            'ceplTotalPracticals',
            'pmelTotalPracticals'
          ].some((key) => getVal(row, key, 'attendance') !== undefined);

          const month = monthVal || 'Overall';
          const year = yearVal || new Date().getFullYear();

          let attendanceEntry = student.attendance.find(a => a.month === month && a.year === year);

          const toNum = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : 0;
          };

          if (hasDetailedAttendance) {
            const buildTheorySubject = (subjectName, totalKey, attendedKey, percentageKey) => {
              const totalLectures = toNum(getVal(row, totalKey, 'attendance'));
              const attendedLectures = toNum(getVal(row, attendedKey, 'attendance'));
              const rawPercentage = getVal(row, percentageKey, 'attendance');
              const percentage = rawPercentage !== undefined && rawPercentage !== null && rawPercentage !== ''
                ? toNum(rawPercentage)
                : (totalLectures > 0 ? Number(((attendedLectures / totalLectures) * 100).toFixed(2)) : 0);

              if (totalLectures <= 0 && attendedLectures <= 0 && !rawPercentage) {
                return null;
              }

              return {
                subjectName,
                totalLectures,
                attendedLectures,
                percentage: Number(percentage.toFixed(2))
              };
            };

            const buildPracticalSubject = (subjectName, totalKey, attendedKey, percentageKey) => {
              const totalPracticals = toNum(getVal(row, totalKey, 'attendance'));
              const attendedPracticals = toNum(getVal(row, attendedKey, 'attendance'));
              const rawPercentage = getVal(row, percentageKey, 'attendance');
              const percentage = rawPercentage !== undefined && rawPercentage !== null && rawPercentage !== ''
                ? toNum(rawPercentage)
                : (totalPracticals > 0 ? Number(((attendedPracticals / totalPracticals) * 100).toFixed(2)) : 0);

              if (totalPracticals <= 0 && attendedPracticals <= 0 && !rawPercentage) {
                return null;
              }

              return {
                subjectName,
                totalPracticals,
                attendedPracticals,
                percentage: Number(percentage.toFixed(2))
              };
            };

            const theorySubjects = [
              buildTheorySubject('DSA', 'dsaTotalLectures', 'dsaAttended', 'dsaPercentage'),
              buildTheorySubject('OOP', 'oopTotalLectures', 'oopAttended', 'oopPercentage'),
              buildTheorySubject('BCN', 'bcnTotalLectures', 'bcnAttended', 'bcnPercentage'),
              buildTheorySubject('Open Elective-1', 'openElective1TotalLectures', 'openElective1Attended', 'openElective1Percentage'),
              buildTheorySubject('DELD', 'deldTotalLectures', 'deldAttended', 'deldPercentage'),
              buildTheorySubject('PME', 'pmeTotalLectures', 'pmeAttended', 'pmePercentage'),
              buildTheorySubject('UHV', 'uhvTotalLectures', 'uhvAttended', 'uhvPercentage')
            ].filter(Boolean);

            const practicalSubjects = [
              buildPracticalSubject('DSAL', 'dsalTotalPracticals', 'dsalAttended', 'dsalPercentage'),
              buildPracticalSubject('OOPL', 'ooplTotalPracticals', 'ooplAttended', 'ooplPercentage'),
              buildPracticalSubject('CEPL', 'ceplTotalPracticals', 'ceplAttended', 'ceplPercentage'),
              buildPracticalSubject('PMEL', 'pmelTotalPracticals', 'pmelAttended', 'pmelPercentage')
            ].filter(Boolean);

            if (theorySubjects.length === 0 && practicalSubjects.length === 0) {
              throw new Error('No valid attendance columns found in detailed format');
            }

            const subjects = [
              ...theorySubjects.map((s) => ({
                subjectName: s.subjectName,
                type: 'theory',
                totalClasses: s.totalLectures,
                attendedClasses: s.attendedLectures,
                percentage: s.percentage
              })),
              ...practicalSubjects.map((s) => ({
                subjectName: s.subjectName,
                type: 'practical',
                totalClasses: s.totalPracticals,
                attendedClasses: s.attendedPracticals,
                percentage: s.percentage
              }))
            ];

            const totalClasses = subjects.reduce((acc, s) => acc + (s.totalClasses || 0), 0);
            const totalAttended = subjects.reduce((acc, s) => acc + (s.attendedClasses || 0), 0);
            const overallPercentage = totalClasses > 0
              ? Number(((totalAttended / totalClasses) * 100).toFixed(2))
              : 0;

            const computedTheoryAttended = theorySubjects.reduce((acc, s) => acc + (s.attendedLectures || 0), 0);
            const computedLabAttended = practicalSubjects.reduce((acc, s) => acc + (s.attendedPracticals || 0), 0);

            const detailedAttendanceData = {
              srNo: toNum(getVal(row, 'srNo', 'attendance')) || undefined,
              status: getVal(row, 'status', 'attendance') || undefined,
              rollNo: getVal(row, 'rollNo', 'attendance') || student.rollNo,
              studentName: getVal(row, 'studentName', 'attendance') || student.studentName,
              department: getVal(row, 'department', 'attendance') || student.branch,
              month,
              year,
              subjects,
              theorySubjects,
              practicalSubjects,
              totalTheoryLecturesAttended: toNum(getVal(row, 'totalTheoryLecturesAttended', 'attendance')) || computedTheoryAttended,
              totalLabPracticalsAttended: toNum(getVal(row, 'totalLabPracticalsAttended', 'attendance')) || computedLabAttended,
              overall: overallPercentage,
              overallPercentage
            };

            if (!attendanceEntry) {
              student.attendance.push(detailedAttendanceData);
            } else {
              Object.assign(attendanceEntry, detailedAttendanceData);
            }
          } else {

            const subjectName = getVal(row, 'subjectName', 'attendance');
            const totalClasses = toNum(getVal(row, 'totalClasses', 'attendance'));
            const attendedClasses = toNum(getVal(row, 'attendedClasses', 'attendance'));
            const percentage = totalClasses > 0 ? Number(((attendedClasses / totalClasses) * 100).toFixed(2)) : 0;

            if (!attendanceEntry) {
              attendanceEntry = { month, year, subjects: [], overall: 0, overallPercentage: 0 };
              student.attendance.push(attendanceEntry);
            }

            attendanceEntry.subjects.push({ subjectName, totalClasses, attendedClasses, percentage });
            const avgOverall = attendanceEntry.subjects.reduce((acc, s) => acc + (s.percentage || 0), 0) / (attendanceEntry.subjects.length || 1);
            attendanceEntry.overall = Number(avgOverall.toFixed(2));
            attendanceEntry.overallPercentage = Number(avgOverall.toFixed(2));
          }

          const monthlyOverall = student.attendance.reduce((acc, a) => acc + (a.overallPercentage || a.overall || 0), 0) / (student.attendance.length || 1);
          student.overallAttendance = Number(monthlyOverall.toFixed(2));

          await student.save();
          results.updated.push(prn);
          results.successful++;
        } catch (error) {
          console.log(`   ❌ Row ${index + 2} Error: ${error.message}`);
          try {
            const prn = getVal(row, 'prn', 'attendance');
            const month = getVal(row, 'month', 'attendance');
            console.log(`      PRN: ${prn}, Month: ${month}`);
          } catch (e) {
            console.log(`      Could not extract PRN/Month`);
          }
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Invalid type. Use "students", "faculty", "marks", or "attendance"' });
    }

    fs.unlinkSync(filePath);

    // Log detailed results
    console.log('\n📋 UPLOAD SUMMARY:');
    console.log(`   Type: ${type}`);
    console.log(`   Successful: ${results.successful}`);
    console.log(`   Failed: ${results.failed}`);
    if (results.updated.length > 0) console.log(`   Updated PRNs: ${results.updated.slice(0, 5).join(', ')}${results.updated.length > 5 ? '...' : ''}`);
    if (results.errors.length > 0) console.log(`   First error: ${results.errors[0]}`);

    res.json({
      message: 'File processed successfully',
      results
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

// ==================== LEGACY ENDPOINTS (for backward compatibility) ====================
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.delete('/api/users/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const userToDelete = await User.findById(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent accidental lockout by deleting your own account.
    if (String(userToDelete._id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    if (userToDelete.role === 'student' && userToDelete.referenceId) {
      await Student.findOneAndUpdate(
        { prn: userToDelete.referenceId },
        { isActive: false, lastUpdated: Date.now() }
      );
    }

    if (userToDelete.role === 'faculty' && userToDelete.referenceId) {
      await Faculty.findOneAndUpdate(
        { facultyId: userToDelete.referenceId },
        { isActive: false, lastUpdated: Date.now() }
      );
    }

    await User.findByIdAndDelete(userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/announcements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { message, target = 'all' } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Announcement message is required' });
    }

    const usersQuery = target === 'all'
      ? { role: { $in: ['student', 'faculty'] }, isActive: true }
      : { role: target, isActive: true };

    const users = await User.find(usersQuery).select('_id role referenceId');
    const recipients = users.map((u) => ({
      userId: u._id,
      role: u.role,
      recipientId: u.referenceId || null
    }));

    const announcement = await Notification.create({
      sender: {
        userId: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        name: req.user.username
      },
      recipients,
      title: 'Admin Announcement',
      message: String(message).trim(),
      type: 'announcement',
      priority: 'normal',
      targetRole: target,
      isPublished: true
    });

    res.status(201).json({
      message: 'Announcement published successfully',
      id: announcement._id,
      recipients: recipients.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [recentUsers, recentNotifications] = await Promise.all([
      User.find()
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(20)
        .select('username role isActive createdAt updatedAt lastLogin'),
      Notification.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .select('message targetRole createdAt sender.username')
    ]);

    const userLogs = recentUsers.map((u) => ({
      timestamp: (u.updatedAt || u.createdAt || new Date()).toISOString(),
      action: u.isActive ? 'User record updated' : 'User deactivated',
      user: u.username,
      status: 'Success',
      role: u.role,
      lastLogin: u.lastLogin || null
    }));

    const notificationLogs = recentNotifications.map((n) => ({
      timestamp: (n.createdAt || new Date()).toISOString(),
      action: 'Announcement sent',
      user: n.sender?.username || 'admin',
      status: 'Success',
      targetRole: n.targetRole,
      detail: n.message
    }));

    const logs = [...userLogs, ...notificationLogs]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 40);

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/backup', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [students, faculty, users, notifications] = await Promise.all([
      Student.find().lean(),
      Faculty.find().lean(),
      User.find().lean(),
      Notification.find().lean()
    ]);

    const backupPayload = {
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.username,
      counts: {
        students: students.length,
        faculty: faculty.length,
        users: users.length,
        notifications: notifications.length
      },
      data: { students, faculty, users, notifications }
    };

    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const fileName = `backup-${Date.now()}.json`;
    const filePath = path.join(backupDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    const stats = fs.statSync(filePath);

    res.json({
      message: 'Backup created successfully',
      fileName,
      path: `/backups/${fileName}`,
      size: `${(stats.size / 1024).toFixed(2)} KB`
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== DIAGNOSTIC ENDPOINTS ====================
// Debug endpoint to check marks data status
app.get('/api/admin/debug/marks-status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const students = await Student.find().select('prn studentName semesterMarks');
    
    const stats = {
      totalStudents: students.length,
      studentsWithMarks: 0,
      totalMarksRecords: 0,
      totalSubjectsRecords: 0,
      details: []
    };
    
    students.forEach(student => {
      if (student.semesterMarks && student.semesterMarks.length > 0) {
        stats.studentsWithMarks++;
        let subjectCount = 0;
        student.semesterMarks.forEach(semester => {
          if (semester.subjects && semester.subjects.length > 0) {
            subjectCount += semester.subjects.length;
            stats.totalMarksRecords++;
          }
        });
        stats.totalSubjectsRecords += subjectCount;
        if (stats.details.length < 5) { // Show first 5 examples
          stats.details.push({
            prn: student.prn,
            studentName: student.studentName,
            semesterCount: student.semesterMarks.length,
            subjectCount: subjectCount
          });
        }
      }
    });
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching marks status', error: error.message });
  }
});

// ==================== ERROR HANDLING ====================
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
  }
  console.error('Error:', error);
  res.status(500).json({ message: 'Something went wrong!', error: error.message });
});

app.use((req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CAMPUS CONNECT BACKEND SERVER v2.0');
  console.log('='.repeat(60));
  console.log(`📍 Server URL: http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_URI}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? '✓ Configured' : '✗ Not Set'}`);
  console.log('='.repeat(60));
  console.log('\n📋 AVAILABLE ROUTES:');
  console.log('  Authentication:');
  console.log('    POST   /api/auth/login');
  console.log('    POST   /api/auth/register');
  console.log('    GET    /api/auth/profile');
  console.log('    POST   /api/auth/change-password');
  console.log('\n  Students:');
  console.log('    GET    /api/students');
  console.log('    GET    /api/students/:prn');
  console.log('    POST   /api/students');
  console.log('    PUT    /api/students/:prn');
  console.log('    DELETE /api/students/:prn');
  console.log('    POST   /api/students/:prn/marks');
  console.log('    POST   /api/students/:prn/attendance');
  console.log('\n  Faculty:');
  console.log('    GET    /api/faculty');
  console.log('    GET    /api/faculty/:facultyId');
  console.log('    POST   /api/faculty');
  console.log('    PUT    /api/faculty/:facultyId');
  console.log('    DELETE /api/faculty/:facultyId');
  console.log('\n  ML & Predictions:');
  console.log('    POST   /api/ml/predict/:prn');
  console.log('    POST   /api/ml/predict/batch');
  console.log('    GET    /api/ml/at-risk');
  console.log('\n  ML Analysis (performance model):');
  console.log('    GET    /api/ml-analysis/student/:studentId');
  console.log('    GET    /api/ml-analysis/student/:studentId/subjects');
  console.log('    GET    /api/ml-analysis/student/:studentId/improvement');
  console.log('    POST   /api/ml-analysis/class-statistics');
  console.log('    POST   /api/ml-analysis/at-risk-students');
  console.log('    POST   /api/ml-analysis/compare-students');
  console.log('    POST   /api/ml-analysis/subject-analysis');
  console.log('    GET    /api/ml-analysis/faculty/:facultyId/dashboard');
  console.log('    GET    /api/ml-analysis/institution-stats');
  console.log('\n  Dashboard:');
  console.log('    GET    /api/dashboard/admin/dashboard');
  console.log('    GET    /api/dashboard/student/:prn');
  console.log('    GET    /api/dashboard/faculty/:facultyId');
  console.log('\n  File Upload:');
  console.log('    POST   /api/upload-excel');
  console.log('\n' + '='.repeat(60));
  console.log('✅ Server is ready to accept requests!');
  console.log('='.repeat(60) + '\n');
});

module.exports = app;
