# Campus Connect - Group Four Project

A comprehensive campus management system built with MERN stack and Machine Learning capabilities.

## Project Overview

Campus Connect is a full-stack web application designed to streamline campus operations, including student management, faculty coordination, course management, and performance analytics powered by machine learning.

## Technology Stack

### Frontend
- **React.js** - User interface framework
- **React Context API** - State management
- **CSS3** - Styling and theming

### Backend
- **Node.js & Express.js** - Server framework
- **MongoDB** - Database
- **JWT** - Authentication

### ML API
- **Python & Flask** - ML API server
- **Scikit-learn** - Machine learning models
- **Pandas & NumPy** - Data processing

## Project Structure

```
campus-connect/
├── backend/          # Node.js/Express backend server
├── frontend/         # React frontend application
├── ml-api/           # Python ML API for performance analytics
└── files/            # Documentation and guides
```

## Features

- **User Authentication** - Secure login system with role-based access (Admin, Faculty, Student)
- **Dashboard Management** - Customized dashboards for different user roles
- **Course Management** - Create, update, and manage courses
- **Assignment System** - Assignment creation, submission, and grading
- **Notification Center** - Real-time notifications
- **Database Management** - Admin tools for data management
- **Performance Analytics** - ML-powered student performance prediction
- **Theme Toggle** - Light/Dark mode support

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- Python 3.8+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/group-four-project.git
   cd campus-connect
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   # Create .env file with your MongoDB URI and JWT secret
   npm start
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

4. **ML API Setup**
   ```bash
   cd ml-api
   pip install -r requirements.txt
   python app.py
   ```

### Environment Variables

Create a `.env` file in the backend directory:
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

## Team Members

- Team Member 1
- Team Member 2
- Team Member 3
- Team Member 4

## Documentation

Detailed documentation can be found in the `/files` directory:
- [Quick Start Guide](files/QUICK_START_GUIDE.md)
- [Backend Setup](files/BACKEND_SETUP.md)
- [ML Model Documentation](files/ML_MODEL_DOCUMENTATION_INDEX.md)

## License

This project is developed as part of a final year academic project.

## Contributing

This is a group project. All team members should follow the established coding standards and contribution guidelines.
