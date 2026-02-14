# Manual Update Required for AdminDashboard.js

## Instructions
The following change needs to be made to `frontend/src/pages/AdminDashboard.js` at line 2283-2288:

### Current Code:
```javascript
const navigation = [
  { path: '/admin', label: '📊 Dashboard', component: DashboardOverview },
  { path: '/admin/data', label: '📊 Data Display', component: DataManagement },
  { path: '/admin/ml', label: '🤖 ML Model', component: MLModelControl },
  { path: '/admin/users', label: '👥 User Management', component: UserManagement },
];
```

### Replace With:
```javascript
const navigation = [
  { path: '/admin', label: '📊 Dashboard', component: DashboardOverview },
  { path: '/admin/data', label: '📊 Data Display', component: DataDisplay },
  { path: '/admin/manage', label: '💾 Data Management', component: DataManagement },
  { path: '/admin/ml', label: '🤖 ML Model', component: MLModelControl },
  { path: '/admin/users', label: '👥 User Management', component: UserManagement },
];
```

## What Changed:
1. Changed `/admin/data` component from `DataManagement` to `DataDisplay`
2. Added new route `/admin/manage` with `DataManagement` component
3. Added import for `DataDisplay` component at the top of the file

## Files Created:
- `frontend/src/pages/DataDisplay.js` - New component for viewing data with search, filter, and export

## Files Modified:
- `frontend/src/pages/AdminDashboard.js` - Updated section header for DataManagement, needs navigation array update
- `frontend/src/pages/AdminDashboard.css` - Added pagination and data management styles
