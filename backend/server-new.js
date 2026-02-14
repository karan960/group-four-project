
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
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
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
const dashboardRoutes = require('./routes/dashboardRoutes');
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
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/notifications', authMiddleware, notificationRoutes);
app.use('/api/courses', authMiddleware, courseRoutes);
app.use('/api/assignments', authMiddleware, assignmentRoutes);

// ==================== EXCEL UPLOAD ENDPOINT ====================
app.post('/api/upload-excel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { type } = req.body;
    const filePath = req.file.path;

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data.length) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Excel file is empty' });
    }

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
            prn: row.PRN || row.prn,
            rollNo: row['Roll No'] || row.rollNo || row.rollno,
            studentName: row['Student Name'] || row.studentName || row.name,
            year: row.Year || row.year,
            branch: row.Branch || row.branch,
            division: row.Division || row.division,
            email: row.Email || row.email,
            mobileNo: row['Mobile No'] || row.mobileNo || row.mobile,
            fatherName: row['Father Name'] || row.fatherName,
            motherName: row['Mother Name'] || row.motherName,
            gender: row.Gender || row.gender,
            admissionYear: row['Admission Year'] || row.admissionYear
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

            // Auto-create user account
            const defaultPassword = await bcrypt.hash(studentData.prn, 10);
            await User.create({
              username: studentData.prn,
              password: defaultPassword,
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
            facultyId: row['Faculty ID'] || row.facultyId || row.id,
            facultyName: row['Faculty Name'] || row.facultyName || row.name,
            email: row.Email || row.email,
            mobileNo: row['Mobile No'] || row.mobileNo || row.mobile,
            department: row.Department || row.department,
            designation: row.Designation || row.designation,
            qualification: row.Qualification || row.qualification,
            experience: row.Experience || row.experience
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

            // Auto-create user account
            const defaultPassword = await bcrypt.hash(facultyData.facultyId, 10);
            await User.create({
              username: facultyData.facultyId,
              password: defaultPassword,
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
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Invalid type. Use "students" or "faculty"' });
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
    const users = await User.find().select('-password').sort({ username: 1 });
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
