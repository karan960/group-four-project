# Quick Reference - Data Display & Management

## Navigation Menu
```
Admin Dashboard
├── 📊 Dashboard          (/admin)
├── 📊 Data Display       (/admin/data)
├── 💾 Data Management    (/admin/manage)
├── 🤖 ML Model          (/admin/ml)
└── 👥 User Management   (/admin/users)
```

## Data Display (/admin/data)
**What**: View all system data with search and export
**For**: Browsing student records, faculty info, marks, attendance
**Features**: Search, Filter, Export CSV, Pagination, Statistics

### Data Types
| Type | Columns | Purpose |
|------|---------|---------|
| Students | 9 | View all student information |
| Faculty | 8 | View all faculty information |
| Marks | 9 | View all marks records |
| Attendance | 9 | View all attendance records |

### Quick Actions
- **Search**: Type name/PRN/email
- **Export**: Download as CSV
- **Refresh**: Reload data
- **Paginate**: Navigate pages

## Data Management (/admin/manage)
**What**: Upload, create, edit, and delete records
**For**: Bulk data imports, individual record management
**Features**: Upload, CRUD, Quick Actions, Bulk Operations

### Upload Types
- Students Data
- Faculty Data
- Marks Data
- Attendance Data

### Quick Actions
- 📊 Generate Reports
- 📧 Send Announcements
- 🔍 System Audit
- 📁 Backup Data

## Keyboard Shortcuts
(To be implemented)
- `Ctrl+F` - Focus search box
- `Ctrl+E` - Export data
- `Ctrl+R` - Refresh data

## Common Tasks

### Find a Student
1. Go to Data Display
2. Select "Students Data"
3. Type name/PRN in search
4. Review results

### Export Student List
1. Go to Data Display
2. Select "Students Data"
3. (Optional) Use search to filter
4. Click "Export CSV"
5. File downloads automatically

### Upload Student Marks
1. Go to Data Management
2. Select "Marks Data" from dropdown
3. Choose Excel file
4. Click Upload
5. Wait for confirmation

### Edit Faculty Record
1. Go to Data Management
2. Select "Faculty Data" from dropdown
3. Click Edit on desired row
4. Modify fields
5. Click Update

## File Sizes & Performance

| Data Type | ~Typical Size | Load Time |
|-----------|---------------|-----------|
| Students (100) | 50KB | <1s |
| Faculty (50) | 20KB | <1s |
| Marks (1000) | 200KB | 1-2s |
| Attendance (500) | 100KB | 1s |

## Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| No data to export | Empty filtered results | Adjust search filter |
| Failed to fetch | API unavailable | Check backend server |
| Missing PRN | Required field missing | Verify Excel format |
| Student not found | PRN doesn't exist | Check Excel data |

## Filtering Examples

### Students
- By Year: "First", "Second", "Third", "Fourth"
- By Search: Name, PRN, Email

### Faculty
- By Search: Name, Faculty ID, Email

### Marks
- By Search: Student name, Subject, PRN

### Attendance
- By Search: Student name, Subject, Month

## CSV Export Format

**File Naming**: `{type}_data_{timestamp}.csv`
**Example**: `students_data_1673251200.csv`

**Columns Included**: All visible table columns
**Data Format**: Comma-separated
**Encoding**: UTF-8

## Pagination Info

- **Items Per Page**: 20
- **Navigation**: Previous/Next buttons
- **Page Display**: Shows "Page X of Y"
- **Disabled State**: At boundary pages

## Statistics Card Info

Shows:
- Total Records (filtered)
- Current Page
- Items Shown

## Mobile Viewing

- Horizontal scroll for tables
- Full-width controls
- Stacked layout
- Touch-optimized buttons

## Troubleshooting

### Data Not Loading
1. Refresh the page
2. Check internet connection
3. Verify backend is running
4. Check browser console for errors

### Search Not Working
1. Ensure data is loaded
2. Check spelling
3. Clear search and retry
4. Try different search term

### Export Failing
1. Check if data exists
2. Try filtering with fewer results
3. Check browser download settings
4. Ensure sufficient disk space

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE: ❌ Not supported

## Contact Support
For issues or feature requests, contact admin panel support.
