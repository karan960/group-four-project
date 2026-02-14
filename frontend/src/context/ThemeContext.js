import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const getInitial = () => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  };

  const [theme, setTheme] = useState(getInitial);

  // Helper to call backend theme API when logged in
  const saveThemeToServer = async (newTheme) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await fetch('http://localhost:5000/api/auth/theme', {
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
        const token = localStorage.getItem('token');
        if (!token) return; // no user logged in
        const res = await fetch('http://localhost:5000/api/auth/theme', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.theme) {
          // if server has a preference, use it (and persist locally)
          setTheme(data.theme === 'system' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.theme);
          try { localStorage.setItem('theme', data.theme); } catch (e) {}
        }
      } catch (e) {
        // network error - ignore and rely on local preference
      }
    };
  init();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
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
    setTheme((t) => {
      const next = value;
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
