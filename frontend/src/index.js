 import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const registerServiceWorker = () => {
  const isSupported = 'serviceWorker' in navigator;
  const isProduction = process.env.NODE_ENV === 'production';
  const isEnabled = process.env.REACT_APP_ENABLE_SW === 'true';

  if (!isSupported || !isProduction || !isEnabled) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration is optional and should never break app startup.
    });
  });
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

registerServiceWorker();