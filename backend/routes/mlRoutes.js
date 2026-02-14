const express = require('express');
const router = express.Router();
const axios = require('axios');
const Student = require('../models/Student');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

// ==================== ML PREDICTION ROUTES ====================

// POST Get prediction for a single student
router.post('/predict/:prn', async (req, res) => {
  try {
    const student = await Student.findOne({ prn: req.params.prn });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Prepare data for ML model
    const mlData = {
      prn: student.prn,
      cgpa: student.cgpa || 0,
      attendance: student.overallAttendance || 0,
      backlogs: student.backlogs || 0,
      currentSemester: student.currentSemester || 1,
      year: student.year,
      branch: student.branch,
      internships: student.internships?.length || 0,
      certifications: student.certifications?.length || 0,
      projects: student.projects?.length || 0,
      skills: student.skills?.length || 0,
      semesterMarks: student.semesterMarks || []
    };

    try {
      // Call ML API
      const mlResponse = await axios.post(`${ML_API_URL}/predict`, mlData, {
        timeout: 10000
      });

      const prediction = mlResponse.data;

      // Update student with prediction results
      student.predictedCGPA = prediction.predictedCGPA;
      student.placementProbability = prediction.placementProbability;
      student.riskCategory = prediction.riskCategory;
      student.recommendations = prediction.recommendations;
      student.lastPredictionDate = new Date();

      await student.save();

      res.json({
        message: 'Prediction generated successfully',
        prediction: {
          predictedCGPA: prediction.predictedCGPA,
          placementProbability: prediction.placementProbability,
          riskCategory: prediction.riskCategory,
          recommendations: prediction.recommendations,
          confidence: prediction.confidence
        }
      });
    } catch (mlError) {
      console.error('ML API Error:', mlError.message);
      
      // Fallback: Generate basic prediction without ML service
      const basicPrediction = generateBasicPrediction(student);
      
      student.predictedCGPA = basicPrediction.predictedCGPA;
      student.placementProbability = basicPrediction.placementProbability;
      student.riskCategory = basicPrediction.riskCategory;
      student.recommendations = basicPrediction.recommendations;
      student.lastPredictionDate = new Date();

      await student.save();

      res.json({
        message: 'Prediction generated (ML service unavailable - using fallback)',
        prediction: basicPrediction,
        note: 'ML service is currently unavailable. Basic prediction algorithm used.'
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST Batch predictions for multiple students
router.post('/predict/batch', async (req, res) => {
  try {
    const { year, branch, division } = req.body;
    const query = { isActive: true };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (division) query.division = division;

    const students = await Student.find(query);

    const results = {
      total: students.length,
      processed: 0,
      failed: 0,
      predictions: []
    };

    for (const student of students) {
      try {
        const mlData = {
          prn: student.prn,
          cgpa: student.cgpa || 0,
          attendance: student.overallAttendance || 0,
          backlogs: student.backlogs || 0,
          currentSemester: student.currentSemester || 1,
          internships: student.internships?.length || 0,
          certifications: student.certifications?.length || 0,
          projects: student.projects?.length || 0
        };

        let prediction;
        try {
          const mlResponse = await axios.post(`${ML_API_URL}/predict`, mlData, {
            timeout: 5000
          });
          prediction = mlResponse.data;
        } catch {
          prediction = generateBasicPrediction(student);
        }

        student.predictedCGPA = prediction.predictedCGPA;
        student.placementProbability = prediction.placementProbability;
        student.riskCategory = prediction.riskCategory;
        student.recommendations = prediction.recommendations;
        student.lastPredictionDate = new Date();

        await student.save();

        results.processed++;
        results.predictions.push({
          prn: student.prn,
          name: student.studentName,
          prediction
        });
      } catch (error) {
        results.failed++;
        console.error(`Prediction failed for ${student.prn}:`, error.message);
      }
    }

    res.json({
      message: 'Batch predictions completed',
      results
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET Students at risk (low CGPA, high backlogs, low attendance)
router.get('/at-risk', async (req, res) => {
  try {
    const { year, branch, division } = req.query;
    const query = { 
      isActive: true,
      $or: [
        { cgpa: { $lt: 6.5 } },
        { backlogs: { $gt: 0 } },
        { overallAttendance: { $lt: 75 } },
        { riskCategory: 'High' }
      ]
    };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (division) query.division = division;

    const atRiskStudents = await Student.find(query).select(
      'prn studentName year branch division cgpa backlogs overallAttendance riskCategory predictedCGPA placementProbability'
    );

    res.json({
      total: atRiskStudents.length,
      students: atRiskStudents
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== HELPER FUNCTIONS ====================

function generateBasicPrediction(student) {
  const cgpa = student.cgpa || 0;
  const attendance = student.overallAttendance || 0;
  const backlogs = student.backlogs || 0;
  const internships = student.internships?.length || 0;
  const projects = student.projects?.length || 0;

  // Simple prediction logic
  let predictedCGPA = cgpa;
  let placementProbability = 0;
  let riskCategory = 'Low';
  const recommendations = [];

  // Predict CGPA trend
  if (attendance >= 80 && backlogs === 0) {
    predictedCGPA = Math.min(10, cgpa + 0.3);
  } else if (attendance < 75 || backlogs > 0) {
    predictedCGPA = Math.max(0, cgpa - 0.2);
  }

  // Calculate placement probability
  if (cgpa >= 7 && attendance >= 75 && backlogs === 0) {
    placementProbability = 75 + (internships * 5) + (projects * 3);
  } else if (cgpa >= 6 && attendance >= 70) {
    placementProbability = 50 + (internships * 4) + (projects * 2);
  } else {
    placementProbability = 25 + (internships * 3) + (projects * 2);
  }

  placementProbability = Math.min(100, placementProbability);

  // Determine risk category
  if (cgpa < 6 || attendance < 70 || backlogs > 2) {
    riskCategory = 'High';
  } else if (cgpa < 7 || attendance < 80 || backlogs > 0) {
    riskCategory = 'Medium';
  }

  // Generate recommendations
  if (attendance < 75) {
    recommendations.push('Improve attendance to at least 75%');
  }
  if (cgpa < 7) {
    recommendations.push('Focus on improving CGPA through regular study');
  }
  if (backlogs > 0) {
    recommendations.push(`Clear ${backlogs} backlog(s) immediately`);
  }
  if (internships === 0) {
    recommendations.push('Complete at least one internship');
  }
  if (projects < 2) {
    recommendations.push('Work on academic/personal projects');
  }
  if (student.skills?.length < 5) {
    recommendations.push('Learn more relevant technical skills');
  }

  return {
    predictedCGPA: parseFloat(predictedCGPA.toFixed(2)),
    placementProbability: parseFloat(placementProbability.toFixed(2)),
    riskCategory,
    recommendations,
    confidence: 0.7
  };
}

module.exports = router;
