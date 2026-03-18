"""Flask routes for student performance analysis and model operations."""

from __future__ import annotations

import os
from datetime import datetime
from flask import Blueprint, request, jsonify

from models.performance_model import (
    StudentPerformanceAnalyzer,
    documents_to_training_frame,
)

performance_bp = Blueprint("performance", __name__, url_prefix="/api/ml/performance")
analyzer = StudentPerformanceAnalyzer()


def _students_payload(data):
    students = data.get("students", []) if isinstance(data, dict) else []
    if not isinstance(students, list):
        return []
    return students


@performance_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})


@performance_bp.route("/model-info", methods=["GET"])
def model_info():
    return jsonify(
        {
            "modelType": "RandomForestClassifier",
            "version": "2.0.0",
            "trained": analyzer.is_trained,
            "lastTrained": analyzer.last_trained,
            "features": analyzer.feature_columns,
            "accuracy": (analyzer.metrics.get("accuracy", 0) * 100) if analyzer.metrics else 0,
            "metrics": analyzer.metrics,
            "featureImportance": analyzer.feature_importance,
        }
    )


@performance_bp.route("/train-db", methods=["POST"])
def train_db():
    try:
        data = request.get_json() or {}
        students = _students_payload(data)
        if not students:
            return jsonify({"error": "No students data provided"}), 400

        df = documents_to_training_frame(students)
        result = analyzer.train_model(df)
        return jsonify({"success": True, "message": "Model trained from database data", **result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/train-csv", methods=["POST"])
def train_csv():
    try:
        data = request.get_json() or {}
        marks_path = data.get("marks_csv")
        attendance_path = data.get("attendance_csv")

        if not marks_path or not attendance_path:
            return jsonify({"error": "marks_csv and attendance_csv are required"}), 400

        marks_df = analyzer.load_marks_csv(marks_path)
        attendance_df = analyzer.load_attendance_csv(attendance_path)
        merged = analyzer.merge_data(marks_df, attendance_df)
        result = analyzer.train_model(merged)
        return jsonify({"success": True, "message": "Model trained from CSV files", **result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/predict", methods=["POST"])
def predict_performance():
    try:
        data = request.get_json() or {}
        if "student" in data:
            student_data = data["student"]
            perf = analyzer.calculate_individual_performance(student_data)
            return jsonify(
                {
                    "success": True,
                    "prediction": {
                        "predictedCGPA": round(float(student_data.get("cgpa", 0) or 0) * 0.7 + perf["subject_performance_score"] / 20, 2),
                        "placementProbability": perf["placement_probability"],
                        "riskCategory": perf["risk_level"].replace(" Risk", ""),
                        "recommendations": perf["recommendations"],
                        "confidence": 0.82,
                    },
                }
            )

        # Feature based prediction
        pred = analyzer.predict_label(data)
        return jsonify({"success": True, **pred})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/search-student", methods=["POST"])
def search_student():
    try:
        data = request.get_json() or {}
        query = data.get("query", "")
        students = _students_payload(data)
        matches = analyzer.search_students(students, query)
        return jsonify({"success": True, "count": len(matches), "students": matches})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/individual/<student_id>", methods=["POST"])
def get_individual_performance(student_id):
    try:
        student_data = request.get_json() or {}
        if not student_data:
            return jsonify({"error": "No student data provided"}), 400

        performance = analyzer.calculate_individual_performance(student_data)
        trends = analyzer.performance_trends_over_time(student_data)
        radar_path = analyzer.generate_radar_chart(student_data)

        return jsonify(
            {
                "success": True,
                "student_id": student_id,
                "timestamp": datetime.now().isoformat(),
                "performance": performance,
                "trends": trends,
                "radar_chart": radar_path,
            }
        ), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/subject-wise/<student_id>", methods=["POST"])
def get_subject_wise_performance(student_id):
    try:
        student_data = request.get_json() or {}
        if not student_data:
            return jsonify({"error": "No student data provided"}), 400

        subject_analysis = analyzer.calculate_subject_wise_performance(student_data)
        return jsonify(
            {
                "success": True,
                "student_id": student_id,
                "timestamp": datetime.now().isoformat(),
                "subject_wise_analysis": subject_analysis,
            }
        ), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/faculty-statistics", methods=["POST"])
def get_faculty_statistics():
    try:
        data = request.get_json() or {}
        students = _students_payload(data)
        if not students:
            return jsonify({"error": "No students data provided"}), 400

        stats = analyzer.calculate_faculty_statistics(students)
        dist_plot = analyzer.class_distribution_plot(students)
        scatter_plot = analyzer.attendance_marks_scatter(students)

        return jsonify(
            {
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "statistics": stats,
                "plots": {
                    "distribution": dist_plot,
                    "attendance_vs_marks": scatter_plot,
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/at-risk-students", methods=["POST"])
def get_at_risk_students():
    try:
        data = request.get_json() or {}
        students = _students_payload(data)
        if not students:
            return jsonify({"error": "No students data provided"}), 400

        high = []
        critical = []
        for s in students:
            perf = analyzer.calculate_individual_performance(s)
            if perf["risk_level"] in ["High Risk", "Critical Risk"]:
                item = {
                    "name": s.get("studentName"),
                    "roll_no": s.get("rollNo"),
                    "prn": s.get("prn"),
                    "cgpa": s.get("cgpa"),
                    "attendance": s.get("overallAttendance"),
                    "backlogs": s.get("backlogs"),
                    "risk_level": perf["risk_level"],
                    "performance_score": perf["overall_performance_score"],
                    "recommendations": perf["recommendations"],
                }
                if perf["risk_level"] == "Critical Risk":
                    critical.append(item)
                else:
                    high.append(item)

        return jsonify(
            {
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "total_at_risk": len(high) + len(critical),
                "critical_risk_students": critical,
                "high_risk_students": high,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/subject-analysis", methods=["POST"])
def get_subject_analysis():
    try:
        data = request.get_json() or {}
        students = _students_payload(data)
        subject_name = data.get("subject_name", "All Subjects")
        if not students:
            return jsonify({"error": "No students data provided"}), 400

        records = []
        marks = []
        grades = {}
        for s in students:
            for sem in s.get("semesterMarks", []) or []:
                for sub in sem.get("subjects", []) or []:
                    sub_name = sub.get("subjectName", "Unknown")
                    if subject_name != "All Subjects" and sub_name != subject_name:
                        continue
                    m = float(sub.get("totalMarks", 0) or 0)
                    g = sub.get("grade", "N/A")
                    records.append(
                        {
                            "student_name": s.get("studentName"),
                            "prn": s.get("prn"),
                            "subject": sub_name,
                            "marks": m,
                            "grade": g,
                        }
                    )
                    marks.append(m)
                    grades[g] = grades.get(g, 0) + 1

        avg_marks = round(sum(marks) / len(marks), 2) if marks else 0
        return jsonify(
            {
                "success": True,
                "subject_name": subject_name,
                "timestamp": datetime.now().isoformat(),
                "statistics": {
                    "total_students": len(records),
                    "average_marks": avg_marks,
                    "highest_marks": max(marks) if marks else 0,
                    "lowest_marks": min(marks) if marks else 0,
                    "grade_distribution": grades,
                },
                "student_performances": records,
                "subject_wise_attendance": analyzer.subject_wise_attendance_analysis(students),
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/compare-students", methods=["POST"])
def compare_students():
    try:
        data = request.get_json() or {}
        students = _students_payload(data)
        if not students:
            return jsonify({"error": "No students data provided"}), 400

        comparison = []
        for s in students:
            perf = analyzer.calculate_individual_performance(s)
            comparison.append(
                {
                    "name": s.get("studentName"),
                    "roll_no": s.get("rollNo"),
                    "cgpa": s.get("cgpa"),
                    "attendance": s.get("overallAttendance"),
                    "performance_score": perf["overall_performance_score"],
                    "performance_category": perf["performance_category"],
                    "risk_level": perf["risk_level"],
                }
            )
        comparison = sorted(comparison, key=lambda x: x["performance_score"], reverse=True)

        return jsonify(
            {
                "success": True,
                "timestamp": datetime.now().isoformat(),
                "comparison_count": len(comparison),
                "students_comparison": comparison,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/improvement-analysis/<student_id>", methods=["POST"])
def get_improvement_analysis(student_id):
    try:
        student_data = request.get_json() or {}
        if not student_data:
            return jsonify({"error": "No student data provided"}), 400

        trend = analyzer.performance_trends_over_time(student_data)
        if len(trend) < 1:
            return jsonify({"error": "No semester trend data available"}), 400

        deltas = []
        for i in range(1, len(trend)):
            deltas.append(trend[i]["sgpa"] - trend[i - 1]["sgpa"])

        trend_type = "stable"
        if deltas and sum(deltas) > 0:
            trend_type = "improving"
        elif deltas and sum(deltas) < 0:
            trend_type = "declining"

        return jsonify(
            {
                "success": True,
                "student_id": student_id,
                "timestamp": datetime.now().isoformat(),
                "trend_type": trend_type,
                "trend_data": trend,
                "average_change": round(sum(deltas) / len(deltas), 3) if deltas else 0,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/save-model", methods=["POST"])
def save_model():
    try:
        data = request.get_json() or {}
        path = data.get("path", "models/performance_model.joblib")
        result = analyzer.save_model(path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/load-model", methods=["POST"])
def load_model():
    try:
        data = request.get_json() or {}
        path = data.get("path", "models/performance_model.joblib")
        result = analyzer.load_model(path)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@performance_bp.route("/menu-options", methods=["GET"])
def menu_options():
    return jsonify({"options": analyzer.menu_options()})
