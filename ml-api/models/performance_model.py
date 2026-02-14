"""
Student Performance Analysis Model
Analyzes marks, attendance, and calculates individual and subject-wise performance metrics
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import warnings
warnings.filterwarnings('ignore')

class StudentPerformanceModel:
    """
    ML Model for analyzing student performance based on marks and attendance
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.pca = PCA(n_components=0.95)
        self.weights = {
            'cgpa': 0.35,
            'attendance': 0.25,
            'subject_performance': 0.25,
            'improvement_trend': 0.10,
            'consistency': 0.05
        }
        
    def calculate_individual_performance(self, student_data):
        """
        Calculate comprehensive performance metrics for an individual student
        
        Args:
            student_data: Dictionary containing student information
            
        Returns:
            Dictionary with performance metrics
        """
        
        cgpa = float(student_data.get('cgpa', 0))
        overall_attendance = float(student_data.get('overallAttendance', 0))
        semester_marks = student_data.get('semesterMarks', [])
        attendance_records = student_data.get('attendance', [])
        backlogs = int(student_data.get('backlogs', 0))
        
        # 1. CGPA Score (0-100)
        cgpa_score = (cgpa / 10) * 100
        
        # 2. Attendance Score (0-100)
        attendance_score = overall_attendance
        
        # 3. Subject Performance Analysis
        subject_performance_score = self._calculate_subject_performance(semester_marks)
        
        # 4. Improvement Trend Analysis
        improvement_trend = self._calculate_improvement_trend(semester_marks)
        
        # 5. Consistency Score
        consistency_score = self._calculate_consistency(semester_marks, attendance_records)
        
        # 6. Overall Performance Score (Weighted)
        overall_performance = (
            self.weights['cgpa'] * cgpa_score +
            self.weights['attendance'] * attendance_score +
            self.weights['subject_performance'] * subject_performance_score +
            self.weights['improvement_trend'] * improvement_trend +
            self.weights['consistency'] * consistency_score
        )
        
        # 7. Performance Category
        performance_category = self._categorize_performance(overall_performance)
        
        # 8. Risk Assessment
        risk_level = self._assess_risk(cgpa, overall_attendance, backlogs, semester_marks)
        
        # 9. Recommendations
        recommendations = self._generate_recommendations(
            cgpa, overall_attendance, semester_marks, backlogs, risk_level
        )
        
        return {
            'overall_performance_score': round(overall_performance, 2),
            'performance_category': performance_category,
            'cgpa_score': round(cgpa_score, 2),
            'attendance_score': round(attendance_score, 2),
            'subject_performance_score': round(subject_performance_score, 2),
            'improvement_trend': round(improvement_trend, 2),
            'consistency_score': round(consistency_score, 2),
            'risk_level': risk_level,
            'backlogs': backlogs,
            'recommendations': recommendations,
            'placement_probability': self._calculate_placement_probability(
                cgpa, overall_attendance, backlogs
            )
        }
    
    def calculate_subject_wise_performance(self, student_data):
        """
        Calculate performance metrics for each subject
        
        Args:
            student_data: Dictionary containing student information
            
        Returns:
            Dictionary with subject-wise performance
        """
        
        semester_marks = student_data.get('semesterMarks', [])
        attendance_records = student_data.get('attendance', [])
        
        subject_analysis = {}
        
        for semester in semester_marks:
            subjects = semester.get('subjects', [])
            semester_key = f"Year {semester.get('year')} - Semester {semester.get('semester')}"
            
            subject_analysis[semester_key] = []
            
            # Get attendance for matching month/year if available
            semester_attendance = {}
            for attendance_record in attendance_records:
                for subject in attendance_record.get('subjects', []):
                    semester_attendance[subject['subjectName']] = subject.get('percentage', 0)
            
            for subject in subjects:
                subject_name = subject.get('subjectName', 'N/A')
                internal_marks = subject.get('internalMarks', 0)
                external_marks = subject.get('externalMarks', 0)
                total_marks = subject.get('totalMarks', 0)
                credits = subject.get('credits', 0)
                grade = subject.get('grade', 'N/A')
                
                # Calculate subject score percentage
                subject_score = (total_marks / 100 * 100) if total_marks > 0 else 0
                
                # Get subject attendance
                subject_attendance = semester_attendance.get(subject_name, 0)
                
                # Performance rating for subject
                subject_performance_rating = self._rate_subject_performance(
                    subject_score, grade, subject_attendance
                )
                
                subject_analysis[semester_key].append({
                    'subject_name': subject_name,
                    'subject_code': subject.get('subjectCode', 'N/A'),
                    'internal_marks': internal_marks,
                    'external_marks': external_marks,
                    'total_marks': total_marks,
                    'credits': credits,
                    'grade': grade,
                    'subject_score': round(subject_score, 2),
                    'subject_attendance': round(subject_attendance, 2),
                    'performance_rating': subject_performance_rating
                })
        
        return subject_analysis
    
    def calculate_faculty_statistics(self, students_data):
        """
        Calculate overall statistics for faculty dashboard
        
        Args:
            students_data: List of student dictionaries
            
        Returns:
            Dictionary with overall statistics
        """
        
        if not students_data:
            return {}
        
        df_students = pd.DataFrame([self.calculate_individual_performance(s) for s in students_data])
        
        # Basic Statistics
        total_students = len(students_data)
        
        # Performance Distribution
        performance_dist = {
            'excellent': len(df_students[df_students['overall_performance_score'] >= 85]),
            'very_good': len(df_students[(df_students['overall_performance_score'] >= 75) & 
                                         (df_students['overall_performance_score'] < 85)]),
            'good': len(df_students[(df_students['overall_performance_score'] >= 65) & 
                                    (df_students['overall_performance_score'] < 75)]),
            'average': len(df_students[(df_students['overall_performance_score'] >= 50) & 
                                       (df_students['overall_performance_score'] < 65)]),
            'below_average': len(df_students[df_students['overall_performance_score'] < 50])
        }
        
        # Risk Distribution
        risk_dist = {
            'low_risk': len(df_students[df_students['risk_level'] == 'Low Risk']),
            'medium_risk': len(df_students[df_students['risk_level'] == 'Medium Risk']),
            'high_risk': len(df_students[df_students['risk_level'] == 'High Risk']),
            'critical_risk': len(df_students[df_students['risk_level'] == 'Critical Risk'])
        }
        
        # Average Metrics
        avg_cgpa = np.mean([s.get('cgpa', 0) for s in students_data])
        avg_attendance = np.mean([s.get('overallAttendance', 0) for s in students_data])
        avg_performance_score = df_students['overall_performance_score'].mean()
        
        # Placement Probability
        avg_placement_prob = df_students['placement_probability'].mean()
        
        # Subject-wise Analysis
        subject_performance_stats = self._calculate_subject_stats_for_faculty(students_data)
        
        # Top and Bottom Performers
        df_sorted = df_students.sort_values('overall_performance_score', ascending=False)
        
        top_performers = []
        bottom_performers = []
        
        for idx in range(min(5, len(students_data))):
            student_idx = df_sorted.index[idx]
            top_performers.append({
                'name': students_data[student_idx].get('studentName'),
                'performance_score': round(df_sorted.iloc[idx]['overall_performance_score'], 2),
                'cgpa': round(students_data[student_idx].get('cgpa', 0), 2)
            })
        
        for idx in range(min(5, len(students_data))):
            student_idx = df_sorted.index[-(idx+1)]
            bottom_performers.append({
                'name': students_data[student_idx].get('studentName'),
                'performance_score': round(df_sorted.iloc[-(idx+1)]['overall_performance_score'], 2),
                'cgpa': round(students_data[student_idx].get('cgpa', 0), 2)
            })
        
        return {
            'total_students': total_students,
            'average_cgpa': round(avg_cgpa, 2),
            'average_attendance': round(avg_attendance, 2),
            'average_performance_score': round(avg_performance_score, 2),
            'average_placement_probability': round(avg_placement_prob, 2),
            'performance_distribution': performance_dist,
            'risk_distribution': risk_dist,
            'subject_performance_stats': subject_performance_stats,
            'top_performers': top_performers,
            'bottom_performers': bottom_performers,
            'total_backlogs': sum([s.get('backlogs', 0) for s in students_data]),
            'students_at_risk': risk_dist['high_risk'] + risk_dist['critical_risk']
        }
    
    # ==================== HELPER METHODS ====================
    
    def _calculate_subject_performance(self, semester_marks):
        """Calculate average subject performance across all semesters"""
        if not semester_marks:
            return 0
        
        total_marks = []
        for semester in semester_marks:
            subjects = semester.get('subjects', [])
            for subject in subjects:
                if subject.get('totalMarks'):
                    total_marks.append((subject.get('totalMarks', 0) / 100) * 100)
        
        return np.mean(total_marks) if total_marks else 0
    
    def _calculate_improvement_trend(self, semester_marks):
        """Calculate if student shows improvement trend across semesters"""
        if len(semester_marks) < 2:
            return 50  # Neutral score if not enough data
        
        cgpas = [s.get('sgpa', 0) for s in semester_marks]
        
        if not cgpas:
            return 50
        
        # Calculate trend
        improvements = 0
        for i in range(1, len(cgpas)):
            if cgpas[i] > cgpas[i-1]:
                improvements += 1
        
        trend_score = (improvements / (len(cgpas) - 1)) * 100
        return min(100, max(0, trend_score))
    
    def _calculate_consistency(self, semester_marks, attendance_records):
        """Calculate consistency in performance and attendance"""
        scores = []
        
        # CGPA consistency
        if semester_marks:
            cgpas = [s.get('sgpa', 0) for s in semester_marks]
            cgpa_std = np.std(cgpas) if cgpas else 0
            cgpa_consistency = max(0, 100 - (cgpa_std * 10))
            scores.append(cgpa_consistency)
        
        # Attendance consistency
        if attendance_records:
            attendances = [r.get('overallPercentage', 0) for r in attendance_records]
            att_std = np.std(attendances) if attendances else 0
            att_consistency = max(0, 100 - (att_std * 5))
            scores.append(att_consistency)
        
        return np.mean(scores) if scores else 50
    
    def _rate_subject_performance(self, subject_score, grade, attendance):
        """Rate subject performance based on score, grade, and attendance"""
        score = 0
        
        # Grade-based rating
        grade_ratings = {
            'A+': 95, 'A': 90, 'B+': 85, 'B': 80, 'C+': 75, 'C': 70, 'D': 60, 'F': 0
        }
        
        if grade in grade_ratings:
            score += grade_ratings[grade] * 0.6
        else:
            score += subject_score * 0.6
        
        # Attendance bonus
        if attendance >= 90:
            score += 20
        elif attendance >= 75:
            score += 10
        
        return min(100, max(0, score))
    
    def _categorize_performance(self, overall_score):
        """Categorize performance based on score"""
        if overall_score >= 85:
            return 'Excellent'
        elif overall_score >= 75:
            return 'Very Good'
        elif overall_score >= 65:
            return 'Good'
        elif overall_score >= 50:
            return 'Average'
        else:
            return 'Below Average'
    
    def _assess_risk(self, cgpa, attendance, backlogs, semester_marks):
        """Assess risk level for student"""
        risk_score = 0
        
        # CGPA risk
        if cgpa < 5:
            risk_score += 40
        elif cgpa < 6:
            risk_score += 25
        elif cgpa < 7:
            risk_score += 10
        
        # Attendance risk
        if attendance < 70:
            risk_score += 30
        elif attendance < 75:
            risk_score += 15
        elif attendance < 80:
            risk_score += 5
        
        # Backlogs risk
        if backlogs > 2:
            risk_score += 25
        elif backlogs > 0:
            risk_score += 15
        
        # Negative trend risk
        if semester_marks:
            cgpas = [s.get('sgpa', 0) for s in semester_marks]
            if len(cgpas) > 1 and cgpas[-1] < cgpas[0]:
                risk_score += 10
        
        # Categorize risk
        if risk_score >= 60:
            return 'Critical Risk'
        elif risk_score >= 40:
            return 'High Risk'
        elif risk_score >= 20:
            return 'Medium Risk'
        else:
            return 'Low Risk'
    
    def _generate_recommendations(self, cgpa, attendance, semester_marks, backlogs, risk_level):
        """Generate personalized recommendations for student"""
        recommendations = []
        
        if attendance < 75:
            recommendations.append('Improve attendance - Currently below 75%. Attend more classes regularly.')
        
        if cgpa < 6:
            recommendations.append('Focus on academics - CGPA below 6. Consider additional study sessions.')
        
        if backlogs > 0:
            recommendations.append(f'Clear {backlogs} backlog(s) - Prepare well for supplementary exams.')
        
        if risk_level in ['High Risk', 'Critical Risk']:
            recommendations.append('Seek academic counseling - Your performance indicates need for additional support.')
        
        # Improvement trend
        if semester_marks and len(semester_marks) > 1:
            cgpas = [s.get('sgpa', 0) for s in semester_marks]
            if cgpas[-1] < cgpas[0]:
                recommendations.append('Address declining trend - Your grades are decreasing. Review study methods.')
            elif cgpas[-1] > cgpas[0]:
                recommendations.append('Maintain momentum - Your grades are improving. Keep up the good work!')
        
        if not recommendations:
            recommendations.append('Continue your current performance - You are doing well!')
        
        return recommendations
    
    def _calculate_placement_probability(self, cgpa, attendance, backlogs):
        """Calculate placement probability"""
        base_prob = 0
        
        if cgpa >= 7 and attendance >= 75 and backlogs == 0:
            base_prob = 85
        elif cgpa >= 6.5 and attendance >= 70 and backlogs == 0:
            base_prob = 70
        elif cgpa >= 6 and attendance >= 65:
            base_prob = 55
        elif cgpa >= 5:
            base_prob = 35
        else:
            base_prob = 15
        
        return min(100, max(0, base_prob))
    
    def _calculate_subject_stats_for_faculty(self, students_data):
        """Calculate overall subject-wise statistics for faculty"""
        subject_stats = {}
        
        for student in students_data:
            semester_marks = student.get('semesterMarks', [])
            for semester in semester_marks:
                for subject in semester.get('subjects', []):
                    subject_name = subject.get('subjectName', 'Unknown')
                    
                    if subject_name not in subject_stats:
                        subject_stats[subject_name] = {
                            'total_marks': [],
                            'grades': [],
                            'count': 0,
                            'avg_marks': 0,
                            'avg_grade_point': 0
                        }
                    
                    subject_stats[subject_name]['total_marks'].append(subject.get('totalMarks', 0))
                    subject_stats[subject_name]['grades'].append(subject.get('grade', 'N/A'))
                    subject_stats[subject_name]['count'] += 1
        
        # Calculate averages
        for subject_name in subject_stats:
            stats = subject_stats[subject_name]
            if stats['total_marks']:
                stats['avg_marks'] = round(np.mean(stats['total_marks']), 2)
            
            # Calculate grade distribution
            grade_counts = {}
            for grade in stats['grades']:
                if grade != 'N/A':
                    grade_counts[grade] = grade_counts.get(grade, 0) + 1
            
            stats['grade_distribution'] = grade_counts
            del stats['total_marks']  # Remove raw data
            del stats['grades']
        
        return subject_stats
