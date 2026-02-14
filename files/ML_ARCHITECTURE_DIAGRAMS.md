# ML Model Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────┤
│  StudentDashboard.js │ FacultyDashboard.js │ AdminDashboard.js  │
└──────────┬───────────┴──────────┬──────────┴────────┬───────────┘
           │                      │                    │
           │                      ▼                    │
           │        ┌──────────────────────────┐      │
           │        │   Backend API Server     │      │
           │        │   (Node.js/Express)      │      │
           └────────┤  Port: 5000              │◄─────┘
                    │                          │
                    │ mlAnalysisRoutes.js      │
                    └────────┬─────────────────┘
                             │
                             ▼ (HTTP/JSON)
                    ┌──────────────────────────┐
                    │  MongoDB Database        │
                    │  (Student/Faculty Data)  │
                    └──────────────────────────┘
                             ▲
                             │ (Query)
                             │
                    ┌────────┴──────────────────┐
                    │                           │
                    ▼                           ▼
         ┌──────────────────────┐     ┌──────────────────────┐
         │  ML API Server       │     │  ML Analysis         │
         │  (Flask/Python)      │     │  Engine              │
         │  Port: 5001          │     │                      │
         │                      │     │ performance_model.py │
         │ performance_routes.py│────▶│                      │
         └──────────────────────┘     │ • Calculate Score    │
                                      │ • Risk Assessment    │
                                      │ • Recommendations    │
                                      │ • Placement Prob     │
                                      └──────────────────────┘
```

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUDENT DATA INPUT                            │
│  • CGPA (0-10)                                                  │
│  • Semester Marks (subjects, grades)                            │
│  • Attendance (% per subject)                                   │
│  • Backlogs (count)                                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────┐
    │  StudentPerformanceModel       │
    │  calculate_individual_         │
    │  performance()                 │
    └────────┬───────────────────────┘
             │
             ├─────────────┬──────────────┬──────────────┬──────────────┐
             │             │              │              │              │
             ▼             ▼              ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ CGPA Score   │ │Attendance│ │ Subject  │ │Improvement│Consistency│
    │ (0-100)      │ │ Score    │ │Performance│ │Trend     │ Score    │
    │              │ │(0-100)   │ │Score     │ │(0-100)   │(0-100)   │
    │ Weight: 35%  │ │          │ │          │ │          │          │
    │              │ │Weight:25%│ │Weight:25%│ │Weight:10%│Weight:5% │
    └──────┬───────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘
           │              │            │            │            │
           └──────────────┴────────────┴────────────┴────────────┘
                                  │
                                  ▼
                     ┌──────────────────────────────┐
                     │  WEIGHTED CALCULATION        │
                     │  Overall Score =             │
                     │  (35% + 25% + 25% +         │
                     │   10% + 5%) × weights        │
                     │  Result: 0-100               │
                     └──────┬───────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Performance  │ │ Risk Level   │ │ Placement    │
    │ Category     │ │ Assessment   │ │ Probability  │
    │              │ │              │ │              │
    │ • Excellent  │ │ • Low Risk   │ │ • 0-100%     │
    │ • Very Good  │ │ • Medium Risk│ │ • Based on   │
    │ • Good       │ │ • High Risk  │ │   CGPA, Att, │
    │ • Average    │ │ • Critical   │ │   Backlogs   │
    │ • Below Avg  │ │              │ │              │
    └──────────────┘ └──────────────┘ └──────────────┘
            │               │               │
            └───────────────┴───────────────┘
                            │
                            ▼
                    ┌──────────────────────┐
                    │ RECOMMENDATIONS      │
                    │ (Personalized)       │
                    │ • Attendance focus   │
                    │ • Academic support   │
                    │ • Backlog clearing   │
                    │ • Risk mitigation    │
                    └──────────────────────┘
                            │
                            ▼
                    ┌──────────────────────┐
                    │ JSON RESPONSE        │
                    │ to Frontend          │
                    └──────────────────────┘
```

## Class-Level Analysis Flow

```
┌─────────────────────────────────────────┐
│  Query: All Students in Class           │
│  Year: "Second"                         │
│  Branch: "Computer Science"             │
│  Division: "A"                          │
└────────────────┬────────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────────────┐
    │ Fetch 60 Students from MongoDB          │
    └────────────────┬────────────────────────┘
                     │
        ┌────────────┴───────────┐
        │                        │
        ▼                        ▼
    ┌──────────────┐        ┌──────────────┐
    │ Student 1    │  ...   │ Student 60   │
    │ CGPA: 7.5    │        │ CGPA: 6.2    │
    │ Att: 85%     │        │ Att: 70%     │
    └──────┬───────┘        └──────┬───────┘
           │                       │
           └───────────┬───────────┘
                       │
                       ▼ (For each student)
            ┌────────────────────────────┐
            │ calculate_individual_      │
            │ performance()              │
            └────────┬───────────────────┘
                     │
        ┌────────────┴───────────┐
        │                        │
        ▼                        ▼
    ┌────────────────┐    ┌────────────────┐
    │ Perf: 82.45    │    │ Perf: 58.30    │
    │ Risk: Low      │    │ Risk: High     │
    └────────────────┘    └────────────────┘
        │                        │
        └───────────┬────────────┘
                    │
                    ▼
        ┌─────────────────────────────────┐
        │ Aggregate Statistics            │
        │ • Average CGPA: 6.8             │
        │ • Average Attendance: 82.5%     │
        │ • Distribution Analysis         │
        │ • Risk Distribution             │
        │ • Top/Bottom Performers         │
        └────────────────┬────────────────┘
                         │
                         ▼
            ┌──────────────────────────────┐
            │ Faculty Dashboard Data       │
            │ (JSON Response)              │
            └──────────────────────────────┘
```

## At-Risk Student Detection

```
┌──────────────────────────────────┐
│  Student Performance Analysis    │
├──────────────────────────────────┤
│  CGPA: 4.5                       │
│  Attendance: 65%                 │
│  Backlogs: 2                     │
└────────────┬─────────────────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Risk Calculation       │
    ├────────────────────────┤
    │ CGPA < 5: 40 pts      │
    │ Att < 70: 30 pts      │
    │ Backlogs > 2: 25 pts  │
    │ Trend: neutral        │
    │                       │
    │ Total: 95 pts        │
    └────────┬──────────────┘
             │
             ▼
    ┌──────────────────────┐
    │ CRITICAL RISK        │
    │ (Score >= 60)        │
    └────────┬─────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Recommendations Generated:   │
    │ • Seek academic counseling   │
    │ • Improve attendance         │
    │ • Clear 2 backlogs           │
    │ • Focus on studies           │
    └──────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────┐
    │ Faculty Notification         │
    │ (At-Risk Student Alert)      │
    └──────────────────────────────┘
```

## API Request/Response Flow

```
Frontend Request
        │
        ▼
┌───────────────────────────────┐
│ GET /api/ml-analysis/student/ │
│ :studentId                    │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ Backend Route Handler         │
│ mlAnalysisRoutes.js           │
└───────────┬───────────────────┘
            │ (Fetch student from DB)
            ▼
┌───────────────────────────────┐
│ MongoDB Query                 │
│ Student.findById()            │
└───────────┬───────────────────┘
            │ (Format data)
            ▼
┌───────────────────────────────┐
│ Format Student Data for ML    │
│ Model                         │
└───────────┬───────────────────┘
            │
            ▼ (HTTP POST)
┌───────────────────────────────┐
│ ML API Route                  │
│ /api/ml/performance/          │
│ individual/:student_id        │
└───────────┬───────────────────┘
            │
            ▼
┌───────────────────────────────┐
│ StudentPerformanceModel       │
│ .calculate_individual_        │
│ performance()                 │
└───────────┬───────────────────┘
            │ (Analysis complete)
            ▼
┌───────────────────────────────┐
│ JSON Response                 │
│ {                             │
│   performance: {...}          │
│   recommendations: [...]      │
│   risk_level: "Low Risk"      │
│ }                             │
└───────────┬───────────────────┘
            │ (Return to Backend)
            ▼
┌───────────────────────────────┐
│ Backend Passes Response        │
└───────────┬───────────────────┘
            │ (Return to Frontend)
            ▼
┌───────────────────────────────┐
│ Frontend Receives JSON        │
│ Updates Dashboard             │
│ Shows Performance Metrics     │
└───────────────────────────────┘
```

## Performance Score Calculation

```
┌──────────────────────────────────────┐
│ Individual Performance Components    │
├──────────────────────────────────────┤
│                                      │
│  CGPA Score             ▲            │
│  (CGPA/10) × 100        │ 35%       │
│  Example: 7.5 = 75      │ weight    │
│                         │            │
│  Attendance Score       │ 25%       │
│  Direct percentage      │ weight    │
│  Example: 85% = 85      │            │
│                         │ 25%       │
│  Subject Performance    │ weight    │
│  Average marks across   │            │
│  all subjects (0-100)   │ 10%       │
│                         │ weight    │
│  Improvement Trend      │            │
│  Semester-to-semester   │ 5%        │
│  progress (0-100)       │ weight    │
│                         │            │
│  Consistency Score      │            │
│  Variance in SGPA &     │            │
│  attendance (0-100)     │            │
│                         │            │
└──────────────────────────────────────┘
         │
         │ Weighted Sum
         ▼
┌──────────────────────────────┐
│ Overall Score = 0-100        │
│                              │
│ Score ≥ 85: Excellent       │
│ Score ≥ 75: Very Good       │
│ Score ≥ 65: Good            │
│ Score ≥ 50: Average         │
│ Score < 50: Below Average   │
└──────────────────────────────┘
```

## Risk Assessment Matrix

```
                        ATTENDANCE
                    ┌─────────┬─────────┬─────────┐
                    │  ≥ 80%  │ 75-80%  │ < 75%   │
        ┌───────────┼─────────┼─────────┼─────────┤
        │ ≥ 7.0     │   Low   │ Medium  │ Medium  │
C G P A │ 6.0-7.0   │ Medium  │ Medium  │  High   │
        │ 5.0-6.0   │ Medium  │  High   │  High   │
        │ < 5.0     │  High   │ Critical│Critical │
        └───────────┴─────────┴─────────┴─────────┘

Additional Factors:
  • Backlogs > 2 → +1 Risk Level
  • Declining Trend → +1 Risk Level
  • Low Consistency → +1 Risk Level
```

## Complete Workflow

```
STUDENT MARKS & ATTENDANCE DATA
            │
            ▼
    ┌──────────────┐
    │  ML MODEL    │ ─→ Analysis (< 100ms)
    │  (Python)    │
    └──────────────┘
            │
    ┌───────┴──────────┐
    │                  │
    ▼                  ▼
PERFORMANCE        RECOMMENDATIONS
METRICS
│                  │
├─ Score: 82.45   ├─ Maintain momentum
├─ Category:VG    ├─ Keep attending
├─ Risk: Low      ├─ Focus on weak subjects
└─ Placement:85%  └─ Continue improvement
    │                  │
    └───────┬──────────┘
            │
            ▼
    ┌──────────────────────┐
    │  JSON RESPONSE       │
    │  to Frontend/Backend │
    └──────────────────────┘
            │
    ┌───────┴──────────┐
    │                  │
    ▼                  ▼
STUDENT SEES        FACULTY SEES
- Performance       - Class Stats
- Recommendations   - At-Risk List
- Trend Analysis    - Distribution
- Improvements      - Top Performers
```

---

This architecture ensures:
✅ Real-time analysis
✅ Scalable processing
✅ Accurate predictions
✅ Actionable insights
✅ Easy frontend integration
