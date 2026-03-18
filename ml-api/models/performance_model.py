"""
Advanced Student Performance Analyzer for Campus Connect.
Includes data loading, preprocessing, feature engineering, model training,
analysis, visualization, and report export utilities.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

try:
    import joblib
except Exception:  # pragma: no cover
    joblib = None

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover
    plt = None


class StudentPerformanceAnalyzer:
    """Main analyzer class used by API and optional CLI menu."""

    LABELS = ["Poor", "Average", "Good", "Excellent"]

    def __init__(self) -> None:
        self.scaler = StandardScaler()
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight="balanced_subsample",
        )
        self.feature_columns: List[str] = []
        self.metrics: Dict[str, float] = {}
        self.feature_importance: Dict[str, float] = {}
        self.last_trained: Optional[str] = None
        self.is_trained: bool = False

    # -----------------------------
    # Data Loading / Preprocessing
    # -----------------------------
    def load_marks_csv(self, file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Marks file not found: {file_path}")

        df = pd.read_csv(file_path)
        df.columns = [str(c).strip() for c in df.columns]

        rename_map = {
            "PRN NO": "PRN",
            "PRN No": "PRN",
            "prn": "PRN",
            "Name of Student": "student_name",
            "Student Name": "student_name",
            "Name": "student_name",
            "IN SEM Total": "in_sem_total",
            "END SEM Total": "end_sem_total",
            "IN SEM Percentage": "in_sem_percentage",
            "END SEM Percentage": "end_sem_percentage",
        }
        df = df.rename(columns=rename_map)

        if "PRN" not in df.columns and "student_name" not in df.columns:
            raise ValueError("Marks CSV must include PRN or student name column")

        return df

    def load_attendance_csv(self, file_path: str) -> pd.DataFrame:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Attendance file not found: {file_path}")

        df = pd.read_csv(file_path)
        df.columns = [str(c).strip() for c in df.columns]

        rename_map = {
            "PRN NO": "PRN",
            "PRN No": "PRN",
            "prn": "PRN",
            "Student Name": "student_name",
            "Name of Student": "student_name",
            "Name": "student_name",
            "Overall": "overall_attendance",
            "Overall Attendance": "overall_attendance",
        }
        df = df.rename(columns=rename_map)

        if "PRN" not in df.columns and "student_name" not in df.columns:
            raise ValueError("Attendance CSV must include PRN or student name column")

        return df

    def merge_data(self, marks_df: pd.DataFrame, attendance_df: pd.DataFrame) -> pd.DataFrame:
        marks_df = marks_df.copy()
        attendance_df = attendance_df.copy()

        if "PRN" in marks_df.columns and "PRN" in attendance_df.columns:
            merged = pd.merge(marks_df, attendance_df, on="PRN", how="outer", suffixes=("_marks", "_attendance"))
        else:
            if "student_name" not in marks_df.columns or "student_name" not in attendance_df.columns:
                raise ValueError("Cannot merge data. Provide PRN or student_name in both files")
            marks_df["student_key"] = marks_df["student_name"].astype(str).str.strip().str.lower()
            attendance_df["student_key"] = attendance_df["student_name"].astype(str).str.strip().str.lower()
            merged = pd.merge(marks_df, attendance_df, on="student_key", how="outer", suffixes=("_marks", "_attendance"))

        return merged

    def label_performance(self, percentage: float) -> str:
        if percentage < 40:
            return "Poor"
        if percentage < 60:
            return "Average"
        if percentage < 75:
            return "Good"
        return "Excellent"

    # -----------------------------
    # Feature Engineering
    # -----------------------------
    def feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()

        # Normalize common numeric columns
        numeric_cols = [
            "in_sem_total", "end_sem_total", "in_sem_percentage", "end_sem_percentage",
            "overall_attendance", "theory_attendance", "practical_attendance",
            "theory_marks", "practical_marks", "cgpa", "backlogs",
        ]

        # Add fallback derivations from subject style columns
        in_sem_subject_cols = [c for c in out.columns if "IN SEM sub" in str(c) or str(c).lower().startswith("in sem sub")]
        end_sem_subject_cols = [c for c in out.columns if "END SEM sub" in str(c) or str(c).lower().startswith("end sem sub")]

        if "in_sem_total" not in out.columns and in_sem_subject_cols:
            out["in_sem_total"] = out[in_sem_subject_cols].apply(pd.to_numeric, errors="coerce").sum(axis=1)
        if "end_sem_total" not in out.columns and end_sem_subject_cols:
            out["end_sem_total"] = out[end_sem_subject_cols].apply(pd.to_numeric, errors="coerce").sum(axis=1)

        if "overall_attendance" not in out.columns:
            if "overallPercentage" in out.columns:
                out["overall_attendance"] = out["overallPercentage"]
            elif "overall" in out.columns:
                out["overall_attendance"] = out["overall"]

        for col in numeric_cols:
            if col not in out.columns:
                out[col] = np.nan
            out[col] = pd.to_numeric(out[col], errors="coerce")

        # Useful aggregates
        out["total_marks"] = out["in_sem_total"].fillna(0) + out["end_sem_total"].fillna(0)
        out["overall_percentage"] = np.where(
            out["total_marks"] > 0,
            (out["total_marks"] / np.maximum(out["total_marks"].max(), 1)) * 100,
            np.nan,
        )
        out["overall_percentage"] = out["overall_percentage"].fillna(
            out[["in_sem_percentage", "end_sem_percentage"]].mean(axis=1)
        )

        # Requested engineered features
        out["Attendance_Marks_Ratio"] = out["overall_attendance"].fillna(0) / (out["overall_percentage"].fillna(0) + 1e-6)

        theory_base = out["theory_attendance"].fillna(out["theory_marks"])
        practical_base = out["practical_attendance"].fillna(out["practical_marks"])
        out["Theory_Practical_Ratio"] = theory_base.fillna(0) / (practical_base.fillna(0) + 1e-6)

        out["INSEM_Weight"] = out["in_sem_total"].fillna(0) / (out["total_marks"].fillna(0) + 1e-6)

        # Performance label
        out["performance_label"] = out["overall_percentage"].fillna(0).apply(self.label_performance)

        # Missing values handling
        num_cols = out.select_dtypes(include=[np.number]).columns
        for col in num_cols:
            out[col] = out[col].fillna(out[col].median() if not np.isnan(out[col].median()) else 0)

        return out

    def select_features(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        preferred = [
            "overall_attendance",
            "in_sem_total",
            "end_sem_total",
            "in_sem_percentage",
            "end_sem_percentage",
            "cgpa",
            "backlogs",
            "Attendance_Marks_Ratio",
            "Theory_Practical_Ratio",
            "INSEM_Weight",
        ]

        available = [c for c in preferred if c in df.columns]
        if not available:
            raise ValueError("No valid features found for training")

        self.feature_columns = available
        x = df[available].copy()
        y = df["performance_label"].copy()
        return x, y

    # -----------------------------
    # ML Training / Evaluation
    # -----------------------------
    def train_model(self, source_df: pd.DataFrame) -> Dict[str, Any]:
        if source_df.empty:
            raise ValueError("Cannot train on empty dataset")

        df = self.feature_engineering(source_df)
        x, y = self.select_features(df)

        # Require at least 2 classes for stratification/model learning
        if y.nunique() < 2:
            raise ValueError("Training requires at least 2 performance classes")

        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=0.2, random_state=42, stratify=y
        )

        x_train_scaled = self.scaler.fit_transform(x_train)
        x_test_scaled = self.scaler.transform(x_test)

        self.model.fit(x_train_scaled, y_train)
        y_pred = self.model.predict(x_test_scaled)

        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_test, y_pred, average="weighted", zero_division=0
        )

        importances = getattr(self.model, "feature_importances_", np.zeros(len(self.feature_columns)))
        self.feature_importance = {
            self.feature_columns[i]: float(round(importances[i], 6))
            for i in range(len(self.feature_columns))
        }

        self.metrics = {
            "accuracy": float(round(accuracy, 4)),
            "precision": float(round(precision, 4)),
            "recall": float(round(recall, 4)),
            "f1_score": float(round(f1, 4)),
        }
        self.last_trained = datetime.now().isoformat()
        self.is_trained = True

        return {
            "success": True,
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "features": self.feature_columns,
            "rows_used": int(len(df)),
            "last_trained": self.last_trained,
        }

    def predict_label(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_trained:
            raise ValueError("Model not trained. Train model before prediction")

        row = {col: float(feature_dict.get(col, 0) or 0) for col in self.feature_columns}
        x = pd.DataFrame([row], columns=self.feature_columns)
        x_scaled = self.scaler.transform(x)
        pred = self.model.predict(x_scaled)[0]
        probs = getattr(self.model, "predict_proba", lambda _: np.array([[0.25, 0.25, 0.25, 0.25]]))(x_scaled)[0]
        classes = list(getattr(self.model, "classes_", self.LABELS))

        probability_map = {classes[i]: float(round(probs[i], 4)) for i in range(min(len(classes), len(probs)))}
        confidence = float(round(max(probability_map.values()) if probability_map else 0.0, 4))

        return {
            "label": pred,
            "confidence": confidence,
            "probabilities": probability_map,
        }

    # -----------------------------
    # Analyzer Behaviors
    # -----------------------------
    def search_students(self, students: List[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
        if not isinstance(query, str) or len(query.strip()) < 2:
            raise ValueError("Search query must be at least 2 characters")

        q = query.strip().lower()
        matches = []
        for s in students:
            name = str(s.get("studentName") or s.get("student_name") or "").lower()
            prn = str(s.get("prn") or s.get("PRN") or "").lower()
            if q in name or q in prn:
                matches.append(s)
        return matches

    def analyze_student(self, student_data: Dict[str, Any], class_students: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        perf = self.calculate_individual_performance(student_data)
        peer = self.peer_comparison(student_data, class_students or []) if class_students else None
        return {
            "student": {
                "prn": student_data.get("prn"),
                "studentName": student_data.get("studentName"),
            },
            "performance": perf,
            "peer_comparison": peer,
            "insights": self._build_insights(perf),
        }

    def class_wide_statistics(self, students: List[Dict[str, Any]]) -> Dict[str, Any]:
        return self.calculate_faculty_statistics(students)

    def peer_comparison(self, student_data: Dict[str, Any], students: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not students:
            return {"note": "No peer dataset provided"}

        scores = []
        target_prn = student_data.get("prn")
        target_score = None
        for s in students:
            p = self.calculate_individual_performance(s)
            score = float(p.get("overall_performance_score", 0))
            scores.append((s.get("prn"), score))
            if s.get("prn") == target_prn:
                target_score = score

        if target_score is None:
            target_score = float(self.calculate_individual_performance(student_data).get("overall_performance_score", 0))
            scores.append((target_prn, target_score))

        sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)
        rank = next((i + 1 for i, item in enumerate(sorted_scores) if item[0] == target_prn), len(sorted_scores))

        values = np.array([s[1] for s in sorted_scores], dtype=float)
        percentile = float(round((values <= target_score).sum() / max(len(values), 1) * 100, 2))

        return {
            "rank": rank,
            "class_size": len(sorted_scores),
            "percentile": percentile,
            "score": float(round(target_score, 2)),
            "class_average": float(round(values.mean() if len(values) else 0, 2)),
        }

    # -----------------------------
    # Visualizations
    # -----------------------------
    def _ensure_plot_dir(self, out_dir: str) -> str:
        os.makedirs(out_dir, exist_ok=True)
        return out_dir

    def generate_radar_chart(self, student_data: Dict[str, Any], out_dir: str = "outputs") -> Optional[str]:
        if plt is None:
            return None

        perf = self.calculate_individual_performance(student_data)
        labels = ["CGPA", "Attendance", "Subject", "Improvement", "Consistency"]
        values = [
            perf.get("cgpa_score", 0),
            perf.get("attendance_score", 0),
            perf.get("subject_performance_score", 0),
            perf.get("improvement_trend", 0),
            perf.get("consistency_score", 0),
        ]

        angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False).tolist()
        values += values[:1]
        angles += angles[:1]

        self._ensure_plot_dir(out_dir)
        path = os.path.join(out_dir, f"radar_{student_data.get('prn', 'student')}.png")

        fig = plt.figure(figsize=(6, 6))
        ax = fig.add_subplot(111, polar=True)
        ax.plot(angles, values, linewidth=2)
        ax.fill(angles, values, alpha=0.25)
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(labels)
        ax.set_title("Student Performance Radar")
        fig.tight_layout()
        fig.savefig(path)
        plt.close(fig)
        return path

    def class_distribution_plot(self, students: List[Dict[str, Any]], out_dir: str = "outputs") -> Optional[str]:
        if plt is None:
            return None

        labels = [self.calculate_individual_performance(s)["performance_category"] for s in students]
        series = pd.Series(labels).value_counts()

        self._ensure_plot_dir(out_dir)
        path = os.path.join(out_dir, "class_distribution.png")

        fig = plt.figure(figsize=(8, 5))
        series.plot(kind="bar")
        plt.title("Class Performance Distribution")
        plt.ylabel("Students")
        plt.tight_layout()
        fig.savefig(path)
        plt.close(fig)
        return path

    def attendance_marks_scatter(self, students: List[Dict[str, Any]], out_dir: str = "outputs") -> Optional[str]:
        if plt is None:
            return None

        attendance = []
        marks = []
        for s in students:
            attendance.append(float(s.get("overallAttendance", 0) or 0))
            marks.append(float(self._extract_marks_percentage(s)))

        self._ensure_plot_dir(out_dir)
        path = os.path.join(out_dir, "attendance_marks_scatter.png")

        fig = plt.figure(figsize=(8, 5))
        plt.scatter(attendance, marks, alpha=0.7)
        plt.xlabel("Attendance %")
        plt.ylabel("Marks %")
        plt.title("Attendance vs Marks")
        plt.tight_layout()
        fig.savefig(path)
        plt.close(fig)
        return path

    def subject_wise_attendance_analysis(self, students: List[Dict[str, Any]]) -> Dict[str, Any]:
        subject_map: Dict[str, List[float]] = {}
        for s in students:
            for rec in s.get("attendance", []) or []:
                for sub in rec.get("subjects", []) or []:
                    name = sub.get("subjectName") or "Unknown"
                    pct = float(sub.get("percentage", 0) or 0)
                    subject_map.setdefault(name, []).append(pct)

        return {
            subject: {
                "avg_attendance": float(round(np.mean(values), 2)),
                "min_attendance": float(round(np.min(values), 2)),
                "max_attendance": float(round(np.max(values), 2)),
                "count": len(values),
            }
            for subject, values in subject_map.items()
        }

    def performance_trends_over_time(self, student_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        trend = []
        for sem in student_data.get("semesterMarks", []) or []:
            trend.append(
                {
                    "semester": sem.get("semester"),
                    "year": sem.get("year"),
                    "sgpa": float(sem.get("sgpa", 0) or 0),
                }
            )
        return sorted(trend, key=lambda x: (x.get("semester") or 0))

    # -----------------------------
    # Persistence and Reports
    # -----------------------------
    def save_model(self, file_path: str) -> Dict[str, Any]:
        if joblib is None:
            raise RuntimeError("joblib is not installed")
        if not self.is_trained:
            raise ValueError("Model is not trained")

        payload = {
            "model": self.model,
            "scaler": self.scaler,
            "feature_columns": self.feature_columns,
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "last_trained": self.last_trained,
        }
        os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
        joblib.dump(payload, file_path)
        return {"success": True, "path": file_path}

    def load_model(self, file_path: str) -> Dict[str, Any]:
        if joblib is None:
            raise RuntimeError("joblib is not installed")
        if not os.path.exists(file_path):
            raise FileNotFoundError(file_path)

        payload = joblib.load(file_path)
        self.model = payload["model"]
        self.scaler = payload["scaler"]
        self.feature_columns = payload.get("feature_columns", [])
        self.metrics = payload.get("metrics", {})
        self.feature_importance = payload.get("feature_importance", {})
        self.last_trained = payload.get("last_trained")
        self.is_trained = True
        return {"success": True, "path": file_path}

    def export_report(self, report_data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
        os.makedirs(os.path.dirname(file_path) or ".", exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        return {"success": True, "path": file_path}

    def menu_options(self) -> List[str]:
        return [
            "1. Load Marks CSV",
            "2. Load Attendance CSV",
            "3. Merge and Preprocess Data",
            "4. Train Model",
            "5. Evaluate Model",
            "6. Search Student",
            "7. Analyze Individual Student",
            "8. Class Statistics",
            "9. Predict Performance",
            "10. Peer Comparison",
            "11. Generate Plots",
            "12. Save/Load/Export",
        ]

    # -----------------------------
    # Compatibility methods used by current routes
    # -----------------------------
    def calculate_individual_performance(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        cgpa = float(student_data.get("cgpa", 0) or 0)
        attendance = float(student_data.get("overallAttendance", student_data.get("attendance", 0)) or 0)
        marks_pct = float(self._extract_marks_percentage(student_data))
        backlogs = int(student_data.get("backlogs", 0) or 0)

        # Weighted score
        overall = (cgpa * 10 * 0.35) + (attendance * 0.30) + (marks_pct * 0.25) + (max(0, 100 - backlogs * 15) * 0.10)
        overall = float(round(max(0, min(100, overall)), 2))

        category = self._category_from_score(overall)

        risk = "Low Risk"
        if overall < 45 or attendance < 65 or backlogs >= 3:
            risk = "Critical Risk"
        elif overall < 60 or attendance < 75 or backlogs >= 1:
            risk = "High Risk"
        elif overall < 70:
            risk = "Medium Risk"

        recommendations = self._recommendations(cgpa, attendance, backlogs, marks_pct)
        placement_prob = float(round(max(5, min(98, overall - backlogs * 4)), 2))

        return {
            "overall_performance_score": overall,
            "performance_category": category,
            "cgpa_score": float(round(cgpa * 10, 2)),
            "attendance_score": float(round(attendance, 2)),
            "subject_performance_score": float(round(marks_pct, 2)),
            "improvement_trend": float(round(self._improvement_trend(student_data), 2)),
            "consistency_score": float(round(self._consistency_score(student_data), 2)),
            "risk_level": risk,
            "backlogs": backlogs,
            "recommendations": recommendations,
            "placement_probability": placement_prob,
        }

    def calculate_subject_wise_performance(self, student_data: Dict[str, Any]) -> Dict[str, Any]:
        attendance_lookup: Dict[str, float] = {}
        for rec in student_data.get("attendance", []) or []:
            for sub in rec.get("subjects", []) or []:
                attendance_lookup[sub.get("subjectName", "Unknown")] = float(sub.get("percentage", 0) or 0)

        result: Dict[str, List[Dict[str, Any]]] = {}
        for sem in student_data.get("semesterMarks", []) or []:
            key = f"Year {sem.get('year', 'N/A')} - Semester {sem.get('semester', 'N/A')}"
            result[key] = []
            for sub in sem.get("subjects", []) or []:
                total = float(sub.get("totalMarks", 0) or 0)
                internal = float(sub.get("internalMarks", 0) or 0)
                external = float(sub.get("externalMarks", 0) or 0)
                subject_name = sub.get("subjectName", "Unknown")
                score_pct = float(round(total, 2))
                result[key].append(
                    {
                        "subject_name": subject_name,
                        "subject_code": sub.get("subjectCode", "N/A"),
                        "internal_marks": internal,
                        "external_marks": external,
                        "total_marks": total,
                        "credits": sub.get("credits", 0),
                        "grade": sub.get("grade", "N/A"),
                        "subject_score": score_pct,
                        "subject_attendance": attendance_lookup.get(subject_name, 0.0),
                        "performance_rating": self._category_from_score(score_pct),
                    }
                )
        return result

    def calculate_faculty_statistics(self, students_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not students_data:
            return {
                "total_students": 0,
                "average_cgpa": 0,
                "average_attendance": 0,
                "average_performance_score": 0,
                "average_placement_probability": 0,
                "performance_distribution": {},
                "risk_distribution": {},
                "subject_performance_stats": {},
                "top_performers": [],
                "bottom_performers": [],
                "total_backlogs": 0,
                "students_at_risk": 0,
            }

        perf_rows = []
        for s in students_data:
            p = self.calculate_individual_performance(s)
            perf_rows.append({
                "prn": s.get("prn"),
                "name": s.get("studentName"),
                "cgpa": float(s.get("cgpa", 0) or 0),
                "attendance": float(s.get("overallAttendance", 0) or 0),
                "score": p["overall_performance_score"],
                "risk": p["risk_level"],
                "placement": p["placement_probability"],
            })

        df = pd.DataFrame(perf_rows)
        perf_dist = {
            "excellent": int((df["score"] >= 85).sum()),
            "very_good": int(((df["score"] >= 75) & (df["score"] < 85)).sum()),
            "good": int(((df["score"] >= 60) & (df["score"] < 75)).sum()),
            "average": int(((df["score"] >= 45) & (df["score"] < 60)).sum()),
            "below_average": int((df["score"] < 45).sum()),
        }
        risk_dist = {
            "low_risk": int((df["risk"] == "Low Risk").sum()),
            "medium_risk": int((df["risk"] == "Medium Risk").sum()),
            "high_risk": int((df["risk"] == "High Risk").sum()),
            "critical_risk": int((df["risk"] == "Critical Risk").sum()),
        }

        df_sorted = df.sort_values("score", ascending=False)
        top = [
            {
                "name": row["name"],
                "performance_score": float(round(row["score"], 2)),
                "cgpa": float(round(row["cgpa"], 2)),
            }
            for _, row in df_sorted.head(5).iterrows()
        ]
        bottom = [
            {
                "name": row["name"],
                "performance_score": float(round(row["score"], 2)),
                "cgpa": float(round(row["cgpa"], 2)),
            }
            for _, row in df_sorted.tail(5).iterrows()
        ]

        return {
            "total_students": int(len(df)),
            "average_cgpa": float(round(df["cgpa"].mean(), 2)),
            "average_attendance": float(round(df["attendance"].mean(), 2)),
            "average_performance_score": float(round(df["score"].mean(), 2)),
            "average_placement_probability": float(round(df["placement"].mean(), 2)),
            "performance_distribution": perf_dist,
            "risk_distribution": risk_dist,
            "subject_performance_stats": self.subject_wise_attendance_analysis(students_data),
            "top_performers": top,
            "bottom_performers": bottom,
            "total_backlogs": int(sum(int(s.get("backlogs", 0) or 0) for s in students_data)),
            "students_at_risk": int(risk_dist["high_risk"] + risk_dist["critical_risk"]),
        }

    # -----------------------------
    # Internals
    # -----------------------------
    def _extract_marks_percentage(self, student_data: Dict[str, Any]) -> float:
        totals = []
        for sem in student_data.get("semesterMarks", []) or []:
            for sub in sem.get("subjects", []) or []:
                totals.append(float(sub.get("totalMarks", 0) or 0))
        if totals:
            return float(np.mean(totals))
        return float(student_data.get("cgpa", 0) or 0) * 10.0

    def _improvement_trend(self, student_data: Dict[str, Any]) -> float:
        s = student_data.get("semesterMarks", []) or []
        if len(s) < 2:
            return 50.0
        sgpas = [float(i.get("sgpa", 0) or 0) for i in s]
        if not sgpas:
            return 50.0
        deltas = np.diff(sgpas)
        positive_ratio = (deltas > 0).sum() / max(len(deltas), 1)
        return float(round(positive_ratio * 100, 2))

    def _consistency_score(self, student_data: Dict[str, Any]) -> float:
        s = student_data.get("semesterMarks", []) or []
        if len(s) < 2:
            return 60.0
        sgpas = np.array([float(i.get("sgpa", 0) or 0) for i in s], dtype=float)
        std = float(np.std(sgpas)) if len(sgpas) else 0.0
        return float(round(max(0, 100 - std * 25), 2))

    def _category_from_score(self, score: float) -> str:
        if score >= 75:
            return "Excellent"
        if score >= 60:
            return "Good"
        if score >= 40:
            return "Average"
        return "Poor"

    def _recommendations(self, cgpa: float, attendance: float, backlogs: int, marks_pct: float) -> List[str]:
        rec = []
        if attendance < 75:
            rec.append("Improve attendance to at least 75%.")
        if cgpa < 6.5:
            rec.append("Increase weekly revision and solve previous papers.")
        if backlogs > 0:
            rec.append(f"Create a plan to clear {backlogs} backlog(s) this term.")
        if marks_pct < 55:
            rec.append("Focus on core subjects and practice tests.")
        if not rec:
            rec.append("Maintain current performance and target advanced projects.")
        return rec

    def _build_insights(self, perf: Dict[str, Any]) -> List[str]:
        insights = [
            f"Current category: {perf.get('performance_category', 'N/A')}",
            f"Risk level: {perf.get('risk_level', 'N/A')}",
            f"Placement probability: {perf.get('placement_probability', 0)}%",
        ]
        return insights


def documents_to_training_frame(students_data: List[Dict[str, Any]]) -> pd.DataFrame:
    """Build a flat dataframe from Mongo-like student documents for model training."""
    rows: List[Dict[str, Any]] = []
    for s in students_data:
        cgpa = float(s.get("cgpa", 0) or 0)
        attendance = float(s.get("overallAttendance", 0) or 0)
        backlogs = int(s.get("backlogs", 0) or 0)

        in_sem_vals = []
        end_sem_vals = []
        for sem in s.get("semesterMarks", []) or []:
            for sub in sem.get("subjects", []) or []:
                in_sem_vals.append(float(sub.get("internalMarks", 0) or 0))
                end_sem_vals.append(float(sub.get("externalMarks", 0) or 0))

        in_total = float(np.mean(in_sem_vals) if in_sem_vals else cgpa * 4)
        end_total = float(np.mean(end_sem_vals) if end_sem_vals else cgpa * 6)

        row = {
            "PRN": s.get("prn"),
            "student_name": s.get("studentName"),
            "cgpa": cgpa,
            "overall_attendance": attendance,
            "backlogs": backlogs,
            "in_sem_total": in_total,
            "end_sem_total": end_total,
        }
        rows.append(row)

    return pd.DataFrame(rows)
