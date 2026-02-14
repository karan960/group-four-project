"""
Student Performance Analysis API Routes
Handles endpoints for individual, subject-wise, and faculty-wide performance analysis
"""

from flask import Blueprint, request, jsonify
import json
from datetime import datetime

from models.performance_model import StudentPerformanceModel

# Initialize Blueprint
performance_bp = Blueprint('performance', __name__, url_prefix='/api/ml/performance')
model = StudentPerformanceModel()

# ==================== INDIVIDUAL STUDENT PERFORMANCE ====================

@performance_bp.route('/individual/<student_id>', methods=['POST'])
def get_individual_performance(student_id):
    """
    Analyze individual student performance
    
    Request body:
    {
        "cgpa": float,
        "overallAttendance": float,
        "semesterMarks": [...],
        "attendance": [...],
        "backlogs": int,
        "studentName": string,
        ...
    }
    
    Returns:
        Individual student performance metrics
    """
    try:
        student_data = request.get_json()
        
        if not student_data:
            return jsonify({'error': 'No student data provided'}), 400
        
        performance = model.calculate_individual_performance(student_data)
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'timestamp': datetime.now().isoformat(),
            'performance': performance
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== SUBJECT-WISE PERFORMANCE ====================

@performance_bp.route('/subject-wise/<student_id>', methods=['POST'])
def get_subject_wise_performance(student_id):
    """
    Analyze subject-wise performance for a student
    
    Request body:
    {
        "semesterMarks": [...],
        "attendance": [...],
        ...
    }
    
    Returns:
        Subject-wise performance breakdown for each semester
    """
    try:
        student_data = request.get_json()
        
        if not student_data:
            return jsonify({'error': 'No student data provided'}), 400
        
        subject_analysis = model.calculate_subject_wise_performance(student_data)
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'timestamp': datetime.now().isoformat(),
            'subject_wise_analysis': subject_analysis
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== FACULTY STATISTICS ====================

@performance_bp.route('/faculty-statistics', methods=['POST'])
def get_faculty_statistics():
    """
    Calculate overall statistics for faculty dashboard
    
    Request body:
    {
        "students": [
            {
                "cgpa": float,
                "overallAttendance": float,
                "semesterMarks": [...],
                "attendance": [...],
                "backlogs": int,
                "studentName": string,
                ...
            },
            ...
        ]
    }
    
    Returns:
        Comprehensive statistics for faculty dashboard
    """
    try:
        data = request.get_json()
        
        if not data or 'students' not in data:
            return jsonify({'error': 'No students data provided'}), 400
        
        students_data = data['students']
        
        if not students_data:
            return jsonify({'error': 'Students list is empty'}), 400
        
        statistics = model.calculate_faculty_statistics(students_data)
        
        return jsonify({
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'statistics': statistics
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== CLASS/SECTION WISE ANALYSIS ====================

@performance_bp.route('/class-analysis', methods=['POST'])
def get_class_analysis():
    """
    Analyze performance for entire class/section
    
    Request body:
    {
        "class_name": string,
        "students": [...]
    }
    
    Returns:
        Class-level performance analysis
    """
    try:
        data = request.get_json()
        
        if not data or 'students' not in data:
            return jsonify({'error': 'No students data provided'}), 400
        
        students_data = data['students']
        class_name = data.get('class_name', 'Unknown')
        
        # Get overall statistics
        statistics = model.calculate_faculty_statistics(students_data)
        
        # Add individual performance for each student
        students_performance = []
        for student in students_data:
            perf = model.calculate_individual_performance(student)
            students_performance.append({
                'name': student.get('studentName'),
                'roll_no': student.get('rollNo'),
                'cgpa': student.get('cgpa'),
                'performance': perf
            })
        
        return jsonify({
            'success': True,
            'class_name': class_name,
            'timestamp': datetime.now().isoformat(),
            'overall_statistics': statistics,
            'students_performance': students_performance
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AT-RISK STUDENTS ANALYSIS ====================

@performance_bp.route('/at-risk-students', methods=['POST'])
def get_at_risk_students():
    """
    Identify students at risk and provide intervention strategies
    
    Request body:
    {
        "students": [...]
    }
    
    Returns:
        List of at-risk students with recommendations
    """
    try:
        data = request.get_json()
        
        if not data or 'students' not in data:
            return jsonify({'error': 'No students data provided'}), 400
        
        students_data = data['students']
        
        at_risk_students = []
        critical_students = []
        
        for student in students_data:
            performance = model.calculate_individual_performance(student)
            
            if performance['risk_level'] in ['High Risk', 'Critical Risk']:
                student_info = {
                    'name': student.get('studentName'),
                    'roll_no': student.get('rollNo'),
                    'prn': student.get('prn'),
                    'cgpa': student.get('cgpa'),
                    'attendance': student.get('overallAttendance'),
                    'backlogs': student.get('backlogs'),
                    'risk_level': performance['risk_level'],
                    'performance_score': performance['overall_performance_score'],
                    'recommendations': performance['recommendations']
                }
                
                if performance['risk_level'] == 'Critical Risk':
                    critical_students.append(student_info)
                else:
                    at_risk_students.append(student_info)
        
        return jsonify({
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'total_at_risk': len(at_risk_students) + len(critical_students),
            'critical_risk_students': critical_students,
            'high_risk_students': at_risk_students
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== SUBJECT PERFORMANCE ANALYSIS ====================

@performance_bp.route('/subject-analysis', methods=['POST'])
def get_subject_analysis():
    """
    Analyze performance for a specific subject across all students
    
    Request body:
    {
        "subject_name": string,
        "students": [...]
    }
    
    Returns:
        Subject-wise performance analysis
    """
    try:
        data = request.get_json()
        
        if not data or 'students' not in data:
            return jsonify({'error': 'No students data provided'}), 400
        
        students_data = data['students']
        subject_name = data.get('subject_name', 'All Subjects')
        
        subject_performances = []
        total_marks = []
        grade_distribution = {}
        
        for student in students_data:
            semester_marks = student.get('semesterMarks', [])
            
            for semester in semester_marks:
                for subject in semester.get('subjects', []):
                    if subject_name == 'All Subjects' or subject.get('subjectName') == subject_name:
                        marks = subject.get('totalMarks', 0)
                        grade = subject.get('grade', 'N/A')
                        
                        total_marks.append(marks)
                        grade_distribution[grade] = grade_distribution.get(grade, 0) + 1
                        
                        subject_performances.append({
                            'student_name': student.get('studentName'),
                            'marks': marks,
                            'grade': grade,
                            'subject': subject.get('subjectName')
                        })
        
        avg_marks = sum(total_marks) / len(total_marks) if total_marks else 0
        max_marks = max(total_marks) if total_marks else 0
        min_marks = min(total_marks) if total_marks else 0
        
        return jsonify({
            'success': True,
            'subject_name': subject_name,
            'timestamp': datetime.now().isoformat(),
            'statistics': {
                'total_students': len(subject_performances),
                'average_marks': round(avg_marks, 2),
                'highest_marks': max_marks,
                'lowest_marks': min_marks,
                'grade_distribution': grade_distribution
            },
            'student_performances': subject_performances
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== COMPARATIVE ANALYSIS ====================

@performance_bp.route('/compare-students', methods=['POST'])
def compare_students():
    """
    Compare performance of multiple students
    
    Request body:
    {
        "student_ids": [list of student data objects]
    }
    
    Returns:
        Comparative analysis of selected students
    """
    try:
        data = request.get_json()
        
        if not data or 'students' not in data:
            return jsonify({'error': 'No students data provided'}), 400
        
        students_data = data['students']
        
        comparison = []
        
        for student in students_data:
            performance = model.calculate_individual_performance(student)
            comparison.append({
                'name': student.get('studentName'),
                'roll_no': student.get('rollNo'),
                'cgpa': student.get('cgpa'),
                'attendance': student.get('overallAttendance'),
                'performance_score': performance['overall_performance_score'],
                'performance_category': performance['performance_category'],
                'risk_level': performance['risk_level']
            })
        
        # Sort by performance score
        comparison = sorted(comparison, key=lambda x: x['performance_score'], reverse=True)
        
        return jsonify({
            'success': True,
            'timestamp': datetime.now().isoformat(),
            'comparison_count': len(comparison),
            'students_comparison': comparison
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== IMPROVEMENT TRACKING ====================

@performance_bp.route('/improvement-analysis/<student_id>', methods=['POST'])
def get_improvement_analysis(student_id):
    """
    Analyze semester-to-semester improvement
    
    Request body:
    {
        "semesterMarks": [...]
    }
    
    Returns:
        Improvement trends and analysis
    """
    try:
        student_data = request.get_json()
        
        if not student_data or 'semesterMarks' not in student_data:
            return jsonify({'error': 'No semester marks data provided'}), 400
        
        semester_marks = student_data['semesterMarks']
        
        if len(semester_marks) < 2:
            return jsonify({'error': 'Need at least 2 semesters for improvement analysis'}), 400
        
        improvement_data = []
        
        for i, semester in enumerate(semester_marks):
            sgpa = semester.get('sgpa', 0)
            year = semester.get('year')
            sem = semester.get('semester')
            
            improvement_item = {
                'semester_number': i + 1,
                'year': year,
                'semester': sem,
                'sgpa': sgpa
            }
            
            if i > 0:
                prev_sgpa = semester_marks[i-1].get('sgpa', 0)
                change = sgpa - prev_sgpa
                improvement_item['change_from_previous'] = round(change, 2)
                improvement_item['change_percentage'] = round((change / prev_sgpa * 100) if prev_sgpa > 0 else 0, 2)
            
            improvement_data.append(improvement_item)
        
        # Calculate overall trend
        first_sgpa = semester_marks[0].get('sgpa', 0)
        last_sgpa = semester_marks[-1].get('sgpa', 0)
        overall_trend = last_sgpa - first_sgpa
        trend_direction = 'Improving' if overall_trend > 0 else 'Declining' if overall_trend < 0 else 'Stable'
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'timestamp': datetime.now().isoformat(),
            'semester_progression': improvement_data,
            'overall_trend': {
                'direction': trend_direction,
                'total_change': round(overall_trend, 2),
                'first_sgpa': round(first_sgpa, 2),
                'last_sgpa': round(last_sgpa, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
