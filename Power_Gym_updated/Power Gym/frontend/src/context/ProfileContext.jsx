// src/context/ProfileContext.jsx (Fixed - No Infinite Loop)
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const { user, apiRequest, isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);
  
  // Use ref to prevent race conditions and track init state
  const loadingRef = useRef(false);
  const initAttempted = useRef(false);
  const userIdRef = useRef(null);

  // Load profile based on user role
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // No user - reset and mark ready
    if (!isAuthenticated || !user) {
      setProfile(null);
      setLoading(false);
      setIsReady(true);
      setError(null);
      initAttempted.current = false;
      userIdRef.current = null;
      return;
    }

    // Check if this is a different user (re-login)
    if (userIdRef.current !== user.id) {
      initAttempted.current = false;
      userIdRef.current = user.id;
    }

    // Prevent duplicate loads for same user
    if (loadingRef.current || initAttempted.current) {
      return;
    }

    const loadProfile = async () => {
      loadingRef.current = true;
      setError(null);
      
      // ── Check sessionStorage cache first ──────────────────────────
      const cacheKey = `profile_${user.id}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile(parsed);
          setLoading(false);
          setIsReady(true);
          initAttempted.current = true;
          loadingRef.current = false;
          return;
        }
      } catch (_) {}
      // ─────────────────────────────────────────────────────────────

      setLoading(true);

      try {
        let profileData = null;
        
        if (user.role === 'owner') {
          // Load owner profile from API (admin_profiles table)
          try {
            const ap = await apiRequest('/admin/profile/');
            profileData = {
              name: ap.full_name || user.full_name || user.name || "Owner",
              email: ap.email || user.email || "",
              phone: ap.phone || user.phone || "",
              avatar: ap.profile_photo_url || null,
              avatar_url: ap.profile_photo_url || null,
              role: 'owner',
              joinDate: new Date().toISOString().split('T')[0],
              gyms: []
            };
          } catch (_) {
            profileData = {
              name: user.full_name || user.name || "Owner",
              email: user.email || "",
              phone: user.phone || "",
              avatar: null,
              avatar_url: null,
              role: 'owner',
              gyms: []
            };
          }
          
        } else if (user.role === 'coach') {
          try {
            profileData = await apiRequest('/users/me/coach-profile');
            profileData = { ...profileData, role: user.role };
          } catch (err) {
            profileData = {
              name: user.full_name || user.name,
              email: user.email,
              role: user.role,
              experience_years: 0,
              hourly_rate: 0,
              gym_id: null,
              avatar: null
            };
          }
          
        } else if (user.role === 'admin') {
          try {
            const ap = await apiRequest('/admin/profile/');
            profileData = {
              name: ap.full_name || user.full_name || user.name,
              email: ap.email || user.email,
              phone: ap.phone || "",
              avatar: ap.profile_photo_url || null,
              avatar_url: ap.profile_photo_url || null,
              role: user.role,
              permissions: ['all']
            };
          } catch (_) {
            profileData = {
              name: user.full_name || user.name,
              email: user.email,
              role: user.role,
              avatar: null,
              avatar_url: null,
              permissions: ['all']
            };
          }
          
        } else {
          // Load user/customer profile from API
          try {
            profileData = await apiRequest('/users/me/customer-profile');
            profileData = { ...profileData, role: user.role };
          } catch (err) {
            profileData = {
              name: user.full_name || user.name,
              email: user.email,
              role: user.role,
              height: null,
              weight: null,
              goal: null,
              weight_goal: null,
              avatar: null
            };
          }
        }
        
        if (!profileData) {
          throw new Error("Failed to create profile data");
        }
        
        // Save to sessionStorage cache
        try {
          sessionStorage.setItem(`profile_${user.id}`, JSON.stringify(profileData));
        } catch (_) {}
        setProfile(profileData);
        setError(null);
        
      } catch (err) {
        setError(err.message);
        
        // Emergency fallback - never leave profile null if we have a user
        setProfile({
          name: user.full_name || user.name || "User",
          email: user.email || "user@example.com",
          role: user.role || 'user',
          avatar: null,
          _fallback: true // Mark as fallback data
        });
      } finally {
        setLoading(false);
        setIsReady(true);
        initAttempted.current = true;
        loadingRef.current = false;
      }
    };

    loadProfile();
    
    // Safety timeout - force ready after 5 seconds
    // IMPORTANT: never reset avatar if profile already loaded
    const timeout = setTimeout(() => {
      if (!isReady) {
        setLoading(false);
        setIsReady(true);
        loadingRef.current = false;
        // Only set fallback if profile is completely missing
        setProfile(prev => {
          if (!prev) {
            setError("Loading timeout - using fallback");
            return {
              name: user?.full_name || user?.name || "User",
              email: user?.email || "user@example.com",
              role: user?.role || 'user',
              avatar: null,
              _timeout: true
            };
          }
          // Profile exists — keep it, just mark ready
          return prev;
        });
      }
    }, 2000);

    return () => clearTimeout(timeout);
    
  // ✅ CRITICAL FIX: Removed isReady and profile from dependencies!
  // Only re-run when user, auth state, or apiRequest changes
  }, [user?.id, isAuthenticated, authLoading, apiRequest]);


  const updateProfile = async (updates) => {
    try {
      setProfile(prev => ({ ...prev, ...updates, _dirty: true }));
      
      if (profile?.role === 'coach') {
        const updated = await apiRequest('/users/me/coach-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        setProfile(prev => ({ ...prev, ...updated, _dirty: false }));
      } else if (profile?.role === 'user' || !['owner', 'admin'].includes(profile?.role)) {
        const updated = await apiRequest('/users/me/customer-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });
        setProfile(prev => ({ ...prev, ...updated, _dirty: false }));
      }
      // Owner/Admin updates stay local
    } catch (err) {
      setError(err.message);
    }
  };

  const updateAvatar = (imageData) => {
    const isServerUrl = imageData && !imageData.startsWith('data:');
    setProfile(prev => {
      const updated = {
        ...prev,
        avatar: imageData,
        ...(isServerUrl && { avatar_url: imageData }),
        _dirty: true,
      };
      // Update cache with new avatar
      try {
        if (prev) sessionStorage.setItem(`profile_${prev.id || 'u'}`, JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const refreshProfile = useCallback(() => {
    // Clear cache so next load hits API
    try { sessionStorage.clear(); } catch (_) {}
    initAttempted.current = false;
    userIdRef.current = null;
    setIsReady(false);
    setLoading(true);
  }, []);

  const value = {
    profile,
    loading,
    error,
    isReady,
    updateProfile,
    updateAvatar,
    refreshProfile,
    isOwner: profile?.role === 'owner',
    isCoach: profile?.role === 'coach',
    isUser: profile?.role === 'user',
    isAdmin: profile?.role === 'admin',
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};