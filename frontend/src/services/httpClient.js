// src/services/httpClient.js
// Shared HTTP utilities used by the chat components and ChatContext.

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// Derive the server origin (strips /api/v1) for building media/avatar URLs
const API_ORIGIN = API_BASE_URL.replace('/api/v1', '');

export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  ORIGIN: API_ORIGIN,
};

// Generic API request with error handling
export const apiRequest = async (endpoint, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const token = localStorage.getItem('access_token');
  const url = `${API_BASE_URL}${endpoint}`;
  console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);

  // Never manually set Content-Type for FormData — browser sets it with boundary
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    // Caller overrides — strip Content-Type if FormData to be safe
    ...Object.fromEntries(
      Object.entries(options.headers || {}).filter(
        ([k]) => !(isFormData && k.toLowerCase() === 'content-type')
      )
    ),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    console.warn('⚠️ Token expired, redirecting to login...');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP error ${response.status}`);
  }

  // Return null for 204 No Content
  if (response.status === 204) return null;

  return response.json();
};

export default { API_CONFIG, apiRequest };
