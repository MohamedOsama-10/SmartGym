//D:\gym_system\Gym_Backend\app\services\workoutAPI.js
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

// Generic API request with error handling
const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      console.warn('Token expired, redirecting to login...');
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

// ============ WORKOUT API ============

export const workoutAPI = {
  /**
   * Get all workouts assigned to current user
   * @param {Object} filters - { type: 'strength'|'cardio'|'flexibility', completed: true|false }
   */
  getMyWorkouts: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('filter_type', filters.type);
    if (filters.completed !== undefined) params.append('completed', filters.completed);
    
    const queryString = params.toString();
    return apiRequest(`/workouts/my-workouts${queryString ? '?' + queryString : ''}`);
  },

  /**
   * Mark a workout as complete/incomplete
   * @param {number} workoutId
   * @param {boolean} completed
   */
  markWorkoutComplete: async (workoutId, completed) => {
    return apiRequest(`/workouts/my-workouts/${workoutId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        completed,
        completedAt: completed ? new Date().toISOString() : null
      })
    });
  },

  /**
   * Get workout history
   * @param {number} days - Number of days to fetch (default 7)
   */
  getWorkoutHistory: async (days = 7) => {
    return apiRequest(`/workouts/my-workouts/history?days=${days}`);
  },

  /**
   * Get exercise library
   * @param {Object} filters - { category: string, search: string }
   */
  getExerciseLibrary: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    
    const queryString = params.toString();
    return apiRequest(`/workouts/exercises/library${queryString ? '?' + queryString : ''}`);
  }
};

// ============ COACH WORKOUT API (for coaches) ============

export const coachWorkoutAPI = {
  /**
   * Assign a workout to a customer
   * @param {number} customerId
   * @param {number} workoutId
   * @param {Object} options - { targetDate, notes }
   */
  assignWorkout: async (customerId, workoutId, options = {}) => {
    return apiRequest('/workouts/assign', {
      method: 'POST',
      body: JSON.stringify({
        customerId,
        workoutId,
        ...options
      })
    });
  },

  /**
   * Get workouts assigned to a specific customer
   * @param {number} customerId
   */
  getCustomerWorkouts: async (customerId) => {
    return apiRequest(`/workouts/coach/customers/${customerId}/workouts`);
  }
};

export default workoutAPI;