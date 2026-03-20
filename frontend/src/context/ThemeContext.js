import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();
const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

const getSystemTheme = () => (
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
);

const normalizeTheme = (value) => {
  if (value === 'dark' || value === 'light') return value;
  if (value === 'system') return getSystemTheme();
  return null;
};

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const getInitial = () => {
    const saved = localStorage.getItem('theme');
    const normalized = normalizeTheme(saved);
    return normalized || getSystemTheme();
  };

  const [theme, setTheme] = useState(getInitial);

  // Helper to call backend theme API when logged in
  const saveThemeToServer = async (newTheme) => {
    try {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      await fetch(`${API_BASE_URL}/api/auth/theme`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ theme: newTheme })
      });
    } catch (e) {
      // ignore network errors
      console.warn('Could not persist theme to server', e.message);
    }
  };

  // Try to fetch server preference when user is authenticated
  useEffect(() => {
    const init = async () => {
      try {
        const token = sessionStorage.getItem('token');
        if (!token) return; // no user logged in
        const res = await fetch(`${API_BASE_URL}/api/auth/theme`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.theme) {
          // Keep only explicit dark/light in local state and storage.
          const resolvedTheme = normalizeTheme(data.theme);
          if (resolvedTheme) {
            setTheme(resolvedTheme);
            try { localStorage.setItem('theme', resolvedTheme); } catch (e) {}
          }
        }
      } catch (e) {
        // network error - ignore and rely on local preference
      }
    };
  init();
  }, []);

  useEffect(() => {
    const isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      // ignore
    }
  }, [theme]);

  const toggle = () => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      // persist to server if logged in
      saveThemeToServer(next);
      return next;
    });
  };

  const set = (value) => {
    setTheme(() => {
      const next = normalizeTheme(value) || 'light';
      saveThemeToServer(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme: set }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
