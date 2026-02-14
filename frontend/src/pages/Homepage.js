
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const Homepage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Carousel slides data
  const carouselSlides = [
    {
      id: 1,
      title: "Smart Campus Management",
      description: "AI-powered platform for seamless academic operations and student performance analytics",
      image: "🎓",
      bgColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    },
    {
      id: 2,
      title: "Performance Predictions",
      description: "Machine Learning insights to help students improve their academic performance",
      image: "🤖",
      bgColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
    },
    {
      id: 3,
      title: "Faculty Collaboration",
      description: "Streamlined communication between faculty, students, and administration",
      image: "👨‍🏫",
      bgColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
    }
  ];

  // Faculty data
  const facultyMembers = [
    {
      id: 1,
      name: "Dr. Sunil Kumar",
      department: "Computer Science",
      designation: "Professor & HOD",
      email: "sunil.kumar@college.edu",
      photo: "👨‍💼",
      expertise: ["AI/ML", "Data Structures", "Algorithms"]
    },
    {
      id: 2,
      name: "Prof. Meera Desai",
      department: "Computer Science",
      designation: "Associate Professor",
      email: "meera.desai@college.edu",
      photo: "👩‍🏫",
      expertise: ["Database Systems", "Web Technologies"]
    },
    {
      id: 3,
      name: "Dr. Rajesh Patel",
      department: "Information Technology",
      designation: "Professor",
      email: "rajesh.patel@college.edu",
      photo: "👨‍🔬",
      expertise: ["Networking", "Cyber Security"]
    },
    {
      id: 4,
      name: "Prof. Anjali Sharma",
      department: "Computer Science",
      designation: "Assistant Professor",
      email: "anjali.sharma@college.edu",
      photo: "👩‍💻",
      expertise: ["Mobile Computing", "UI/UX Design"]
    },
    {
      id: 5,
      name: "Dr. Vikram Singh",
      department: "Information Technology",
      designation: "Associate Professor",
      email: "vikram.singh@college.edu",
      photo: "👨‍🎓",
      expertise: ["Cloud Computing", "Big Data"]
    },
    {
      id: 6,
      name: "Prof. Neha Gupta",
      department: "Computer Science",
      designation: "Assistant Professor",
      email: "neha.gupta@college.edu",
      photo: "👩‍🔧",
      expertise: ["Software Engineering", "Project Management"]
    }
  ];

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleGetStarted = () => {
    if (user) {
      switch(user.role) {
        case 'student':
          navigate('/student');
          break;
        case 'faculty':
          navigate('/faculty');
          break;
        case 'admin':
          navigate('/admin');
          break;
        default:
          navigate('/login');
      }
    } else {
      navigate('/login');
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignUp = () => {
    // For now, redirect to login. Can create separate signup page later
    navigate('/login');
  };

  return (
    <div className="homepage">
      {/* Header Navigation Bar */}
      <header className="header">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-icon">🎓</div>
            <div className="logo-text">
              <h2>Campus Connect</h2>
              <span>Smart College Management</span>
            </div>
          </div>
          
          <nav className="nav-menu">
            <a href="#home" className="nav-link active">Home</a>
            <a href="#features" className="nav-link">Features</a>
            <a href="#faculty" className="nav-link">Faculty</a>
            <a href="#about" className="nav-link">About</a>
          </nav>

          <div className="nav-actions">
            {user ? (
              <div className="user-section">
                <span className="welcome-text">Welcome, {user.username}</span>
                <button onClick={handleGetStarted} className="nav-btn primary">
                  Dashboard
                </button>
                <button onClick={logout} className="nav-btn secondary">
                  Logout
                </button>
              </div>
            ) : (
              <div className="auth-section">
                <button onClick={handleLogin} className="nav-btn secondary">
                  Login
                </button>
                <button onClick={handleSignUp} className="nav-btn primary">
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Carousel/Banner Section */}
        <section id="home" className="carousel-section">
          <div className="carousel-container">
            {carouselSlides.map((slide, index) => (
              <div
                key={slide.id}
                className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
                style={{ background: slide.bgColor }}
              >
                <div className="carousel-content">
                  <div className="slide-icon">{slide.image}</div>
                  <h1 className="slide-title">{slide.title}</h1>
                  <p className="slide-description">{slide.description}</p>
                  <button onClick={handleGetStarted} className="cta-button">
                    Get Started
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Carousel Indicators */}
          <div className="carousel-indicators">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </section>

        {/* Login/Signup Section */}
        <section className="auth-section-main">
          <div className="container">
            <div className="auth-container">
              <div className="auth-content">
                <h2>Join Campus Connect Today</h2>
                <p>Experience the future of campus management with AI-powered insights and seamless operations.</p>
                
                <div className="auth-features">
                  <div className="feature-item">
                    <span className="feature-icon">🎯</span>
                    <div>
                      <h4>Smart Predictions</h4>
                      <p>AI-driven performance analytics</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <div>
                      <h4>Real-time Analytics</h4>
                      <p>Live data and insights</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon">🔒</span>
                    <div>
                      <h4>Secure & Reliable</h4>
                      <p>Enterprise-grade security</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="auth-actions">
                <div className="auth-card">
                  <h3>Ready to Get Started?</h3>
                  <p>Choose your role and join our smart campus community</p>
                  
                  <div className="role-buttons">
                    <button onClick={handleLogin} className="role-btn student">
                      <span className="role-icon">🎒</span>
                      <div>
                        <strong>Student Login</strong>
                        <span>Access your dashboard</span>
                      </div>
                    </button>
                    
                    <button onClick={handleLogin} className="role-btn faculty">
                      <span className="role-icon">👨‍🏫</span>
                      <div>
                        <strong>Faculty Login</strong>
                        <span>Manage your classes</span>
                      </div>
                    </button>
                    
                    <button onClick={handleLogin} className="role-btn admin">
                      <span className="role-icon">⚙️</span>
                      <div>
                        <strong>Admin Login</strong>
                        <span>System management</span>
                      </div>
                    </button>
                  </div>

                  <div className="demo-accounts">
                    <h4>Demo Accounts:</h4>
                    <div className="demo-list">
                      <div><strong>Student:</strong> student123 / password123</div>
                      <div><strong>Faculty:</strong> faculty123 / password123</div>
                      <div><strong>Admin:</strong> admin123 / password123</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Faculty Information Section */}
        <section id="faculty" className="faculty-section">
          <div className="container">
            <div className="section-header">
              <h2>Meet Our Faculty</h2>
              <p>Dedicated professionals committed to academic excellence</p>
            </div>
            
            <div className="faculty-grid">
              {facultyMembers.map((faculty) => (
                <div key={faculty.id} className="faculty-card">
                  <div className="faculty-photo">
                    <div className="photo-placeholder">
                      {faculty.photo}
                    </div>
                  </div>
                  
                  <div className="faculty-info">
                    <h3 className="faculty-name">{faculty.name}</h3>
                    <p className="faculty-designation">{faculty.designation}</p>
                    <p className="faculty-department">{faculty.department}</p>
                    <p className="faculty-email">{faculty.email}</p>
                    
                    <div className="faculty-expertise">
                      <h4>Areas of Expertise:</h4>
                      <div className="expertise-tags">
                        {faculty.expertise.map((skill, index) => (
                          <span key={index} className="expertise-tag">{skill}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="features-section">
          <div className="container">
            <div className="section-header">
              <h2>Why Choose Campus Connect?</h2>
              <p>Comprehensive features designed for modern educational institutions</p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🤖</div>
                <h3>AI Performance Predictions</h3>
                <p>Machine Learning algorithms analyze student data to predict academic performance and provide personalized insights.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">📊</div>
                <h3>Real-time Analytics</h3>
                <p>Comprehensive dashboards with live data visualization for attendance, results, and institutional analytics.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h3>Role-based Access</h3>
                <p>Separate interfaces for Students, Faculty, and Admin with customized features and permissions.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">📱</div>
                <h3>Mobile Responsive</h3>
                <p>Fully responsive design that works seamlessly across all devices - desktop, tablet, and mobile.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">🔒</div>
                <h3>Secure & Scalable</h3>
                <p>Enterprise-grade security with JWT authentication and scalable architecture for growing institutions.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">💼</div>
                <h3>Placement Management</h3>
                <p>Track placement activities, company interactions, and student placement status efficiently.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer Section */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <div className="footer-logo">
                <div className="logo-icon">🎓</div>
                <div className="logo-text">
                  <h3>Campus Connect</h3>
                  <span>Smart College Management System</span>
                </div>
              </div>
              <p>Transforming educational institutions with AI-powered campus management solutions.</p>
            </div>
            
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#faculty">Faculty</a></li>
                <li><a href="#about">About</a></li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Contact Info</h4>
              <ul>
                <li>📧 info@campusconnect.edu</li>
                <li>📞 +1 (555) 123-4567</li>
                <li>🏢 123 College Avenue, Campus City</li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Connect With Us</h4>
              <div className="social-links">
                <a href="#" className="social-link">📘</a>
                <a href="#" className="social-link">🐦</a>
                <a href="#" className="social-link">📷</a>
                <a href="#" className="social-link">💼</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>&copy; 2024 Campus Connect. All rights reserved. | Final Year Project</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
