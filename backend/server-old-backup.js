
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// Middleware
// Enhanced CORS configuration
app.use(cors({
  origin: 'http://localhost:3000', // Your React frontend URL
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
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

// ==================== MIDDLEWARE ====================
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

// ==================== ROUTES ====================

// Health check route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Campus Connect Backend is Running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      auth: '/api/login, /api/register, /api/profile',
      admin: '/api/upload-excel, /api/ml/*, /api/stats',
      data: '/api/students, /api/faculty, /api/users'
    }
  });
});

// ==================== AUTHENTICATION ROUTES ====================
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, role, referenceId } = req.body;
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      password: hashedPassword,
      role,
      referenceId
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        referenceId: user.referenceId
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ================ THEME PREFERENCE ROUTES ================
// Get current user's theme preference
app.get('/api/users/me/theme', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('theme');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ theme: user.theme || 'light' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update current user's theme preference
app.put('/api/users/me/theme', authMiddleware, async (req, res) => {
  try {
    const { theme } = req.body;
    if (!['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme value' });
    }
    const user = await User.findByIdAndUpdate(req.user.userId, { theme }, { new: true }).select('theme');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ theme: user.theme });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== EXCEL UPLOAD & DATA PROCESSING ====================
app.post('/api/upload-excel', authMiddleware, adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { type } = req.body; // 'students' or 'faculty'
    const filePath = req.file.path;

    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (!data.length) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    let results = {
      total: data.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    if (type === 'students') {
      // Process student data
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
            mobileNo: row['Mobile No'] || row.mobileNo || row.mobile
          };

          // Validate required fields
          if (!studentData.prn || !studentData.rollNo || !studentData.studentName) {
            throw new Error('Missing required fields (PRN, Roll No, Name)');
          }

          // Check if student already exists
          const existingStudent = await Student.findOne({ prn: studentData.prn });
          if (existingStudent) {
            // Update existing student
            await Student.findOneAndUpdate({ prn: studentData.prn }, studentData);
          } else {
            // Create new student
            const student = new Student(studentData);
            await student.save();
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else if (type === 'faculty') {
      // Process faculty data
      for (const [index, row] of data.entries()) {
        try {
          const facultyData = {
            facultyId: row['Faculty ID'] || row.facultyId || row.id,
            facultyName: row['Faculty Name'] || row.facultyName || row.name,
            email: row.Email || row.email,
            mobileNo: row['Mobile No'] || row.mobileNo || row.mobile,
            department: row.Department || row.department,
            designation: row.Designation || row.designation
          };

          // Validate required fields
          if (!facultyData.facultyId || !facultyData.facultyName) {
            throw new Error('Missing required fields (Faculty ID, Name)');
          }

          // Check if faculty already exists
          const existingFaculty = await Faculty.findOne({ facultyId: facultyData.facultyId });
          if (existingFaculty) {
            // Update existing faculty
            await Faculty.findOneAndUpdate({ facultyId: facultyData.facultyId }, facultyData);
          } else {
            // Create new faculty
            const faculty = new Faculty(facultyData);
            await faculty.save();
          }

          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Row ${index + 2}: ${error.message}`);
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid type specified. Use "students" or "faculty"' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'File processed successfully',
      results: results
    });

  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

// ==================== ML MODEL ENDPOINTS ====================
app.get('/api/ml/status', authMiddleware, (req, res) => {
  // Mock ML model status - in real implementation, this would check the actual model
  res.json({
    status: 'trained',
    accuracy: 85.5,
    lastTrained: new Date('2024-01-15').toISOString(),
    features: ['attendance', 'inSemMarks', 'endSemCGPA', 'credits'],
    performance: {
      excellent: 25,
      good: 45,
      average: 20,
      poor: 10
    }
  });
});

app.post('/api/ml/train', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Mock training process - in real implementation, this would trigger ML training
    res.json({
      message: 'ML model training started',
      trainingId: 'train_' + Date.now(),
      status: 'training',
      estimatedTime: '2-3 minutes'
    });
  } catch (error) {
    res.status(500).json({ message: 'Training failed', error: error.message });
  }
});

app.post('/api/ml/predict', authMiddleware, async (req, res) => {
  try {
    const { attendance, inSemMarks, endSemCGPA, credits } = req.body;

    // Mock prediction - in real implementation, this would use the actual ML model
    const totalScore = (attendance * 0.3) + (inSemMarks * 0.3) + (endSemCGPA * 10 * 0.4);
    
    let prediction, confidence;
    if (totalScore >= 75) {
      prediction = "Excellent";
      confidence = Math.min(95, totalScore + 5);
    } else if (totalScore >= 60) {
      prediction = "Good";
      confidence = Math.min(90, totalScore + 3);
    } else if (totalScore >= 40) {
      prediction = "Average";
      confidence = Math.min(85, totalScore);
    } else {
      prediction = "Poor";
      confidence = Math.min(80, totalScore + 10);
    }

    res.json({
      prediction: prediction,
      confidence: confidence,
      featuresUsed: ['attendance', 'inSemMarks', 'endSemCGPA', 'credits'],
      score: totalScore
    });
  } catch (error) {
    res.status(500).json({ message: 'Prediction failed', error: error.message });
  }
});

// ==================== STATISTICS & ANALYTICS ====================
app.get('/api/stats/overview', authMiddleware, async (req, res) => {
  try {
    const [totalStudents, totalFaculty, totalUsers] = await Promise.all([
      Student.countDocuments(),
      Faculty.countDocuments(),
      User.countDocuments()
    ]);

    // Mock performance distribution
    const performanceDistribution = {
      excellent: Math.floor(totalStudents * 0.25),
      good: Math.floor(totalStudents * 0.45),
      average: Math.floor(totalStudents * 0.20),
      poor: Math.floor(totalStudents * 0.10)
    };

    res.json({
      totalStudents,
      totalFaculty,
      totalUsers,
      performanceDistribution,
      mlModel: {
        accuracy: 85.5,
        status: 'trained',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

app.get('/api/stats/attendance', authMiddleware, async (req, res) => {
  // Mock attendance data
  const attendanceData = {
    weekly: [85, 78, 92, 88, 76, 65, 70],
    monthly: [82, 85, 79, 88, 86, 90, 87, 84, 81, 83, 85, 88],
    byBranch: {
      'Computer Science': 87,
      'Information Technology': 82,
      'Mechanical': 79,
      'Electrical': 84,
      'Civil': 81
    }
  };

  res.json(attendanceData);
});

// ==================== DATA MANAGEMENT ROUTES ====================
app.get('/api/students', authMiddleware, async (req, res) => {
  try {
    const students = await Student.find().sort({ studentName: 1 });
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/students', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json({ message: 'Student created successfully', student });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/faculty', authMiddleware, async (req, res) => {
  try {
    const faculty = await Faculty.find().sort({ facultyName: 1 });
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/faculty', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const faculty = new Faculty(req.body);
    await faculty.save();
    res.status(201).json({ message: 'Faculty created successfully', faculty });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== CRUD OPERATIONS ====================

// Update Student - PUT
app.put('/api/students/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body, 
        lastUpdated: new Date(), 
        updatedBy: req.user.username 
      },
      { new: true, runValidators: true }
    );
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json({ message: 'Student updated successfully', student });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete Student - DELETE
app.delete('/api/students/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update Faculty - PUT
app.put('/api/faculty/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body, 
        lastUpdated: new Date(), 
        updatedBy: req.user.username 
      },
      { new: true, runValidators: true }
    );
    
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    
    res.json({ message: 'Faculty updated successfully', faculty });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete Faculty - DELETE
app.delete('/api/faculty/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const faculty = await Faculty.findByIdAndDelete(req.params.id);
    
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    
    res.json({ message: 'Faculty deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== MISSING API ENDPOINTS ====================

// Get single student by ID
app.get('/api/students/:id', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single faculty by ID
app.get('/api/faculty/:id', authMiddleware, async (req, res) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ message: 'Faculty not found' });
    }
    res.json(faculty);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update user profile
app.put('/api/users/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { ...req.body, lastUpdated: new Date() },
      { new: true }
    ).select('-password');
    
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get system statistics
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [students, faculty, users] = await Promise.all([
      Student.countDocuments(),
      Faculty.countDocuments(),
      User.countDocuments()
    ]);

    const yearWiseStudents = {
      First: await Student.countDocuments({ year: 'First' }),
      Second: await Student.countDocuments({ year: 'Second' }),
      Third: await Student.countDocuments({ year: 'Third' }),
      Fourth: await Student.countDocuments({ year: 'Fourth' })
    };

    res.json({
      totalStudents: students,
      totalFaculty: faculty,
      totalUsers: users,
      yearWiseStudents,
      mlAccuracy: 85.5
    });
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
  res.status(500).json({ message: 'Something went wrong!', error: error.message });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🎯 Backend server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
  console.log(`📊 MongoDB: ${process.env.MONGODB_URI}`);
  console.log('\n🆕 New Endpoints Added:');
  console.log('📤 POST /api/upload-excel - Excel file upload');
  console.log('🤖 GET  /api/ml/status - ML model status');
  console.log('🤖 POST /api/ml/train - Train ML model');
  console.log('🤖 POST /api/ml/predict - Make predictions');
  console.log('📊 GET  /api/stats/overview - System statistics');
  console.log('📊 GET  /api/stats/attendance - Attendance analytics');
});
