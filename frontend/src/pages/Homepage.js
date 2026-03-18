
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  FaGraduationCap, FaCog, FaBolt, FaChartLine, FaGem, FaUsers, FaEnvelope,
  FaBullseye, FaUserGraduate, FaMobileAlt, FaBriefcase, FaPhone, FaBuilding, 
  FaFacebook, FaTwitter, FaInstagram, FaLinkedin, FaStar, FaAward, FaCertificate,
  FaUser
} from 'react-icons/fa';
import './Homepage.css';
import LogoImage from '../styles/Logo.png';
import CarouselImg1 from '../styles/unnamed (1).jpg';
import CarouselImg2 from '../styles/unnamed (2).jpg';
import CarouselImg3 from '../styles/unnamed (6).jpg';
// Faculty images
import SunilKumarImg from '../styles/sunil kumar.png';
import MeeraDesaiImg from '../styles/meera desai.png';
import RajeshPatelImg from '../styles/rajesh Patel.png';
import AnjaliSharmaImg from '../styles/anjali sharama.png';
import VikramSinghImg from '../styles/vikram sing.png';
import NehaGuptaImg from '../styles/neha gupta.png';

const Homepage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const analyticsRef = useRef(null);
  const [analyticsStarted, setAnalyticsStarted] = useState(false);
  const [metrics, setMetrics] = useState({
    predictionAccuracy: 0,
    activeInsights: 0,
    connectedUsers: 0,
    placementAssists: 0
  });

  const particleNodes = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        left: `${(i * 17) % 100}%`,
        top: `${(i * 29) % 100}%`,
        delay: `${(i % 9) * 0.6}s`,
        duration: `${10 + (i % 8)}s`
      })),
    []
  );

  // Carousel slides data
  const carouselSlides = [
    {
      id: 1,
      title: "Smart Campus Management",
      description: "AI-powered platform for seamless academic operations and student performance analytics",
      image: CarouselImg1
    },
    {
      id: 2,
      title: "Performance Predictions",
      description: "Machine Learning insights to help students improve their academic performance",
      image: CarouselImg2
    },
    {
      id: 3,
      title: "Faculty Collaboration",
      description: "Streamlined communication between faculty, students, and administration",
      image: CarouselImg3
    }
  ];

  // Helper function to render faculty icon
  const renderFacultyIcon = (iconName) => {
    switch(iconName) {
      case 'star': return <FaStar />;
      case 'bolt': return <FaBolt />;
      case 'gem': return <FaGem />;
      case 'award': return <FaAward />;
      case 'certificate': return <FaCertificate />;
      case 'cog': return <FaCog />;
      default: return <FaUser />;
    }
  };

  // Faculty data
  const facultyMembers = [
    {
      id: 1,
      name: "Dr. Sunil Kumar",
      department: "Computer Science",
      designation: "Professor & HOD",
      email: "sunil.kumar@college.edu",
      photo: SunilKumarImg,
      expertise: ["AI/ML", "Data Structures", "Algorithms"]
    },
    {
      id: 2,
      name: "Prof. Meera Desai",
      department: "Computer Science",
      designation: "Associate Professor",
      email: "meera.desai@college.edu",
      photo: MeeraDesaiImg,
      expertise: ["Database Systems", "Web Technologies"]
    },
    {
      id: 3,
      name: "Dr. Rajesh Patel",
      department: "Information Technology",
      designation: "Professor",
      email: "rajesh.patel@college.edu",
      photo: RajeshPatelImg,
      expertise: ["Networking", "Cyber Security"]
    },
    {
      id: 4,
      name: "Prof. Anjali Sharma",
      department: "Computer Science",
      designation: "Assistant Professor",
      email: "anjali.sharma@college.edu",
      photo: AnjaliSharmaImg,
      expertise: ["Mobile Computing", "UI/UX Design"]
    },
    {
      id: 5,
      name: "Dr. Vikram Singh",
      department: "Information Technology",
      designation: "Associate Professor",
      email: "vikram.singh@college.edu",
      photo: VikramSinghImg,
      expertise: ["Cloud Computing", "Big Data"]
    },
    {
      id: 6,
      name: "Prof. Neha Gupta",
      department: "Computer Science",
      designation: "Assistant Professor",
      email: "neha.gupta@college.edu",
      photo: NehaGuptaImg,
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

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';

    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnalyticsStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );

    if (analyticsRef.current) {
      observer.observe(analyticsRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!analyticsStarted) return;

    const targets = {
      predictionAccuracy: 96,
      activeInsights: 1240,
      connectedUsers: 18200,
      placementAssists: 412
    };

    const duration = 1500;
    const start = performance.now();
    let rafId;

    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setMetrics({
        predictionAccuracy: Math.round(targets.predictionAccuracy * eased),
        activeInsights: Math.round(targets.activeInsights * eased),
        connectedUsers: Math.round(targets.connectedUsers * eased),
        placementAssists: Math.round(targets.placementAssists * eased)
      });

      if (progress < 1) {
        rafId = window.requestAnimationFrame(animate);
      }
    };

    rafId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(rafId);
  }, [analyticsStarted]);

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
      <div className="particle-network" aria-hidden="true">
        {particleNodes.map((node) => (
          <span
            key={node.id}
            className="particle-node"
            style={{
              left: node.left,
              top: node.top,
              animationDelay: node.delay,
              animationDuration: node.duration
            }}
          />
        ))}
      </div>

      {/* Header Navigation Bar */}
      <header className="header">
        <div className="nav-container">
          <div className="logo">
            <div className="logo-icon">
              <img src={LogoImage} alt="Campus Connect Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
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
              >
                <img src={slide.image} alt={slide.title} className="carousel-image" />
                <div className="carousel-overlay"></div>
                <div className="carousel-content">
                  <div className="hero-glass-card">
                    <h1 className="slide-title">{slide.title}</h1>
                    <p className="slide-description">{slide.description}</p>
                    <button onClick={handleGetStarted} className="cta-button">
                      Get Started
                    </button>
                  </div>
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

        <section className="analytics-section" ref={analyticsRef}>
          <div className="container">
            <div className="section-header">
              <h2>Real-time Intelligence Grid</h2>
              <p>Live institutional signals powered by predictive models and secure data pipelines.</p>
            </div>
            <div className="analytics-grid">
              <article className="analytics-card glass-card">
                <h3>Prediction Accuracy</h3>
                <p className="metric-figure">{metrics.predictionAccuracy}%</p>
              </article>
              <article className="analytics-card glass-card">
                <h3>Active Insights</h3>
                <p className="metric-figure">{metrics.activeInsights.toLocaleString()}</p>
              </article>
              <article className="analytics-card glass-card">
                <h3>Connected Users</h3>
                <p className="metric-figure">{metrics.connectedUsers.toLocaleString()}</p>
              </article>
              <article className="analytics-card glass-card">
                <h3>Placement Assists</h3>
                <p className="metric-figure">{metrics.placementAssists.toLocaleString()}</p>
              </article>
            </div>
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
                    <span className="feature-icon"><FaBullseye /></span>
                    <div>
                      <h4>Smart Predictions</h4>
                      <p>AI-driven performance analytics</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon"><FaChartLine /></span>
                    <div>
                      <h4>Real-time Analytics</h4>
                      <p>Live data and insights</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <span className="feature-icon"><FaGem /></span>
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
                      <span className="role-icon"><FaUserGraduate /></span>
                      <div>
                        <strong>Student Login</strong>
                        <span>Access your dashboard</span>
                      </div>
                    </button>
                    
                    <button onClick={handleLogin} className="role-btn faculty">
                      <span className="role-icon"><FaBolt /></span>
                      <div>
                        <strong>Faculty Login</strong>
                        <span>Manage your classes</span>
                      </div>
                    </button>
                    
                    <button onClick={handleLogin} className="role-btn admin">
                      <span className="role-icon"><FaCog /></span>
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
              {facultyMembers.map((faculty, index) => (
                <div key={faculty.id} className="faculty-card" style={{ '--stagger-index': index }}>
                  <div className="faculty-photo">
                    <img src={faculty.photo} alt={faculty.name} className="faculty-img" />
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
                <div className="feature-icon"><FaCog /></div>
                <h3>AI Performance Predictions</h3>
                <p>Machine Learning algorithms analyze student data to predict academic performance and provide personalized insights.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon"><FaChartLine /></div>
                <h3>Real-time Analytics</h3>
                <p>Comprehensive dashboards with live data visualization for attendance, results, and institutional analytics.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon"><FaUsers /></div>
                <h3>Role-based Access</h3>
                <p>Separate interfaces for Students, Faculty, and Admin with customized features and permissions.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon"><FaMobileAlt /></div>
                <h3>Mobile Responsive</h3>
                <p>Fully responsive design that works seamlessly across all devices - desktop, tablet, and mobile.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon"><FaGem /></div>
                <h3>Secure & Scalable</h3>
                <p>Enterprise-grade security with JWT authentication and scalable architecture for growing institutions.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon"><FaBriefcase /></div>
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
                <div className="logo-icon">
                  <img src={LogoImage} alt="Campus Connect Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
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
                <li><FaEnvelope /> info@campusconnect.edu</li>
                <li><FaPhone /> +1 (555) 123-4567</li>
                <li><FaBuilding /> 123 College Avenue, Campus City</li>
              </ul>
            </div>
            
            <div className="footer-section">
              <h4>Connect With Us</h4>
              <div className="social-links">
                <a href="#" className="social-link"><FaFacebook /></a>
                <a href="#" className="social-link"><FaTwitter /></a>
                <a href="#" className="social-link"><FaInstagram /></a>
                <a href="#" className="social-link"><FaLinkedin /></a>
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
