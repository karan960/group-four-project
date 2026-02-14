"""
Sample Data Generator for ML Model Testing
Generates realistic student data for testing the performance analysis model
"""

import json
import random
from datetime import datetime, timedelta

class SampleDataGenerator:
    """Generate sample student data for testing"""
    
    def __init__(self):
        self.subjects = [
            "Data Structures",
            "Database Management",
            "Web Development",
            "Operating Systems",
            "Computer Networks",
            "Software Engineering",
            "Algorithms",
            "Discrete Mathematics",
            "Object Oriented Programming",
            "Cloud Computing"
        ]
        
        self.years = ["First", "Second", "Third", "Fourth"]
        self.branches = ["Computer Science", "IT", "Electronics", "Mechanical"]
        self.divisions = ["A", "B", "C", "D"]
        self.grades = ["A+", "A", "B+", "B", "C+", "C", "D", "F"]
    
    def generate_semester_marks(self, num_semesters=4):
        """Generate semester marks data"""
        semester_marks = []
        
        for sem_num in range(1, num_semesters + 1):
            year_num = (sem_num - 1) // 2 + 1
            year = self.years[year_num - 1] if year_num <= len(self.years) else "Fourth"
            
            subjects = random.sample(self.subjects, 5)
            subject_list = []
            total_sgpa = 0
            total_credits = 0
            
            for subject in subjects:
                internal = random.randint(20, 40)
                external = random.randint(40, 100)
                total = internal + external
                credits = random.choice([3, 4])
                grade = self._calculate_grade(total)
                
                subject_list.append({
                    "subjectCode": f"CS{sem_num}{len(subject_list)+1}01",
                    "subjectName": subject,
                    "internalMarks": internal,
                    "externalMarks": external,
                    "totalMarks": total,
                    "credits": credits,
                    "grade": grade
                })
                
                total_sgpa += self._grade_to_points(grade)
                total_credits += credits
            
            sgpa = total_sgpa / len(subjects) if subjects else 0
            
            semester_marks.append({
                "year": year,
                "semester": sem_num,
                "academicYear": f"{2023 + (sem_num - 1) // 2}-{2024 + (sem_num - 1) // 2}",
                "internalTotal": sum([s["internalMarks"] for s in subject_list]),
                "externalTotal": sum([s["externalMarks"] for s in subject_list]),
                "cgpa": sgpa,
                "subjects": subject_list,
                "sgpa": sgpa,
                "totalCredits": total_credits,
                "status": "Pass" if sgpa >= 5 else "ATKT"
            })
        
        return semester_marks
    
    def generate_attendance(self, num_months=8):
        """Generate attendance data"""
        attendance_records = []
        
        for month_num in range(1, num_months + 1):
            month_names = ["January", "February", "March", "April", "May", "June", 
                          "July", "August", "September", "October", "November", "December"]
            month = month_names[month_num - 1]
            
            subjects = random.sample(self.subjects, 5)
            subject_attendance = []
            overall_attendance = 0
            
            for subject in subjects:
                total_classes = random.randint(15, 30)
                attended = random.randint(int(total_classes * 0.60), total_classes)
                percentage = (attended / total_classes) * 100
                
                subject_attendance.append({
                    "subjectName": subject,
                    "totalClasses": total_classes,
                    "attendedClasses": attended,
                    "percentage": percentage
                })
            
            overall_attendance = sum([s["percentage"] for s in subject_attendance]) / len(subject_attendance)
            
            attendance_records.append({
                "month": month,
                "year": 2024,
                "subjects": subject_attendance,
                "overallPercentage": overall_attendance
            })
        
        return attendance_records
    
    def generate_student(self, prn=None, roll_no=None):
        """Generate a complete student record"""
        
        if not prn:
            prn = f"PRN{random.randint(100000, 999999)}"
        if not roll_no:
            roll_no = f"{random.randint(1, 100)}"
        
        year = random.choice(self.years)
        branch = random.choice(self.branches)
        division = random.choice(self.divisions)
        
        # Generate semester marks
        year_num = self.years.index(year) + 1
        num_semesters = (year_num - 1) * 2 + random.randint(1, 2)
        semester_marks = self.generate_semester_marks(num_semesters)
        
        # Calculate overall CGPA
        cgpas = [s["cgpa"] for s in semester_marks]
        overall_cgpa = sum(cgpas) / len(cgpas) if cgpas else 0
        
        # Generate attendance
        attendance = self.generate_attendance()
        overall_attendance = sum([a["overallPercentage"] for a in attendance]) / len(attendance)
        
        # Generate backlogs
        backlogs = sum([1 for s in semester_marks if s["status"] == "ATKT"])
        
        student = {
            "prn": prn,
            "rollNo": roll_no,
            "studentName": self._generate_name(),
            "year": year,
            "branch": branch,
            "division": division,
            "email": f"{prn.lower()}@student.edu",
            "mobileNo": f"9{random.randint(100000000, 999999999)}",
            "cgpa": round(overall_cgpa, 2),
            "semesterMarks": semester_marks,
            "attendance": attendance,
            "overallAttendance": round(overall_attendance, 2),
            "backlogs": backlogs,
            "currentSemester": num_semesters + 1,
            "admissionYear": 2023 - (year_num - 1),
            "placementStatus": "Not Eligible" if overall_cgpa < 6 else "Eligible",
            "isActive": True
        }
        
        return student
    
    def generate_multiple_students(self, count=10):
        """Generate multiple student records"""
        students = []
        for i in range(count):
            student = self.generate_student(
                prn=f"PRN{100000 + i}",
                roll_no=str(i + 1)
            )
            students.append(student)
        return students
    
    def _calculate_grade(self, total_marks):
        """Calculate grade based on total marks"""
        if total_marks >= 90:
            return "A+"
        elif total_marks >= 80:
            return "A"
        elif total_marks >= 70:
            return "B+"
        elif total_marks >= 60:
            return "B"
        elif total_marks >= 50:
            return "C+"
        elif total_marks >= 40:
            return "C"
        elif total_marks >= 30:
            return "D"
        else:
            return "F"
    
    def _grade_to_points(self, grade):
        """Convert grade to grade points"""
        grade_points = {
            "A+": 10, "A": 9, "B+": 8, "B": 7,
            "C+": 6, "C": 5, "D": 4, "F": 0
        }
        return grade_points.get(grade, 0)
    
    def _generate_name(self):
        """Generate random student name"""
        first_names = [
            "Abhishek", "Priya", "Rajesh", "Sneha", "Arjun",
            "Deepika", "Vikram", "Anjali", "Karan", "Pooja",
            "Amit", "Divya", "Sandeep", "Neha", "Rohan"
        ]
        last_names = [
            "Sharma", "Singh", "Patel", "Kumar", "Gupta",
            "Verma", "Reddy", "Desai", "Chopra", "Iyer"
        ]
        return f"{random.choice(first_names)} {random.choice(last_names)}"


def generate_test_data():
    """Generate and print test data"""
    
    generator = SampleDataGenerator()
    
    print("\n" + "="*60)
    print("SAMPLE DATA GENERATION FOR ML MODEL TESTING")
    print("="*60 + "\n")
    
    # Generate single student
    print("📊 SINGLE STUDENT DATA:")
    print("-" * 60)
    student = generator.generate_student()
    print(json.dumps(student, indent=2, default=str))
    
    # Generate multiple students for class analysis
    print("\n\n📊 CLASS DATA (10 STUDENTS):")
    print("-" * 60)
    students = generator.generate_multiple_students(10)
    
    class_data = {
        "year": "Second",
        "branch": "Computer Science",
        "division": "A",
        "students": students
    }
    
    print(f"Total Students: {len(students)}")
    print(f"\nClass Info: {class_data['year']} Year, {class_data['branch']}, Division {class_data['division']}")
    
    # Display summary
    print("\n📈 SAMPLE DATA SUMMARY:")
    print("-" * 60)
    
    for idx, student in enumerate(students, 1):
        print(f"\n{idx}. {student['studentName']} (PRN: {student['prn']})")
        print(f"   CGPA: {student['cgpa']}")
        print(f"   Attendance: {student['overallAttendance']}%")
        print(f"   Backlogs: {student['backlogs']}")
        print(f"   Status: {student['placementStatus']}")
    
    # Save to file
    output_file = "sample_test_data.json"
    with open(output_file, 'w') as f:
        json.dump(class_data, f, indent=2, default=str)
    
    print("\n\n✅ Sample data saved to 'sample_test_data.json'")
    print("="*60 + "\n")


if __name__ == "__main__":
    generate_test_data()
