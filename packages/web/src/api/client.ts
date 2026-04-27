import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';

/**
 * API Client - Axios instance with JWT interceptor
 * Auto-attach token, handle refresh, global error handling
 */
export const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Attach JWT token
  client.interceptors.request.use((config) => {
    const { token } = useAuthStore.getState();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Response interceptor: Handle errors, auto-refresh token
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // If 401 Unauthorized, clear auth and redirect to login
      if (error.response?.status === 401) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return client;
};

export const apiClient = createApiClient();
