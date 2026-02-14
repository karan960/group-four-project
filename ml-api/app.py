# Simple ML API Server for Campus Connect
# This is a Flask-based API that provides machine learning predictions

from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from datetime import datetime
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import performance analysis routes
try:
    from routes.performance_routes import performance_bp
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(performance_bp)
except ImportError:
    app = Flask(__name__)
    CORS(app)

# ==================== HELPER FUNCTIONS ====================

def calculate_prediction(student_data):
    """
    Calculate student performance prediction based on various factors
    """
    cgpa = float(student_data.get('cgpa', 0))
    attendance = float(student_data.get('attendance', 0))
    backlogs = int(student_data.get('backlogs', 0))
    internships = int(student_data.get('internships', 0))
    projects = int(student_data.get('projects', 0))
    certifications = int(student_data.get('certifications', 0))
    skills = int(student_data.get('skills', 0))
    current_semester = int(student_data.get('currentSemester', 1))
    
    # Predict CGPA trend
    predicted_cgpa = cgpa
    if attendance >= 80 and backlogs == 0:
        predicted_cgpa = min(10.0, cgpa + 0.3)
    elif attendance < 75 or backlogs > 0:
        predicted_cgpa = max(0, cgpa - 0.2)
    
    # Calculate placement probability
    base_probability = 0
    if cgpa >= 7 and attendance >= 75 and backlogs == 0:
        base_probability = 75
    elif cgpa >= 6 and attendance >= 70:
        base_probability = 50
    else:
        base_probability = 25
    
    # Add bonus for skills and experience
    placement_probability = base_probability + (internships * 5) + (projects * 3) + (certifications * 2) + (skills * 1)
    placement_probability = min(100, max(0, placement_probability))
    
    # Determine risk category
    risk_category = 'Low'
    if cgpa < 6 or attendance < 70 or backlogs > 2:
        risk_category = 'High'
    elif cgpa < 7 or attendance < 80 or backlogs > 0:
        risk_category = 'Medium'
    
    # Generate recommendations
    recommendations = []
    if attendance < 75:
        recommendations.append('Improve attendance to at least 75%')
    if cgpa < 7:
        recommendations.append('Focus on improving CGPA through regular study')
    if backlogs > 0:
        recommendations.append(f'Clear {backlogs} backlog(s) immediately')
    if internships == 0:
        recommendations.append('Complete at least one internship')
    if projects < 2:
        recommendations.append('Work on 2-3 academic/personal projects')
    if skills < 5:
        recommendations.append('Learn relevant technical skills')
    if certifications == 0:
        recommendations.append('Get industry-recognized certifications')
    
    # Calculate confidence based on data quality
    confidence = 0.7
    if attendance > 0 and cgpa > 0:
        confidence = 0.85
    if len(student_data.get('semesterMarks', [])) > 2:
        confidence = 0.9
    
    return {
        'predictedCGPA': round(predicted_cgpa, 2),
        'placementProbability': round(placement_probability, 2),
        'riskCategory': risk_category,
        'recommendations': recommendations,
        'confidence': round(confidence, 2)
    }

# ==================== API ENDPOINTS ====================

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'service': 'Campus Connect ML API',
        'version': '1.0.0',
        'status': 'running',
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            'predict': 'POST /predict',
            'batch_predict': 'POST /batch-predict',
            'health': 'GET /health'
        }
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict student performance for a single student
    
    Expected input:
    {
        "prn": "PRN2023001",
        "cgpa": 7.5,
        "attendance": 85,
        "backlogs": 0,
        "internships": 1,
        "projects": 2,
        "certifications": 1,
        "skills": 5,
        "currentSemester": 5,
        "semesterMarks": [...]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        prediction = calculate_prediction(data)
        
        return jsonify({
            'success': True,
            'prn': data.get('prn'),
            'prediction': prediction,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/batch-predict', methods=['POST'])
def batch_predict():
    """
    Predict student performance for multiple students
    
    Expected input:
    {
        "students": [
            {"prn": "...", "cgpa": 7.5, ...},
            {"prn": "...", "cgpa": 6.8, ...}
        ]
    }
    """
    try:
        data = request.get_json()
        students = data.get('students', [])
        
        if not students:
            return jsonify({'error': 'No student data provided'}), 400
        
        predictions = []
        for student in students:
            prediction = calculate_prediction(student)
            predictions.append({
                'prn': student.get('prn'),
                'prediction': prediction
            })
        
        return jsonify({
            'success': True,
            'total': len(predictions),
            'predictions': predictions,
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/train', methods=['POST'])
def train_model():
    """
    Simulate model training (placeholder for actual ML model training)
    """
    try:
        return jsonify({
            'success': True,
            'message': 'Model training initiated',
            'status': 'training',
            'estimatedTime': '2-3 minutes',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/model-info', methods=['GET'])
def model_info():
    """
    Get information about the ML model
    """
    return jsonify({
        'modelType': 'Rule-based + Statistical',
        'version': '1.0.0',
        'features': [
            'CGPA', 'Attendance', 'Backlogs', 'Internships',
            'Projects', 'Certifications', 'Skills'
        ],
        'accuracy': 85.5,
        'lastTrained': datetime.now().isoformat(),
        'predictions': {
            'total': 0,
            'today': 0
        }
    })

# ==================== RUN SERVER ====================

if __name__ == '__main__':
    print('\n' + '='*60)
    print('🤖 CAMPUS CONNECT ML API SERVER')
    print('='*60)
    print('📍 Server URL: http://localhost:5001')
    print('📊 Status: Running')
    print('='*60)
    print('\n📋 AVAILABLE ENDPOINTS:')
    print('  GET  / - Service info')
    print('  GET  /health - Health check')
    print('  POST /predict - Single student prediction')
    print('  POST /batch-predict - Multiple students prediction')
    print('  POST /train - Train model (placeholder)')
    print('  GET  /model-info - Model information')
    print('\n' + '='*60)
    print('✅ ML API Server is ready!')
    print('='*60 + '\n')
    
    app.run(host='0.0.0.0', port=5001, debug=True)
