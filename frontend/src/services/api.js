// src/services/api.js
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

// Auth API
export const authAPI = {
  signup: (data) => apiRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (data) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  logout: () => {
    const refreshToken = localStorage.getItem('refresh_token');
    return apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  refresh: (refreshToken) => apiRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  }),
};

// Profile API
export const profileAPI = {
  getCustomerProfile: () => apiRequest('/users/me/profile'),
  updateCustomerProfile: (data) => apiRequest('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  getCoachProfile: () => apiRequest('/users/me/coach-profile'),
  updateCoachProfile: (data) => apiRequest('/users/me/coach-profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  uploadAvatar: (formData) => {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_BASE_URL}/users/me/avatar`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },
  uploadCoachAvatar: (formData) => {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_BASE_URL}/users/me/coach-avatar`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Upload failed');
      }
      return res.json();
    });
  },

  uploadCoachCV: (formData) => {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_BASE_URL}/users/me/coach-cv`, {
      method: 'POST',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: formData,
    }).then(async res => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'CV upload failed');
      }
      return res.json();
    });
  },

  // Certifications
  addCertification: (data) => apiRequest('/users/me/certifications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteCertification: (id) => apiRequest(`/users/me/certifications/${id}`, {
    method: 'DELETE',
  }),

  // Education
  addEducation: (data) => apiRequest('/users/me/education', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteEducation: (id) => apiRequest(`/users/me/education/${id}`, {
    method: 'DELETE',
  }),

  // Experience
  addExperience: (data) => apiRequest('/users/me/experience', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteExperience: (id) => apiRequest(`/users/me/experience/${id}`, {
    method: 'DELETE',
  }),
};

// Staff/Admin API
export const staffAPI = {
  getMyAdminProfile: () => apiRequest('/staff/admins/me'),
  updateMyAdminProfile: (data) => apiRequest('/staff/admins/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  listAllAdmins: () => apiRequest('/staff/admins'),
  
  getMyOwnerProfile: () => apiRequest('/staff/owners/me'),
  updateMyOwnerProfile: (data) => apiRequest('/staff/owners/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  listAllOwners: () => apiRequest('/staff/owners'),
};

// Bookings API
export const bookingsAPI = {
  getMyBookings: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('booking_status', filters.status);
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    return apiRequest(`/bookings/my-bookings${queryString ? '?' + queryString : ''}`);
  },
  
  createBooking: (data) => apiRequest('/bookings/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  cancelBooking: (id) => apiRequest(`/bookings/${id}/cancel`, { 
    method: 'POST'
  }),
  
  rescheduleBooking: (bookingId, newSlotId, reason = null, newCoachId = null) => {
    return apiRequest(`/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        new_availability_slot_id: newSlotId,
        new_coach_id: newCoachId,
        reschedule_reason: reason
      })
    });
  },
  
  getCoachBookings: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('booking_status', filters.status);
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    if (filters.limit) params.append('limit', Math.min(filters.limit, 100));
    if (filters.page) params.append('page', filters.page);

    const queryString = params.toString();
    return apiRequest(`/bookings/coach-bookings${queryString ? '?' + queryString : ''}`);
  },
  
  confirmBooking: (id, coachNotes = null) => apiRequest(`/bookings/${id}/confirm`, {
    method: 'PUT',
    body: coachNotes ? JSON.stringify({ coach_notes: coachNotes }) : undefined,
  }),
  
  completeBooking: (id, coachNotes = null) => apiRequest(`/bookings/${id}/complete`, {
    method: 'PUT',
    body: coachNotes ? JSON.stringify({ coach_notes: coachNotes }) : undefined,
  }),
  
  markBookingMissed: (id) => apiRequest(`/bookings/${id}/miss`, {
    method: 'PUT'
  }),
  
  coachRescheduleBooking: (bookingId, newSlotId, reason = null, notifyCustomer = true) => {
    return apiRequest(`/bookings/${bookingId}/coach-reschedule`, {
      method: 'POST',
      body: JSON.stringify({
        new_availability_slot_id: newSlotId,
        reschedule_reason: reason,
        notify_customer: notifyCustomer
      })
    });
  },
  
  getAllBookings: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('booking_status', filters.status);
    if (filters.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters.dateTo) params.append('date_to', filters.dateTo);
    
    const queryString = params.toString();
    return apiRequest(`/bookings/all${queryString ? '?' + queryString : ''}`);
  },
};

// Availability API
export const availabilityAPI = {
  getMyAvailability: () => apiRequest('/coach/availability/'),
  
  createAvailability: (data) => apiRequest('/coach/availability/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  updateAvailability: (id, data) => apiRequest(`/coach/availability/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  deleteAvailability: (id) => apiRequest(`/coach/availability/${id}`, { 
    method: 'DELETE' 
  }),
  
  getCoachAvailability: (coachId, availableOnly = true) => {
    return apiRequest(`/coach/availability/coach/${coachId}?available_only=${availableOnly}`);
  },
};

// Gyms API
export const gymsAPI = {
  listGyms: () => apiRequest('/gyms/'),
  getGym: (id) => apiRequest(`/gyms/${id}`),
  getGymCoaches: (id) => apiRequest(`/gyms/${id}/coaches`),
  getGymBookings: (id, status = null) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/gyms/${id}/bookings${params}`);
  },
  createGym: (data) => apiRequest('/gyms/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateGym: (id, data) => apiRequest(`/gyms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteGym: (id) => apiRequest(`/gyms/${id}`, {
    method: 'DELETE',
  }),
};

// Subscriptions API
export const subscriptionsAPI = {
  getMySubscriptions: () => apiRequest('/subscriptions/my-subscriptions'),
  getSubscriptionDetail: (id) => apiRequest(`/subscriptions/my-subscriptions/${id}`),
};

// Meals API
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

// Workouts API
export const workoutAPI = {
  getMyWorkouts: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('filter_type', filters.type);
    if (filters.completed !== undefined) params.append('completed', filters.completed);
    
    const queryString = params.toString();
    return apiRequest(`/workouts/my-workouts${queryString ? '?' + queryString : ''}`);
  },

  markWorkoutComplete: (workoutId, completed) => apiRequest(`/workouts/my-workouts/${workoutId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      completed,
      completedAt: completed ? new Date().toISOString() : null
    })
  }),

  getWorkoutHistory: (days = 7) => apiRequest(`/workouts/my-workouts/history?days=${days}`),

  getExerciseLibrary: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    
    const queryString = params.toString();
    return apiRequest(`/workouts/exercises/library${queryString ? '?' + queryString : ''}`);
  },

  getWorkoutById: (workoutId) => apiRequest(`/workouts/my-workouts/${workoutId}`),

  getWorkoutTemplates: (isPublic = true) => apiRequest(`/workouts/templates?is_public=${isPublic}`),
};

// Coach Workout API
export const coachWorkoutAPI = {
  assignWorkout: (assignmentData) => apiRequest('/workouts/assign', {
    method: 'POST',
    body: JSON.stringify({
      customerId: assignmentData.customerId,
      workoutTemplateId: assignmentData.workoutId || assignmentData.workoutTemplateId,
      dueDate: assignmentData.dueDate,
      notes: assignmentData.notes
    })
  }),

  getCustomerWorkouts: (customerId) => apiRequest(`/workouts/coach/customers/${customerId}/workouts`),

  getWorkoutTemplates: () => apiRequest('/workouts/templates'),
};

// Reviews API
export const reviewsAPI = {
  createReview: (data) => apiRequest('/reviews/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getCoachReviews: (coachId) => apiRequest(`/reviews/coach/${coachId}`),
};

// Training Programs API
export const programsAPI = {
  listPrograms: () => apiRequest('/training-programs/'),

  getProgram: (id) => apiRequest(`/training-programs/${id}`),

  createProgram: (data) => apiRequest('/training-programs/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateProgram: (id, data) => apiRequest(`/training-programs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  deleteProgram: (id) => apiRequest(`/training-programs/${id}`, {
    method: 'DELETE',
  }),
};

// Export all APIs
export default {
  auth: authAPI,
  profile: profileAPI,
  staff: staffAPI,
  bookings: bookingsAPI,
  availability: availabilityAPI,
  gyms: gymsAPI,
  subscriptions: subscriptionsAPI,
  meals: mealAPI,
  workouts: workoutAPI,
  coachWorkouts: coachWorkoutAPI,
  reviews: reviewsAPI,
  programs: programsAPI,
};