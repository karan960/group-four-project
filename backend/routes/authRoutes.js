const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const jwtSecret = (process.env.JWT_SECRET || '').trim();

const getDecodedAuth = (req) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    const err = new Error('No token provided');
    err.status = 401;
    throw err;
  }

  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    const err = new Error('Invalid token');
    err.status = 401;
    throw err;
  }
};

const profilePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'profile-photos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const profilePhotoUpload = multer({
  storage: profilePhotoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

// ==================== AUTHENTICATION ====================

// POST Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, referenceId } = req.body;
    
    // Validate inputs
    if (!username || !password || !role) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Verify reference ID exists in respective collection
    if (role === 'student') {
      const student = await Student.findOne({ prn: referenceId });
      if (!student) {
        return res.status(400).json({ message: 'Invalid student PRN' });
      }
    } else if (role === 'faculty') {
      const faculty = await Faculty.findOne({ facultyId: referenceId });
      if (!faculty) {
        return res.status(400).json({ message: 'Invalid faculty ID' });
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
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

// POST Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate inputs
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username, isActive: true });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get profile data based on role
    let profileData = {};
    
    if (user.role === 'student') {
      const student = await Student.findOne({ prn: user.referenceId });
      if (student) {
        profileData = {
          prn: student.prn,
          name: student.studentName,
          email: student.email,
          year: student.year,
          branch: student.branch,
          division: student.division,
          cgpa: student.cgpa,
          attendance: student.overallAttendance
        };
      }
    } else if (user.role === 'faculty') {
      const faculty = await Faculty.findOne({ facultyId: user.referenceId });
      if (faculty) {
        profileData = {
          facultyId: faculty.facultyId,
          name: faculty.facultyName,
          email: faculty.email,
          department: faculty.department,
          designation: faculty.designation
        };
      }
    } else if (user.role === 'admin') {
      profileData = {
        username: user.username,
        role: 'admin'
      };
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role, 
        username: user.username,
        referenceId: user.referenceId
      },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        referenceId: user.referenceId,
        profilePhoto: user.profilePhoto || '',
        ...profileData
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Profile (requires authentication)
router.get('/profile', async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found or inactive' });
    }

    // Get detailed profile based on role
    let profile = { user };

    if (user.role === 'student') {
      const student = await Student.findOne({ prn: user.referenceId });
      profile.studentData = student;
    } else if (user.role === 'faculty') {
      const faculty = await Faculty.findOne({ facultyId: user.referenceId });
      profile.facultyData = faculty;
    }

    res.json(profile);
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/profile-photo', profilePhotoUpload.single('profilePhoto'), async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);

    if (!req.file) {
      return res.status(400).json({ message: 'Profile photo is required' });
    }
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(404).json({ message: 'User not found or inactive' });
    }

    const oldPhotoPath = user.profilePhoto && user.profilePhoto.startsWith('/uploads/profile-photos/')
      ? path.join(__dirname, '..', user.profilePhoto.replace(/^\//, ''))
      : '';

    user.profilePhoto = `/uploads/profile-photos/${req.file.filename}`;
    await user.save();

    if (oldPhotoPath && fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }

    res.json({
      message: 'Profile photo updated successfully',
      profilePhoto: user.profilePhoto
    });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image size must be up to 2MB' });
      }
      return res.status(400).json({ message: error.message });
    }

    if (error.message && error.message.includes('Only JPG, PNG, and WEBP images are allowed')) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST Change Password
router.post('/change-password', async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash and update new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST Reset Password (Admin only)
router.post('/reset-password', async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);
    
    // Only admin can reset passwords
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      return res.status(400).json({ message: 'Username and new password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Hash and update password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Theme preference
router.get('/theme', async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);
    const user = await User.findById(decoded.userId).select('theme');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ theme: user.theme || 'light' });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT Update theme preference
router.put('/theme', async (req, res) => {
  try {
    const decoded = getDecodedAuth(req);
    const { theme } = req.body;

    if (!['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme value' });
    }

    const user = await User.findByIdAndUpdate(
      decoded.userId, 
      { theme }, 
      { new: true }
    ).select('theme');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ theme: user.theme });
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
