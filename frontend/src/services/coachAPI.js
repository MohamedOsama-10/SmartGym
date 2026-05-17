const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...options.headers },
    });

    if (response.status === 401) {
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
    console.error('API Error:', error);
    throw error;
  }
};

// ─── EXISTING COACH FUNCTIONS ────────────────────────────────────────────────

const coachAPI = {
  getProfile: () => apiRequest('/users/me/coach-profile'),

  getBookings: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/bookings/coach-bookings${qs ? '?' + qs : ''}`);
  },

  updateProfile: (data) =>
    apiRequest('/users/me/coach-profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export default coachAPI;

// ─── TRAINEES ────────────────────────────────────────────────────────────────

export const fetchMyTrainees = async () => {
  try {
    return await apiRequest('/coach/trainees');
  } catch {
    // Fallback: derive from bookings
    const data = await apiRequest('/bookings/coach-bookings?limit=200');
    const bookings = Array.isArray(data) ? data : (data.bookings || data.items || []);

    const seen = new Set();
    const unique = [];
    for (const b of bookings) {
      if (b.customer_id && !seen.has(b.customer_id)) {
        seen.add(b.customer_id);
        unique.push({
          id: b.customer_id,
          name: b.customer_name || b.customer?.name || 'Customer ' + b.customer_id,
          email: b.customer_email || b.customer?.email || '',
          avatar_url: b.customer?.avatar_url || null,
        });
      }
    }
    return unique;
  }
};

// ✅ NEW: Get detailed trainee information including weight, height, age
export const fetchTraineeDetails = async (customerId) => {
  return await apiRequest(`/coach/trainees/${customerId}`);
};

// ─── NUTRITION GOALS ─────────────────────────────────────────────────────────

export const fetchNutritionGoals = (customerId) =>
  apiRequest(`/meals/nutrition-goals?customer_id=${customerId}`);

export const updateNutritionGoals = (customerId, goals) =>
  apiRequest('/meals/nutrition-goals', {
    method: 'POST',
    body: JSON.stringify({
      customer_id: customerId,
      calories: Number(goals.calories),
      protein:  Number(goals.protein),
      carbs:    Number(goals.carbs),
      fats:     Number(goals.fats),
      notes:    goals.notes || '',
    }),
  });

// ─── MEAL LOGS ────────────────────────────────────────────────────────────────

export const fetchMealHistory = (customerId) =>
  apiRequest(`/meals/logs/history?customer_id=${customerId}`);

// ─── WORKOUTS ────────────────────────────────────────────────────────────────

export const fetchAssignedWorkouts = (customerId) =>
  apiRequest(`/workouts/assigned?customer_id=${customerId}`);

export const assignWorkout = (customerId, workoutData) =>
  apiRequest('/workouts/assign-custom', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, ...workoutData }),
  });

export const removeWorkout = (assignedWorkoutId) =>
  apiRequest(`/workouts/assigned/${assignedWorkoutId}`, { method: 'DELETE' });

// ─── TRAINEE PROGRAMS ─────────────────────────────────────────────────────────

export const fetchTraineePrograms = (customerId) =>
  apiRequest(`/training-programs/trainee/${customerId}`);

export const createTraineeProgram = (customerId, programData) =>
  apiRequest('/training-programs/', {
    method: 'POST',
    body: JSON.stringify({ ...programData, customer_id: customerId }),
  });

export const updateTraineeProgram = (programId, programData) =>
  apiRequest(`/training-programs/${programId}`, {
    method: 'PUT',
    body: JSON.stringify(programData),
  });

export const deleteTraineeProgram = (programId) =>
  apiRequest(`/training-programs/${programId}`, { method: 'DELETE' });