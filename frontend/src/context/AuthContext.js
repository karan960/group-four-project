

import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';

const AuthContext = createContext();
const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const activeVerifyRequestId = useRef(0);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToVerify) => {
    const requestId = ++activeVerifyRequestId.current;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${tokenToVerify}` }
      });

      if (requestId === activeVerifyRequestId.current) {
        setUser(response.data.user);
      }
    } catch (error) {
      if (requestId === activeVerifyRequestId.current) {
        sessionStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
    } finally {
      if (requestId === activeVerifyRequestId.current) {
        setLoading(false);
      }
    }
  };

  const login = async (username, password) => {
    try {
      // Reset any previous session before attempting a new login
      sessionStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);

      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password
      });

      const { token, user } = response.data;
      
      sessionStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(user);
      
      return { success: true, user };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const updateProfilePhoto = (profilePhoto) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, profilePhoto: profilePhoto || '' };
    });
  };

  const value = {
    user,
    login,
    logout,
    loading,
    updateProfilePhoto
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
