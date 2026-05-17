// src/services/membershipAPI.js
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
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const membershipAPI = {
  // Get gym membership plans
  getPlans: async () => {
    return apiRequest('/memberships/plans');
  },

  // Get coach packages
  getCoachPackages: async () => {
    return apiRequest('/memberships/coach-packages');
  },

  // Subscribe to a plan
  subscribe: async (planId, paymentMethod = 'cash') => {
    return apiRequest('/memberships/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        payment_method: paymentMethod
      })
    });
  },

  // Get user's subscriptions
  getMySubscriptions: async () => {
    return apiRequest('/memberships/my-subscriptions');
  }
};

export default membershipAPI;