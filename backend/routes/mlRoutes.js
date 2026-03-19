const express = require('express');
const router = express.Router();
const axios = require('axios');
const Student = require('../models/Student');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5001';

// ==================== VALIDATION & LOGGING HELPERS ====================

const logError = (context, error, additionalInfo = {}) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    errorCode: error.code,
    ...additionalInfo
  });
};

function validateMLResponse(response) {
  if (!response || typeof response !== 'object') {
    return {
      success: false,
      isValid: false,
      message: 'Response is not an object'
    };
  }
  
  const required = ['predictedCGPA', 'placementProbability', 'riskCategory', 'recommendations'];
  const missing = required.filter(field => !(field in response));
  
  if (missing.length > 0) {
    return {
      success: false,
      isValid: false,
      message: `Missing required fields: ${missing.join(', ')}`
    };
  }
  
  return { success: true, isValid: true };
}

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

      const predictionPayload = mlResponse.data?.prediction || mlResponse.data;
      
      // Validate ML response structure (Issue #1 & #2)
      const validation = validateMLResponse(predictionPayload);
      if (!validation.isValid) {
        console.error('ML Response validation failed:', validation.message);
        throw new Error('Invalid ML API response structure');
      }

      // Safe mapping with default values
      const validatedPrediction = {
        predictedCGPA: parseFloat(predictionPayload.predictedCGPA) || 0,
        placementProbability: parseFloat(predictionPayload.placementProbability) || 0,
        riskCategory: predictionPayload.riskCategory || 'Low',
        recommendations: Array.isArray(predictionPayload.recommendations) ? predictionPayload.recommendations : [],
        confidence: parseFloat(predictionPayload.confidence) || 0.7
      };

      // Update student with prediction results
      student.predictedCGPA = validatedPrediction.predictedCGPA;
      student.placementProbability = validatedPrediction.placementProbability;
      student.riskCategory = validatedPrediction.riskCategory;
      student.recommendations = validatedPrediction.recommendations;
      student.lastPredictionDate = new Date();

      await student.save();

      res.json({
        message: 'Prediction generated successfully',
        prediction: validatedPrediction
      });
    } catch (mlError) {
      logError('/api/ml/predict/:prn', mlError, {
        prn: student.prn,
        apiUrl: ML_API_URL,
        timeout: 10000
      });
      
      // Fallback: Generate basic prediction without ML service
      const basicPrediction = generateBasicPrediction(student);
      
      student.predictedCGPA = basicPrediction.predictedCGPA;
      student.placementProbability = basicPrediction.placementProbability;
      student.riskCategory = basicPrediction.riskCategory;
      student.recommendations = basicPrediction.recommendations;
      student.lastPredictionDate = new Date();

      await student.save();

      res.json({
        message: 'Prediction generated successfully',
        prediction: basicPrediction,
        fallback: true,
        note: 'Basic prediction algorithm used'
      });
    }
  } catch (error) {
    logError('/api/ml/predict/:prn', error, { prn: req.params.prn });
    res.status(500).json({ 
      message: 'Prediction service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
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
          prediction = mlResponse.data?.prediction || mlResponse.data;
          
          // Validate batch prediction response (Issue #2)
          const validation = validateMLResponse(prediction);
          if (!validation.isValid) {
            console.warn(`Batch prediction validation failed for ${student.prn}: ${validation.message}`);
            prediction = generateBasicPrediction(student);
          }
        } catch (error) {
          logError(`/api/ml/predict/batch - ${student.prn}`, error, {
            prn: student.prn,
            apiUrl: ML_API_URL
          });
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
        logError(`/api/ml/predict/batch - ${student.prn}`, error, {
          prn: student.prn
        });
      }
    }

    res.json({
      message: 'Batch predictions completed',
      results
    });
  } catch (error) {
    logError('/api/ml/predict/batch', error, { year: req.body.year, branch: req.body.branch });
    res.status(500).json({ 
      message: 'Batch prediction service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
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
    logError('/api/ml/at-risk', error, { year: req.query.year, branch: req.query.branch });
    res.status(500).json({ 
      message: 'At-risk query service temporarily unavailable',
      timestamp: new Date().toISOString()
    });
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
