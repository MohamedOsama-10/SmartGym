// src/context/AuthContext.jsx - COMPLETE FIXED VERSION WITH FORMDATA SUPPORT
import { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const getInitialAuthState = () => {
  if (typeof window === 'undefined') return { user: null, token: null };
  
  try {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    
    if (storedUser && token) {
      const user = JSON.parse(storedUser);
      if (user && user.email && user.role) {
        return { user, token };
      }
    }
  } catch (error) {
    console.error('Error parsing auth state:', error);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }
  
  return { user: null, token: null };
};

// ✅ EXPORT useAuth here at the top level
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const initialState = getInitialAuthState();
  const [user, setUser] = useState(initialState.user);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(true);

  // ✅ CRITICAL FIX: Removed trailing space!
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

  useEffect(() => {
    console.log("🔐 Auth initialized:", { 
      hasUser: !!initialState.user, 
      userRole: initialState.user?.role,
      email: initialState.user?.email 
    });
    
    if (initialState.user && !user) {
      setUser(initialState.user);
    }
  }, []);

  // ✅ FIX: Define logout before apiRequest uses it
  // skipServerCall = true when triggered by a 401 (token already invalid/expired)
  const logout = useCallback(async (skipServerCall = false) => {
    setLoading(true);
    try {
      if (!skipServerCall) {
        const token = localStorage.getItem('access_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (token) {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      // ownerProfile intentionally kept — contains avatar/bio that should persist across logins
      setUser(null);
      setLoading(false);
      console.log("👋 Logged out");
    }
  }, []);

  // ── Silently refresh the access token using the refresh token ──────────────
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
        console.log('🔄 Access token refreshed silently');
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // ✅ CRITICAL FIX: Added FormData support + automatic token refresh
  const apiRequest = useCallback(async (endpoint, options = {}, _retry = false) => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('No authentication token');
    }

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE_URL}${cleanEndpoint}`;
    
    console.log(`📡 API Request: ${options.method || 'GET'} ${url}`);

    try {
      // ✅ Build headers object
      const headers = {
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      };

      // ✅ CRITICAL: Only set Content-Type for JSON, NOT for FormData
      // Browser automatically sets correct Content-Type with boundary for FormData
      const isFormData = options.body instanceof FormData;
      
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }

      console.log('📋 Request headers:', headers);
      console.log('📦 Body type:', isFormData ? 'FormData' : typeof options.body);

      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      if (response.status === 401) {
        if (!_retry) {
          // Try to refresh the token silently first
          console.warn("🔄 401 received — attempting token refresh...");
          const newToken = await refreshAccessToken();
          if (newToken) {
            // Retry the original request with the new token
            return apiRequest(endpoint, options, true);
          }
        }
        // Refresh failed or already retried — log out
        console.error("🔒 Token refresh failed — logging out");
        logout(true);
        throw new Error('Session expired - please login again');
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let detail = errorData.detail || `HTTP ${response.status}`;
        if (Array.isArray(detail)) {
          detail = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail !== 'string') {
          detail = JSON.stringify(detail);
        }
        const error = new Error(detail);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }
      
      if (response.status === 204) return null;
      
      // ✅ Check content type before parsing
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error - check your connection');
      }
      throw error;
    }
  }, [logout, refreshAccessToken]);

  const signup = async (payload) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();
      return await login(payload.email, payload.password, payload.role);
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, role) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();
      console.log('✅ Login success:', data);

      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      
      const userData = data.user || {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        role: data.role,
      };

      if (role && userData.role !== role) {
        throw new Error(`Incorrect role selected. Your account role is "${userData.role}".`);
      }

      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);

      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setSession = useCallback((accessToken, refreshToken, userData) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const value = {
    user,
    login,
    signup,
    logout,
    updateUser,
    setSession,
    loading,
    isReady,
    isAuthenticated: !!user,
    apiRequest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ Also export at the bottom as backup (optional but safe)
export default AuthContext;