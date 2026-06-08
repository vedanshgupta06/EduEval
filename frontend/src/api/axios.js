import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If token expired or invalid — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.status === 404) {
    return 'The requested item was not found';
  }

  if (error.code === 'ERR_NETWORK') {
    return 'Cannot reach the backend. Start edueval-backend on port 8080.';
  }

  return fallback;
}

export default api;
