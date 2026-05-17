//D:\gym_system\gym-project\frontend\src\pages\user\UserProfile.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";

export default function UserProfile() {
  const { user, apiRequest, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "male",
    height: 170,
    weight: 70,
    weightGoal: "",
    goal: "maintenance",
    bio: "",
    emergencyContact: {
      name: "",
      phone: "",
      relationship: ""
    },
    preferences: {
      notifications: true,
      emailUpdates: true,
      publicProfile: false
    },
    avatar: null,
    avatarPreview: null
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch profile and subscription in parallel
        const [profileData, subData] = await Promise.allSettled([
          apiRequest('/users/me/profile'),
          apiRequest('/subscriptions/my-subscriptions'),
        ]);

        if (profileData.status === "fulfilled" && profileData.value) {
          const data = profileData.value;
          console.log("Profile data received:", data);
          setProfileData(prev => ({
            ...prev,
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || "",
            dateOfBirth: data.date_of_birth || "",
            gender: data.gender || "male",
            height: data.height || 170,
            weight: data.weight || 70,
            weightGoal: data.weight_goal || "",
            goal: data.goal || "maintenance",
            bio: data.bio || "",
            emergencyContact: {
              name: data.emergency_contact_name || "",
              phone: data.emergency_contact_phone || "",
              relationship: data.emergency_contact_relationship || ""
            },
            preferences: {
              notifications: data.notifications_enabled ?? true,
              emailUpdates: data.email_updates_enabled ?? true,
              publicProfile: data.public_profile ?? false
            },
            avatar: null,
            avatarPreview: data.avatar_url || null
          }));
        } else if (profileData.status === "rejected") {
          console.error("Failed to fetch profile:", profileData.reason);
          setError("Failed to load profile data");
        }

        if (subData.status === "fulfilled" && subData.value) {
          const s = subData.value;
          // API may return a list or single object
          const sub = Array.isArray(s) ? s[0] : s;
          if (sub) setSubscription(sub);
        }
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleInputChange = useCallback((field, value) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEmergencyContactChange = useCallback((field, value) => {
    setProfileData(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [field]: value }
    }));
  }, []);

  const handlePreferenceChange = useCallback((field, value) => {
    setProfileData(prev => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value }
    }));
  }, []);

  // ✅ FIXED: Avatar upload with proper authentication
// ✅ FIXED: Avatar upload with proper authentication
// ✅ CORRECTED handleImageSelect - Replace lines 128-200 in UserProfile.jsx

const handleImageSelect = useCallback(async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    console.log('⚠️ No file selected');
    return;
  }

  console.log('📁 File selected:', {
    name: file.name,
    size: `${(file.size / 1024).toFixed(2)} KB`,
    type: file.type
  });

  // Validate file type
  if (!file.type.startsWith('image/')) {
    setError('Please select an image file');
    return;
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    setError('Image size must be less than 5MB');
    return;
  }

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = (e) => {
    console.log('🖼️ Preview loaded');
    setProfileData(prev => ({
      ...prev,
      avatarPreview: e.target.result
    }));
  };
  reader.readAsDataURL(file);

  setShowImageOptions(false);
  setSaving(true);
  setError(null);

  try {
    const formData = new FormData();
    formData.append('avatar', file);

    // ✅ CRITICAL FIX: Use 'access_token' not 'token'
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
    
    if (!token) {
      throw new Error('Authentication token not found. Please login again.');
    }

    console.log('🔑 Token found:', token.substring(0, 20) + '...');
    console.log('📤 Starting avatar upload...');

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'}/users/me/avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
        // ❌ DO NOT set Content-Type - browser will set it with boundary
      },
      body: formData
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Server error:', errorData);
      
      if (response.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      
      throw new Error(errorData.detail || `Upload failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Upload successful!', data);

    setProfileData(prev => ({
      ...prev,
      avatar: null,
      avatarPreview: data.avatar_url
    }));

    setSuccessMessage('Profile photo updated successfully!');
  } catch (err) {
    console.error('💥 UPLOAD ERROR:', err);
    setError(err.message || 'Failed to upload profile photo');
    
    // Revert preview on error
    setProfileData(prev => ({
      ...prev,
      avatar: null,
      avatarPreview: null
    }));
  } finally {
    setSaving(false);
    // Reset file inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }
}, []);
  const handleRemoveAvatar = useCallback(async () => {
    setShowImageOptions(false);
    setSaving(true);
    setError(null);

    try {
      await apiRequest('/users/me/avatar', {
        method: 'DELETE'
      });
      
      // Clear avatar in state
      setProfileData(prev => ({
        ...prev,
        avatar: null,
        avatarPreview: null
      }));
      
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      
      setSuccessMessage('Profile photo removed successfully!');
    } catch (err) {
      console.error('Failed to remove avatar:', err);
      setError(err.message || 'Failed to remove profile photo');
    } finally {
      setSaving(false);
    }
  }, [apiRequest]);

  const handleSaveProfile = useCallback(async () => {
    setSaving(true);
    setError(null);
    
    try {
      // ✅ Helper function to convert empty strings to null
      const toNullIfEmpty = (value) => {
        if (value === '' || value === undefined) return null;
        return value;
      };

      const payload = {
        full_name: toNullIfEmpty(profileData.name),
        phone: toNullIfEmpty(profileData.phone),
        date_of_birth: toNullIfEmpty(profileData.dateOfBirth),
        gender: toNullIfEmpty(profileData.gender),
        height: profileData.height ? parseFloat(profileData.height) : null,
        weight: profileData.weight ? parseFloat(profileData.weight) : null,
        weight_goal: profileData.weightGoal ? parseFloat(profileData.weightGoal) : null,
        goal: toNullIfEmpty(profileData.goal),
        bio: toNullIfEmpty(profileData.bio),
        emergency_contact_name: toNullIfEmpty(profileData.emergencyContact.name),
        emergency_contact_phone: toNullIfEmpty(profileData.emergencyContact.phone),
        emergency_contact_relationship: toNullIfEmpty(profileData.emergencyContact.relationship),
        notifications_enabled: Boolean(profileData.preferences.notifications),
        email_updates_enabled: Boolean(profileData.preferences.emailUpdates),
        public_profile: Boolean(profileData.preferences.publicProfile)
      };

      console.log('📤 Sending payload:', payload);

      await apiRequest('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setSuccessMessage("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }, [apiRequest, profileData]);

  const handleChangePassword = useCallback(async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords don't match!");
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setError("Password must be at least 6 characters!");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiRequest('/users/me/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });

      setSuccessMessage("Password changed successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (err) {
      setError(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  }, [apiRequest, passwordData]);

  const calculateAge = useCallback((dateOfBirth) => {
    if (!dateOfBirth) return "--";
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, []);

  const calculateBMI = useCallback(() => {
    const heightInMeters = profileData.height / 100;
    if (!heightInMeters || !profileData.weight) return "--";
    const bmi = profileData.weight / (heightInMeters * heightInMeters);
    return bmi.toFixed(1);
  }, [profileData.height, profileData.weight]);

  const getBMICategory = useCallback((bmi) => {
    if (bmi === "--" || isNaN(bmi)) return { label: "--", color: "text-gray-600" };
    const numBmi = parseFloat(bmi);
    if (numBmi < 18.5) return { label: "Underweight", color: "text-yellow-600" };
    if (numBmi < 25) return { label: "Normal", color: "text-green-600" };
    if (numBmi < 30) return { label: "Overweight", color: "text-orange-600" };
    return { label: "Obese", color: "text-red-600" };
  }, []);

  const bmi = calculateBMI();
  const bmiCategory = getBMICategory(bmi);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 flex items-center justify-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl" role="img" aria-label="loading">💪</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full space-y-6">
        {/* Alerts */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-800 rounded-2xl p-4 flex items-center gap-3 animate-fadeIn">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3 animate-fadeIn">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-green-700 dark:text-green-300 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Header */}
        <header className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-5 md:p-8">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '40px 40px'
            }}></div>
          </div>
          
          <div className="relative z-10">
            <nav className="flex items-center gap-2 text-white/80 mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm font-medium">My Account</span>
            </nav>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Profile Settings
            </h1>
            <p className="text-white/80 mt-2">Manage your personal information and preferences</p>
          </div>
        </header>

        {/* Profile Card */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Cover Image */}
          <div className="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative">
            <div className="absolute inset-0 bg-black/10"></div>
          </div>

          {/* Profile Info */}
          <div className="px-4 md:px-6 pb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16 mb-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-xl">
                  {profileData.avatarPreview ? (
                    <img 
                      src={profileData.avatarPreview} 
                      alt="Profile" 
                      className="w-full h-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-5xl font-bold">
                      {profileData.name.charAt(0) || "U"}
                    </div>
                  )}
                </div>
                
                {/* Edit Avatar Button */}
                <button
                  onClick={() => setShowImageOptions(!showImageOptions)}
                  className="absolute bottom-2 right-2 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition"
                  aria-label="Change profile photo"
                  aria-expanded={showImageOptions}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>

                {/* Image Options Dropdown */}
                {showImageOptions && (
                  <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-700 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden z-20 min-w-[200px]">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageSelect}
                      className="hidden"
                      aria-label="Take photo"
                    />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      aria-label="Choose from gallery"
                    />
                    
                    <button
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-200">Take Photo</span>
                    </button>
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center gap-3"
                    >
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-gray-700 dark:text-gray-200">Choose from Gallery</span>
                    </button>
                    
                    {profileData.avatarPreview && (
                      <button
                        onClick={handleRemoveAvatar}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-3 text-red-600 dark:text-red-400"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Remove Photo</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Edit Toggle */}
              <button
                onClick={() => setIsEditing(!isEditing)}
                disabled={saving}
                className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-semibold transition-all shadow-lg flex items-center gap-2 ${
                  isEditing
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isEditing ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Profile
                  </>
                )}
              </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">{calculateAge(profileData.dateOfBirth)}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Years Old</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">{profileData.height}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">cm</p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400 truncate">{profileData.weight}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">kg</p>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-xl">
                <p className={`text-xl sm:text-2xl font-bold truncate ${bmiCategory.color}`}>{bmi}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">BMI · {bmiCategory.label}</p>
              </div>
            </div>

            {/* Form Fields */}
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
              {/* Personal Information */}
              <fieldset>
                <legend className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Personal Information
                </legend>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Full Name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={profileData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      disabled={!isEditing}
                      required
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date of Birth
                    </label>
                    <input
                      id="dateOfBirth"
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Gender
                    </label>
                    <select
                      id="gender"
                      value={profileData.gender}
                      onChange={(e) => handleInputChange('gender', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="goal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Fitness Goal
                    </label>
                    <select
                      id="goal"
                      value={profileData.goal}
                      onChange={(e) => handleInputChange('goal', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    >
                      <option value="weight-loss">Weight Loss</option>
                      <option value="muscle-gain">Muscle Gain</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="endurance">Endurance</option>
                      <option value="flexibility">Flexibility</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Height (cm)
                    </label>
                    <input
                      id="height"
                      type="number"
                      min="50"
                      max="300"
                      value={profileData.height}
                      onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Weight (kg)
                    </label>
                    <input
                      id="weight"
                      type="number"
                      min="20"
                      max="500"
                      step="0.1"
                      value={profileData.weight}
                      onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 0)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="weightGoal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Target Weight (kg)
                    </label>
                    <input
                      id="weightGoal"
                      type="number"
                      min="20"
                      max="500"
                      step="0.1"
                      value={profileData.weightGoal}
                      onChange={(e) => handleInputChange('weightGoal', e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g. 70"
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    disabled={!isEditing}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition resize-none"
                    placeholder="Tell us about yourself..."
                  />
                  {isEditing && (
                    <p className="text-xs text-gray-500 mt-1">{profileData.bio.length}/500 characters</p>
                  )}
                </div>
              </fieldset>

              {/* Emergency Contact */}
              <fieldset>
                <legend className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Emergency Contact
                </legend>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="emergencyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contact Name
                    </label>
                    <input
                      id="emergencyName"
                      type="text"
                      value={profileData.emergencyContact.name}
                      onChange={(e) => handleEmergencyContactChange('name', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="emergencyPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      id="emergencyPhone"
                      type="tel"
                      value={profileData.emergencyContact.phone}
                      onChange={(e) => handleEmergencyContactChange('phone', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>

                  <div>
                    <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Relationship
                    </label>
                    <input
                      id="emergencyRelationship"
                      type="text"
                      value={profileData.emergencyContact.relationship}
                      onChange={(e) => handleEmergencyContactChange('relationship', e.target.value)}
                      disabled={!isEditing}
                      className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed transition"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Preferences */}
              <fieldset>
                <legend className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Preferences
                </legend>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Push Notifications</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Receive workout reminders</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileData.preferences.notifications}
                      onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
                      disabled={!isEditing}
                      className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Email Updates</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Get news and tips via email</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileData.preferences.emailUpdates}
                      onChange={(e) => handlePreferenceChange('emailUpdates', e.target.checked)}
                      disabled={!isEditing}
                      className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Public Profile</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Allow others to see your profile</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={profileData.preferences.publicProfile}
                      onChange={(e) => handlePreferenceChange('publicProfile', e.target.checked)}
                      disabled={!isEditing}
                      className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
              </fieldset>

              {/* Save Button */}
              {isEditing && (
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={saving}
                    className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Subscription Section */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 md:p-7">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            My Subscription
          </h2>

          {subscription ? (() => {
            const endDate = subscription.end_date || subscription.endDate;
            const startDate = subscription.start_date || subscription.startDate;
            const daysLeft = endDate
              ? Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24))
              : null;
            const isActive = subscription.status === "active";
            const isExpired = daysLeft !== null && daysLeft <= 0;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Plan Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {subscription.plan_name || subscription.name || "—"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                        {subscription.plan_type || subscription.billing_cycle || subscription.billingCycle || ""}
                      </p>
                    </div>
                    <span className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold ${
                      isActive && !isExpired
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    }`}>
                      {isActive && !isExpired ? "Active" : "Expired"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {startDate && (
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Start Date</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(startDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </span>
                      </div>
                    )}
                    {endDate && (
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">End Date</span>
                        <span className={`text-sm font-medium ${
                          isExpired ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
                        }`}>
                          {new Date(endDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        </span>
                      </div>
                    )}
                    {subscription.price != null && (
                      <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                        <span className="text-sm text-gray-500 dark:text-gray-400">Price</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          ${subscription.price}
                          {(subscription.billing_cycle || subscription.billingCycle) && (
                            <span className="text-gray-400 dark:text-gray-500"> / {subscription.billing_cycle || subscription.billingCycle}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Days remaining */}
                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  {daysLeft !== null ? (
                    isExpired ? (
                      <>
                        <p className="text-5xl font-black text-red-500">0</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Days Left</p>
                        <p className="text-sm text-red-500 dark:text-red-400 mt-2 font-medium">Subscription Expired</p>
                      </>
                    ) : (
                      <>
                        <p className={`text-5xl font-black ${daysLeft <= 7 ? "text-orange-500" : "text-blue-600 dark:text-blue-400"}`}>
                          {daysLeft}
                        </p>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Days Remaining</p>
                        {daysLeft <= 7 && (
                          <p className="text-sm text-orange-500 mt-2 font-medium">Renew soon!</p>
                        )}
                      </>
                    )
                  ) : (
                    <>
                      <p className="text-5xl font-black text-gray-300 dark:text-gray-600">∞</p>
                      <p className="text-gray-500 dark:text-gray-400 mt-1">No Expiry</p>
                    </>
                  )}
                </div>
              </div>
            );
          })() : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">No active subscription found.</p>
          )}
        </section>

        {/* Security Section */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Change Password
          </h2>
          
          <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                placeholder="Enter current password"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                required
                minLength={6}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition"
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Updating...
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </section>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}