// ✅ FIXED: Removed trailing space from URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const apiRequest = async (endpoint, options = {}) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      console.warn('⚠️ Token expired, redirecting to login...');
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ API Error:', response.status, errorData);
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = response.status === 204 ? null : await response.json();
    console.log(`✅ API Response:`, data);
    return data;
  } catch (error) {
    console.error('💥 API Error:', error);
    throw error;
  }
};

// User Workout API
export const workoutAPI = {
  getMyWorkouts: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'all') params.append('filter_type', filters.type);
    if (filters.completed !== undefined) params.append('completed', filters.completed);
    
    const queryString = params.toString();
    const endpoint = `/workouts/my-workouts${queryString ? '?' + queryString : ''}`;
    return apiRequest(endpoint);
  },

  markWorkoutComplete: async (workoutId, completed) => {
    return apiRequest(`/workouts/my-workouts/${workoutId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        completed,
        completedAt: completed ? new Date().toISOString() : null
      })
    });
  },

  getWorkoutHistory: async (days = 7) => {
    return apiRequest(`/workouts/my-workouts/history?days=${days}`);
  },

  getExerciseLibrary: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    
    const queryString = params.toString();
    return apiRequest(`/workouts/exercises/library${queryString ? '?' + queryString : ''}`);
  },

  getWorkoutById: async (workoutId) => {
    return apiRequest(`/workouts/my-workouts/${workoutId}`);
  },

  getMyProgram: () => apiRequest('/training-programs/my-program'),
};

// Coach Workout API
export const coachWorkoutAPI = {
  assignWorkout: async (assignmentData) => {
    return apiRequest('/workouts/assign', {
      method: 'POST',
      body: JSON.stringify({
        customerId: assignmentData.customerId,
        workoutTemplateId: assignmentData.workoutId || assignmentData.workoutTemplateId,
        dueDate: assignmentData.dueDate,
        notes: assignmentData.notes
      })
    });
  },

  getCustomerWorkouts: async (customerId) => {
    return apiRequest(`/workouts/coach/customers/${customerId}/workouts`);
  },

  getWorkoutTemplates: async () => {
    return apiRequest('/workouts/templates');
  }
};

// Admin/Owner API
export const adminWorkoutAPI = {
  getAllWorkouts: async () => {
    return apiRequest('/workouts/all');
  },

  createWorkoutTemplate: async (templateData) => {
    return apiRequest('/workouts/templates', {
      method: 'POST',
      body: JSON.stringify(templateData)
    });
  },

  updateWorkoutTemplate: async (templateId, templateData) => {
    return apiRequest(`/workouts/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(templateData)
    });
  },

  deleteWorkoutTemplate: async (templateId) => {
    return apiRequest(`/workouts/templates/${templateId}`, {
      method: 'DELETE'
    });
  }
};

export default workoutAPI;