// src/services/mealAPI.js
// ✅ FIXED: Removed trailing space from URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const apiRequest = async (endpoint, options = {}) => {
  try {
    console.log(`🌐 API Request: ${API_BASE_URL}${endpoint}`);
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`❌ API Error ${response.status}:`, error);
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// Meal API
export const mealAPI = {
  getMeals: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'all') params.append('meal_type', filters.type);
    if (filters.favoritesOnly) params.append('favorites_only', 'true');
    
    const queryString = params.toString();
    return apiRequest(`/meals/library${queryString ? '?' + queryString : ''}`);
  },

  createCustomMeal: (mealData) => apiRequest('/meals/custom', {
    method: 'POST',
    body: JSON.stringify(mealData),
  }),

  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/meals/upload-image`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Upload failed');
    }
    return response.json();
  },

  toggleFavorite: (mealId) => apiRequest(`/meals/${mealId}/favorite`, {
    method: 'PUT',
  }),

  deleteMeal: (mealId) => apiRequest(`/meals/${mealId}`, {
    method: 'DELETE',
  }),

  logMeal: (mealId, servings = 1, notes = '') => apiRequest('/meals/log', {
    method: 'POST',
    body: JSON.stringify({
      meal_id: mealId,
      servings,
      notes,
    }),
  }),

  getTodayLogs: () => apiRequest('/meals/logs/today'),

  getHistory: (days = 7) => apiRequest(`/meals/logs/history?days=${days}`),

  deleteLog: (logId) => apiRequest(`/meals/logs/${logId}`, {
    method: 'DELETE',
  }),

  getGoals: () => apiRequest('/meals/goals'),

  updateGoals: (goals) => apiRequest('/meals/goals', {
    method: 'PUT',
    body: JSON.stringify(goals),
  }),
};

export default mealAPI;