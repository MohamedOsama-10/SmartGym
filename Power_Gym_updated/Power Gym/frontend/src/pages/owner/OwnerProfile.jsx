// src/pages/owner/OwnerProfile.jsx
import React, { useState, useEffect } from 'react';
import { useProfile } from '../../context/ProfileContext';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const getToken = () =>
  localStorage.getItem('access_token') ||
  localStorage.getItem('token') ||
  localStorage.getItem('auth_token');

export default function OwnerProfile() {
  const { updateAvatar, refreshProfile } = useProfile();
  const { apiRequest } = useAuth();

  const [profile, setProfile] = useState({
    full_name: '', email: '', phone: '', date_of_birth: '', gender: '',
    address: '', emergency_contact_name: '',
    emergency_contact_phone: '', emergency_contact_relationship: '', profile_photo: null,
  });
  const [gymId, setGymId]           = useState(null);
  const [gyms, setGyms]             = useState([]);
  const [passwords, setPasswords]   = useState({ current: '', new: '', confirm: '' });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [savingPwd, setSavingPwd]   = useState(false);
  const [toast, setToast]           = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([
      apiRequest('/admin/profile/'),
      apiRequest('/admin/me/gym'),
      apiRequest('/gyms/'),
    ]).then(([d, gymInfo, gymList]) => {
      setProfile({
        full_name: d.full_name || '', email: d.email || '', phone: d.phone || '',
        date_of_birth: d.date_of_birth || '', gender: d.gender || '',
        address: d.address || '',
        emergency_contact_name: d.emergency_contact_name || '',
        emergency_contact_phone: d.emergency_contact_phone || '',
        emergency_contact_relationship: d.emergency_contact_relationship || '',
        profile_photo: null,
      });
      if (d.profile_photo_url) setPhotoPreview(d.profile_photo_url);
      setGymId(gymInfo.gym_id || null);
      setGyms(Array.isArray(gymList) ? gymList : (gymList.results || []));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(profile).forEach(k => {
        if (k === 'profile_photo' && profile[k]) formData.append('profile_photo', profile[k]);
        else if (k !== 'profile_photo') formData.append(k, profile[k]);
      });
      const res = await fetch(`${API_BASE_URL}/admin/profile/`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      if (data.profile_photo_url) {
        setPhotoPreview(data.profile_photo_url);
        updateAvatar(data.profile_photo_url);
      }
      // Save gym assignment separately
      await apiRequest('/admin/me/gym', {
        method: 'PUT',
        body: JSON.stringify({ gym_id: gymId }),
      });
      refreshProfile();
      showToast('Profile saved successfully');
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      showToast('All password fields are required', 'error'); return;
    }
    if (passwords.new !== passwords.confirm) {
      showToast("New passwords don't match", 'error'); return;
    }
    if (passwords.new.length < 6) {
      showToast('New password must be at least 6 characters', 'error'); return;
    }
    setSavingPwd(true);
    try {
      await apiRequest('/admin/change-password/', {
        method: 'PUT',
        body: JSON.stringify({ current_password: passwords.current, new_password: passwords.new }),
      });
      showToast('Password changed successfully');
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (e) {
      showToast(e.message, 'error');
    } finally { setSavingPwd(false); }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfile({ ...profile, profile_photo: file });
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    try {
      await apiRequest('/admin/profile/photo', { method: 'DELETE' });
      setPhotoPreview(null);
      setProfile({ ...profile, profile_photo: null });
      updateAvatar(null);
      showToast('Photo removed');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const inputCls = "w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none text-gray-900 dark:text-white transition";

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>{toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 rounded-3xl shadow-2xl p-4 md:p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px,white 1px,transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="relative z-10 flex items-center gap-4 md:gap-5">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg flex-shrink-0">👤</div>
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1">My Profile</h2>
            <p className="text-orange-100">Manage your personal and gym information</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Profile Photo + Basic Info */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 md:p-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              Profile Photo &amp; Basic Information
            </h3>
            <div className="flex flex-col md:flex-row gap-8">
              {/* Photo upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-orange-500 shadow-lg" />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-5xl font-black shadow-lg">
                      {(profile.full_name || 'O')[0].toUpperCase()}
                    </div>
                  )}
                  <label htmlFor="owner-photo-upload" className="absolute bottom-0 right-0 w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                  <input id="owner-photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </div>
                <p className="text-xs text-gray-400 text-center">Click camera to upload</p>
                {photoPreview && (
                  <button onClick={handleRemovePhoto}
                    className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Remove photo
                  </button>
                )}
              </div>

              {/* Basic fields */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  { label: '👤 Full Name',    key: 'full_name',    type: 'text',   placeholder: 'John Doe' },
                  { label: '✉️ Email',         key: 'email',        type: 'email',  placeholder: 'owner@gym.com' },
                  { label: '📞 Phone',         key: 'phone',        type: 'tel',    placeholder: '+20 123 456 7890' },
                  { label: '🎂 Date of Birth', key: 'date_of_birth',type: 'date' },
                  { label: '⚧️ Gender',        key: 'gender',       type: 'select', options: ['Male', 'Female', 'Other'] },
                ].map(({ label, key, type, placeholder, options }) => (
                  <div key={key}>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                    {type === 'select' ? (
                      <select value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })} className={inputCls}>
                        <option value="">Select...</option>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={type} value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })}
                        placeholder={placeholder} className={inputCls} />
                    )}
                  </div>
                ))}

                {/* Gym Branch dropdown */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🏢 Gym Branch</label>
                  <select value={gymId || ''} onChange={e => setGymId(e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                    <option value="">Select branch...</option>
                    {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📍 Address</label>
              <textarea value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })}
                rows={2} placeholder="123 Main Street, Cairo, Egypt"
                className={inputCls + ' resize-none'} />
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 md:p-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              🚨 Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { label: 'Name',         key: 'emergency_contact_name',         type: 'text', placeholder: 'Jane Doe' },
                { label: 'Phone',        key: 'emergency_contact_phone',        type: 'tel',  placeholder: '+20 987 654 3210' },
                { label: 'Relationship', key: 'emergency_contact_relationship', type: 'text', placeholder: 'Spouse, Sibling, etc.' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                  <input type={type} value={profile[key]} onChange={e => setProfile({ ...profile, [key]: e.target.value })}
                    placeholder={placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 md:p-8">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
              🔐 Change Password
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl">
              {[
                { label: 'Current Password',     key: 'current' },
                { label: 'New Password',         key: 'new' },
                { label: 'Confirm New Password', key: 'confirm' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                  <input type="password" value={passwords[key]} onChange={e => setPasswords({ ...passwords, [key]: e.target.value })}
                    placeholder="••••••••" className={inputCls} />
                </div>
              ))}
            </div>
            <div className="mt-6">
              <button onClick={handlePasswordChange} disabled={savingPwd}
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-red-700 transition disabled:opacity-50 flex items-center gap-2 shadow-lg">
                {savingPwd && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                🔐 Change Password
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4 md:p-8">
            <button onClick={handleSave} disabled={saving}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-700 transition disabled:opacity-50 shadow-lg flex items-center gap-2">
              {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              💾 Save Profile
            </button>
            <p className="text-xs text-gray-400 mt-3">All changes are saved directly to the database.</p>
          </div>
        </>
      )}
    </div>
  );
}
