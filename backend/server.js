
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

// ==================== EXCEL UPLOAD ENDPOINT ====================
app.post('/api/upload-excel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { type, mapping } = req.body;
    const columnMap = mapping ? JSON.parse(mapping) : {};
    const filePath = req.file.path;

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
        prn: ['PRN', 'prn'],
        rollNo: ['Roll No', 'rollNo', 'rollno'],
        studentName: ['Student Name', 'studentName', 'name'],
        year: ['Year', 'year'],
        branch: ['Branch', 'branch'],
        division: ['Division', 'division'],
        email: ['Email', 'email'],
        mobileNo: ['Mobile No', 'mobileNo', 'mobile'],
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
        inSemSub1: ['IN SEM sub 1', 'IN SEM sul', 'Internal Sub 1'],
        inSemSub2: ['IN SEM sub 2', 'Internal Sub 2'],
        inSemSub3: ['IN SEM sub 3', 'Internal Sub 3'],
        inSemSub4: ['IN SEM sub 4', 'Internal Sub 4'],
        inSemSub5: ['IN SEM sub 5', 'Internal Sub 5'],
        inSemTotal: ['IN SEM Total', 'IN SEM To', 'Internal Total'],
        inSemPercentage: ['IN SEM Percentage', 'IN SEM Pe', 'Internal Percentage'],
        endSemSub1: ['END SEM sub 1', 'END SEM s', 'External Sub 1'],
        endSemSub2: ['END SEM sub 2', 'END SEM r', 'External Sub 2'],
        endSemSub3: ['END SEM sub 3', 'External Sub 3'],
        endSemSub4: ['END SEM sub 4', 'External Sub 4'],
        endSemSub5: ['END SEM sub 5', 'External Sub 5'],
        endSemTotal: ['END SEM Total', 'END SEM T', 'External Total'],
        endSemPercentage: ['END SEM Percentage', 'END SEM I', 'External Percentage'],
        cgpa: ['CGPA', 'cgpa']
      },
      attendance: {
        prn: ['PRN', 'prn'],
        month: ['Month', 'month'],
        year: ['Year', 'year'],
        subjectName: ['Subject Name', 'subjectName'],
        totalClasses: ['Total Classes', 'totalClasses'],
        attendedClasses: ['Attended Classes', 'attendedClasses']
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
            prn: getVal(row, 'prn', 'students'),
            rollNo: getVal(row, 'rollNo', 'students'),
            studentName: getVal(row, 'studentName', 'students'),
            year: getVal(row, 'year', 'students'),
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
            results.updated.push(studentData.prn);
          } else {
            const student = new Student(studentData);
            await student.save();

            const defaultPassword = await bcrypt.hash(studentData.prn, 10);
            await User.create({
              username: studentData.prn,
              password: defaultPassword,
              plainPassword: studentData.prn, // Store original password for admin display
              role: 'student',
              referenceId: studentData.prn
            });

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
          
          let subjects = [];
          
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
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else if (type === 'attendance') {
      for (const [index, row] of data.entries()) {
        try {
          const prn = getVal(row, 'prn', 'attendance');
          const month = getVal(row, 'month', 'attendance');
          const year = Number(getVal(row, 'year', 'attendance'));
          if (!prn || !month || !year) throw new Error('Missing required fields (PRN, Month, Year)');

          const student = await Student.findOne({ prn });
          if (!student) throw new Error(`Student not found for PRN ${prn}`);

          const subjectName = getVal(row, 'subjectName', 'attendance');
          const totalClasses = Number(getVal(row, 'totalClasses', 'attendance')) || 0;
          const attendedClasses = Number(getVal(row, 'attendedClasses', 'attendance')) || 0;
          const percentage = totalClasses > 0 ? Number(((attendedClasses / totalClasses) * 100).toFixed(2)) : 0;

          let attendanceEntry = student.attendance.find(a => a.month === month && a.year === year);
          if (!attendanceEntry) {
            attendanceEntry = { month, year, subjects: [], overall: 0 };
            student.attendance.push(attendanceEntry);
          }

          attendanceEntry.subjects.push({ subjectName, totalClasses, attendedClasses, percentage });
          const avgOverall = attendanceEntry.subjects.reduce((acc, s) => acc + (s.percentage || 0), 0) / (attendanceEntry.subjects.length || 1);
          attendanceEntry.overall = Number(avgOverall.toFixed(2));

          const monthlyOverall = student.attendance.reduce((acc, a) => acc + (a.overall || 0), 0) / (student.attendance.length || 1);
          student.overallAttendance = Number(monthlyOverall.toFixed(2));

          await student.save();
          results.updated.push(prn);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Invalid type. Use "students", "faculty", "marks", or "attendance"' });
    }

    fs.unlinkSync(filePath);

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
