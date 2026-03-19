const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Faculty = require('../models/Faculty');

const jwtSecret = (process.env.JWT_SECRET || '').trim();

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
      plainPassword: password, // Store original password for admin display
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
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST Change Password
router.post('/change-password', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST Reset Password (Admin only)
router.post('/reset-password', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Theme preference
router.get('/theme', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.userId).select('theme');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ theme: user.theme || 'light' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT Update theme preference
router.put('/theme', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, jwtSecret);
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
