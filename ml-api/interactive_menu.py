"""Interactive 12-option menu for StudentPerformanceAnalyzer."""

from __future__ import annotations

import json

from models.performance_model import StudentPerformanceAnalyzer, documents_to_training_frame


def run_menu() -> None:
    analyzer = StudentPerformanceAnalyzer()
    students_cache = []

    while True:
        print("\n=== Campus Connect ML Menu ===")
        for option in analyzer.menu_options():
            print(option)
        print("0. Exit")

        choice = input("Select option: ").strip()

        try:
            if choice == "0":
                print("Exiting menu.")
                break

            elif choice == "1":
                path = input("Marks CSV path: ").strip()
                marks_df = analyzer.load_marks_csv(path)
                print(f"Loaded marks rows: {len(marks_df)}")

            elif choice == "2":
                path = input("Attendance CSV path: ").strip()
                att_df = analyzer.load_attendance_csv(path)
                print(f"Loaded attendance rows: {len(att_df)}")

            elif choice == "3":
                marks_path = input("Marks CSV path: ").strip()
                att_path = input("Attendance CSV path: ").strip()
                merged = analyzer.merge_data(analyzer.load_marks_csv(marks_path), analyzer.load_attendance_csv(att_path))
                engineered = analyzer.feature_engineering(merged)
                print(f"Merged rows: {len(engineered)}")
                print("Columns:", ", ".join(engineered.columns[:20]))

            elif choice == "4":
                raw = input("Paste students JSON array (Mongo-style) for training: ").strip()
                students_cache = json.loads(raw)
                df = documents_to_training_frame(students_cache)
                result = analyzer.train_model(df)
                print(json.dumps(result, indent=2))

            elif choice == "5":
                print(json.dumps({"metrics": analyzer.metrics, "feature_importance": analyzer.feature_importance}, indent=2))

            elif choice == "6":
                query = input("Search by name or PRN: ").strip()
                matches = analyzer.search_students(students_cache, query)
                print(f"Matches: {len(matches)}")
                print(json.dumps(matches[:5], indent=2))

            elif choice == "7":
                student_raw = input("Paste student JSON: ").strip()
                student = json.loads(student_raw)
                analysis = analyzer.analyze_student(student, students_cache)
                print(json.dumps(analysis, indent=2))

            elif choice == "8":
                stats = analyzer.class_wide_statistics(students_cache)
                print(json.dumps(stats, indent=2))

            elif choice == "9":
                feature_raw = input("Paste feature JSON for prediction: ").strip()
                feature_data = json.loads(feature_raw)
                print(json.dumps(analyzer.predict_label(feature_data), indent=2))

            elif choice == "10":
                student_raw = input("Paste student JSON for peer comparison: ").strip()
                student = json.loads(student_raw)
                comparison = analyzer.peer_comparison(student, students_cache)
                print(json.dumps(comparison, indent=2))

            elif choice == "11":
                if not students_cache:
                    print("No student cache loaded.")
                    continue
                one = students_cache[0]
                print("Radar:", analyzer.generate_radar_chart(one))
                print("Distribution:", analyzer.class_distribution_plot(students_cache))
                print("Scatter:", analyzer.attendance_marks_scatter(students_cache))

            elif choice == "12":
                action = input("Type save/load/export: ").strip().lower()
                if action == "save":
                    print(analyzer.save_model("models/performance_model.joblib"))
                elif action == "load":
                    print(analyzer.load_model("models/performance_model.joblib"))
                elif action == "export":
                    print(analyzer.export_report({"metrics": analyzer.metrics}, "outputs/model_report.json"))
                else:
                    print("Invalid action")

            else:
                print("Invalid option.")

        except Exception as exc:
            print(f"Error: {exc}")


if __name__ == "__main__":
    run_menu()
