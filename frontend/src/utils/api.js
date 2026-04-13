import axios from 'axios';

const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = window.sessionStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const onLoginPage = window.location.pathname === '/login';
      if (!onLoginPage) {
        window.sessionStorage.removeItem('token');
      }
    }
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error, fallbackMessage = 'Request failed') => {
  return error?.response?.data?.message || error?.message || fallbackMessage;
};

export { apiBaseUrl };

export default api;