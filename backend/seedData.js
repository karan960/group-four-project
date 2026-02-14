
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Student = require('./models/Student');
const Faculty = require('./models/Faculty');

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Student.deleteMany({});
    await Faculty.deleteMany({});
    console.log('🧹 Cleared existing data');

    // Create demo users
    const users = [
      {
        username: 'student123',
        password: await bcrypt.hash('password123', 10),
        role: 'student',
        referenceId: 'PRN2023001'
      },
      {
        username: 'faculty123',
        password: await bcrypt.hash('password123', 10),
        role: 'faculty',
        referenceId: 'FAC2023001'
      },
      {
        username: 'admin123',
        password: await bcrypt.hash('password123', 10),
        role: 'admin',
        referenceId: 'ADMIN001'
      }
    ];

    await User.insertMany(users);
    console.log('✅ Sample users created!');

    // Create sample students
    const students = [
      {
        prn: 'PRN2023001',
        rollNo: 'CS202301',
        studentName: 'Rahul Sharma',
        year: 'Third',
        branch: 'Computer Science',
        division: 'A',
        email: 'rahul.sharma@college.edu',
        mobileNo: '9876543210'
      },
      {
        prn: 'PRN2023002',
        rollNo: 'CS202302',
        studentName: 'Priya Patel',
        year: 'Third',
        branch: 'Computer Science',
        division: 'A',
        email: 'priya.patel@college.edu',
        mobileNo: '9876543211'
      }
    ];

    await Student.insertMany(students);
    console.log('✅ Sample students created!');

    // Create sample faculty
    const faculty = [
      {
        facultyId: 'FAC2023001',
        facultyName: 'Dr. Sunil Kumar',
        email: 'sunil.kumar@college.edu',
        mobileNo: '9876543212',
        department: 'Computer Science',
        designation: 'Professor'
      },
      {
        facultyId: 'FAC2023002',
        facultyName: 'Prof. Meera Desai',
        email: 'meera.desai@college.edu',
        mobileNo: '9876543213',
        department: 'Computer Science',
        designation: 'Assistant Professor'
      }
    ];

    await Faculty.insertMany(faculty);
    console.log('✅ Sample faculty created!');
    
    console.log('\n🎯 DEMO LOGIN CREDENTIALS:');
    console.log('========================');
    console.log('Student:  student123 / password123');
    console.log('Faculty:  faculty123 / password123');
    console.log('Admin:    admin123 / password123');
    console.log('\n📊 Sample Data:');
    console.log('- 2 Students created');
    console.log('- 2 Faculty members created');
    console.log('- 3 User accounts created');
    
    process.exit();
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedData();
