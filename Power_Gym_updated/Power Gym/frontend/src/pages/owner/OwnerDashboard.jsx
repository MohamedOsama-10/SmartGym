// src/pages/owner/OwnerDashboard.jsx (Fixed)
import React, { useState, Suspense, useEffect } from "react";
import { Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Modal from "../../components/Modal";
import { ChatProvider } from "../../context/ChatContext";
import ChatNotificationBridge from "../../components/chat/ChatNotificationBridge";
import { useProfile } from "../../context/ProfileContext";
import NotificationCenter from "../../components/NotificationCenter";
import { TotalMembersView, ActiveMembersView, CoachesView, RevenueView } from "../../components/StatDetailViews";
import CoachDirectory from "../user/CoachDirectory";
import Memberships from "../user/Memberships";
import OwnerProfile from "./OwnerProfile";
import OwnerCoachInbox from "./OwnerCoachInbox";

const ChatPage = React.lazy(() => import("../../components/chat/ChatPage"));

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

function apiGet(endpoint) {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  return fetch(`${API_BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

// Safe Profile Avatar - handles all edge cases
function ProfileAvatar() {
  const { profile, loading, isReady } = useProfile();
  const navigate = useNavigate();
  
  if (loading || !isReady) {
    return <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse ring-2 ring-orange-500/30" />;
  }
  
  if (!profile) {
    return (
      <button 
        onClick={() => navigate('/owner/profile')}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-orange-500/50 hover:ring-orange-500 transition-all"
        title="Profile unavailable"
      >
        ?
      </button>
    );
  }
  
  const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  return (
    <button 
      onClick={() => navigate('/owner/profile')}
      className="relative group"
      title={`Go to My Profile (${profile.name || 'Unknown'})`}
    >
      <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg ring-2 ring-orange-500/50 group-hover:ring-orange-500 transition-all transform group-hover:scale-105">
        {profile.avatar ? (
          <img 
            src={profile.avatar} 
            alt={profile.name || 'Profile'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold">${getInitials(profile.name)}</div>`;
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-sm font-bold">
            {getInitials(profile.name)}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
    </button>
  );
}

// Safe Welcome Header
function WelcomeHeader() {
  const { profile, loading, isReady } = useProfile();

  if (loading || !isReady) {
    return (
      <div className="space-y-2">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Owner Dashboard</h2>
        <p className="text-sm text-red-500">Profile unavailable</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
        Welcome back, {profile.name || 'Owner'}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">Manage your gym branches</p>
    </div>
  );
}

// Branches component — loads real gyms from the backend
function Branches() {
  const navigate = useNavigate();
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiGet('/gyms/')
      .then(data => { setGyms(data); setLoading(false); })
      .catch(err => {
        if (err.message.includes('401')) { navigate('/login'); return; }
        setError(err.message);
        setLoading(false);
      });
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
        <p className="text-red-500 mb-4">Failed to load gyms: {error}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Retry</button>
      </div>
    );
  }

  if (gyms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)]">
        <div className="text-6xl mb-4">🏢</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Branches Yet</h2>
        <p className="text-gray-500 dark:text-gray-400">Ask an admin to add gym branches from the admin dashboard.</p>
      </div>
    );
  }

  const API_ORIGIN = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'http://127.0.0.1:8000';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] px-4">
      <div className="text-center mb-12">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 dark:text-white mb-4">Select Your Branch</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">Choose a branch to manage its operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-7xl">
        {gyms.map((gym) => {
          const imgSrc = gym.image_url
            ? (gym.image_url.startsWith('http') ? gym.image_url : `${API_ORIGIN}${gym.image_url}`)
            : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop';
          return (
            <div
              key={gym.id}
              onClick={() => navigate(`/owner/${gym.id}`)}
              className="group cursor-pointer bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden border border-gray-100 dark:border-gray-700"
            >
              <div className="relative h-64 overflow-hidden">
                <img src={imgSrc} alt={gym.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h2 className="text-2xl font-bold text-white mb-1">{gym.name}</h2>
                  <p className="text-white/90 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {gym.location || 'No location set'}
                  </p>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{gym.description || 'No description available.'}</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{gym.total_members ?? 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">Members</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{gym.total_coaches ?? 0}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 uppercase">Coaches</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium inline-block mb-4 ${
                  gym.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {gym.status}
                </div>
                <button className="w-full py-3 bg-gray-900 dark:bg-gray-700 text-white rounded-lg font-semibold group-hover:bg-blue-600 transition-colors flex items-center justify-center gap-2">
                  Manage Branch
                  <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Admin Management Component
function AdminManagement() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const [admins, setAdmins] = useState([]);
  const [gymName, setGymName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    status: "active"
  });

  useEffect(() => {
    if (!branchId) return;
    Promise.all([
      apiGet(`/admin/gym-admins/${branchId}`),
      apiGet(`/gyms/${branchId}`),
    ])
      .then(([adminsData, gymData]) => {
        setGymName(gymData?.name || gymData?.gym_name || "");
        setAdmins(adminsData);
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [branchId]);

  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (admin.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const apiPost = (endpoint, body) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  };

  const apiDelete = (endpoint) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    return fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => { if (!r.ok && r.status !== 204) throw new Error(`HTTP ${r.status}`); });
  };

  const handleAddAdmin = async () => {
    if (!formData.name) { alert("Please enter admin name"); return; }
    setSaving(true);
    try {
      const newAdmin = await apiPost(`/gyms/${branchId}/admins`, formData);
      setAdmins(prev => [...prev, newAdmin]);
      setShowAddModal(false);
      setFormData({ name: "", email: "", phone: "", password: "", status: "active" });
    } catch (err) {
      alert(`Failed to add admin: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAdmin = async (admin) => {
    if (!window.confirm(`Remove ${admin.name} from this branch?`)) return;
    try {
      await apiDelete(`/gyms/${branchId}/admins/${admin.id}`);
      setAdmins(prev => prev.filter(a => a.id !== admin.id));
    } catch (err) {
      alert(`Failed to remove admin: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "", password: "", status: "active" });
  };

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/owner/${branchId}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Branch Admins</h2>
            <p className="text-gray-600 dark:text-gray-400">Manage administrators for this branch</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Admin
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-4 md:p-6 border-2 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase">Total Admins</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">{admins.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">A</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-4 md:p-6 border-2 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 dark:text-green-400 text-sm font-semibold uppercase">Active</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {admins.filter(a => a.status === 'active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">✓</div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl p-4 md:p-6 border-2 border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-semibold uppercase">Inactive</p>
              <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {admins.filter(a => a.status === 'inactive').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">✗</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search admins by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        <svg className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Admins Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">Failed to load admins: {error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Admin</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Contact</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Branch</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Joined</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {/* Profile picture with initials fallback */}
                        {(() => {
                          const API_ORIGIN = import.meta.env.VITE_API_URL
                            ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
                            : 'http://127.0.0.1:8000';
                          const rawUrl = admin.avatar_url || admin.profile_picture || admin.photo || admin.avatar || admin.photo_url;
                          const picUrl = rawUrl
                            ? (rawUrl.startsWith('http') ? rawUrl : `${API_ORIGIN}${rawUrl}`)
                            : null;
                          const initials = admin.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                          return (
                            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                              {picUrl ? (
                                <img
                                  src={picUrl}
                                  alt={admin.name}
                                  className="w-full h-full object-cover"
                                  onError={e => {
                                    e.target.style.display = 'none';
                                    e.target.parentNode.classList.add('flex','items-center','justify-center');
                                    e.target.parentNode.insertAdjacentText('beforeend', initials);
                                  }}
                                />
                              ) : initials}
                            </div>
                          );
                        })()}
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{admin.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">ID: #{admin.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-900 dark:text-white">{admin.email || '—'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{admin.phone || '—'}</p>
                    </td>
                    {/* Branch column */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {admin.gym_name || admin.branch_name || gymName || `Branch #${branchId}`}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        admin.status === 'active'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {admin.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {admin.joinedAt ? new Date(admin.joinedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteAdmin(admin)}
                        className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {filteredAdmins.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold text-gray-400">A</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No admins found</h3>
                <p className="text-gray-500 dark:text-gray-400">Add an admin to manage this branch</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6">
              <h3 className="text-xl font-bold text-white">Add New Admin</h3>
              <p className="text-blue-100 text-sm">Create a new administrator account</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="01XX XXX XXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAdmin}
                  disabled={saving}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {saving ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// BranchHome component — loads real gym + stats from backend
function BranchHome() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const [gym, setGym] = useState(null);
  const [stats, setStats] = useState({ totalMembers: 0, activeMembers: 0, totalCoaches: 0, todaysCheckins: 0, subscriptionsRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null);

  const API_ORIGIN = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
    : 'http://127.0.0.1:8000';

  useEffect(() => {
    setLoading(true);
    apiGet(`/gyms/${branchId}`)
      .then(gymData => {
        setGym(gymData);
        setLoading(false);
        // Load stats separately — don't let a stats failure hide the gym
        apiGet(`/gyms/${branchId}/stats`)
          .then(statsData => setStats(statsData))
          .catch(() => {}); // Stats failure is non-fatal
      })
      .catch(err => {
        console.error('Failed to load gym:', err);
        setLoading(false);
      });
  }, [branchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">Branch not found</p>
        <button onClick={() => navigate('/owner')} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
          Back to Branches
        </button>
      </div>
    );
  }

  const imgSrc = gym.image_url
    ? (gym.image_url.startsWith('http') ? gym.image_url : `${API_ORIGIN}${gym.image_url}`)
    : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop';

  return (
    <div className="flex flex-col">
      <div className="relative h-64 rounded-2xl overflow-hidden mb-8">
        <img src={imgSrc} alt={gym.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
          <div className="px-4 md:px-8">
            <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">{gym.name}</h1>
            <p className="text-white/90 text-lg">{gym.location || ''}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard title="Total Members" value={stats.totalMembers} icon="👥" color="blue" clickable={true} onClick={() => setActiveModal('totalMembers')} />
        <StatCard title="Active Members" value={stats.activeMembers} icon="✅" color="green" clickable={true} onClick={() => setActiveModal('activeMembers')} />
        <StatCard title="Training Team" value={stats.totalCoaches} icon="💪" color="purple" clickable={true} onClick={() => navigate(`coaches`)} />
        <StatCard title="Today's Check-ins" value={stats.todaysCheckins} icon="📝" color="orange" clickable={false} />
        <StatCard title="Monthly Revenue" value={`${Number(stats.subscriptionsRevenue).toLocaleString()} EGP`} icon="💰" color="emerald" clickable={true} onClick={() => setActiveModal('revenue')} />
        <StatCard title="Memberships" value="View Plans" icon="🎫" color="pink" clickable={true} onClick={() => navigate(`subscriptions`)} />
      </div>

      <Modal isOpen={activeModal === 'totalMembers'} onClose={() => setActiveModal(null)} title="All Members Details" size="xl">
        <TotalMembersView gymId={branchId} />
      </Modal>
      <Modal isOpen={activeModal === 'activeMembers'} onClose={() => setActiveModal(null)} title="Active Members" size="lg">
        <ActiveMembersView gymId={branchId} />
      </Modal>
      <Modal isOpen={activeModal === 'revenue'} onClose={() => setActiveModal(null)} title="Financial Revenue Details" size="lg">
        <RevenueView gymId={branchId} revenue={stats.subscriptionsRevenue} />
      </Modal>
    </div>
  );
}

function StatCard({ title, value, icon, color, onClick, clickable = false }) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30",
    green: "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30",
    orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30",
    emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
    pink: "bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-pink-200 dark:border-pink-800 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-100 dark:hover:bg-pink-900/30",
  };

  const baseClasses = "p-4 md:p-6 rounded-xl border-2 transition-all duration-300";
  const clickableClasses = clickable ? "cursor-pointer hover:shadow-lg transform hover:-translate-y-1" : "";

  return (
    <div onClick={onClick} className={`${baseClasses} ${colorClasses[color]} ${clickableClasses}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">{value}</p>
        </div>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl bg-white dark:bg-gray-800 shadow-sm">{icon}</div>
      </div>
      {clickable && (
        <div className="mt-4 flex items-center text-sm font-medium text-gray-600 dark:text-gray-300">
          <span>View Details</span>
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </div>
  );
}

// Coaches page wrapper
function CoachesPage() {
  const navigate = useNavigate();
  const { branchId } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/owner/${branchId}`)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Branch
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-2xl font-bold text-white">Coach Directory</h2>
          <p className="text-purple-100">Browse and manage coaches for this branch</p>
        </div>
        <div className="p-6">
          <CoachDirectory />
        </div>
      </div>
    </div>
  );
}

// Memberships page wrapper
function MembershipsPage() {
  const navigate = useNavigate();
  const { branchId } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/owner/${branchId}`)} className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Branch
        </button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-pink-600 to-rose-600">
          <h2 className="text-2xl font-bold text-white">Memberships & Subscriptions</h2>
          <p className="text-pink-100">Owner Mode: You can edit gym subscriptions and view coach packages</p>
        </div>
        <div className="p-6">
          <Memberships userRole="owner" />
        </div>
      </div>
    </div>
  );
}

// Dashboard Content with Timeout Protection
function DashboardContent() {
  const { profile, loading, isReady, error, refreshProfile } = useProfile();
  const [timeoutReached, setTimeoutReached] = useState(false);
  const navigate = useNavigate();

  // 10 second safety timeout
  useEffect(() => {
    if (loading || !isReady) {
      const timer = setTimeout(() => setTimeoutReached(true), 10000);
      return () => clearTimeout(timer);
    }
  }, [loading, isReady]);

  // Loading state
  if ((loading || !isReady) && !timeoutReached) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
        <div className="relative mb-4">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🏢</span>
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading your dashboard...</p>
        <p className="text-xs text-gray-400 mt-2">If stuck, check console (F12)</p>
      </div>
    );
  }

  // Timeout or Error state
  if (timeoutReached || error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-6">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {timeoutReached ? "Loading Timeout" : "Error Loading Profile"}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-2 text-center max-w-md">
          {timeoutReached ? "Taking longer than expected..." : (error || "Unknown error")}
        </p>
        <div className="flex gap-3 mt-4">
          <button 
            onClick={() => { setTimeoutReached(false); refreshProfile?.(); }} 
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            Retry
          </button>
          <button 
            onClick={() => navigate('/login')} 
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // No profile
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px]">
        <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">👤</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Profile Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Session may have expired</p>
        <button 
          onClick={() => navigate('/login')} 
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
        >
          Re-login
        </button>
      </div>
    );
  }

  // Success - render routes
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
        </div>
      </div>
    }>
      <Routes>
        <Route index element={<Branches />} />
        <Route path="profile" element={<OwnerProfile />} />
        <Route path=":branchId" element={<BranchHome />} />
        <Route path=":branchId/coaches" element={<CoachesPage />} />
        <Route path=":branchId/subscriptions" element={<MembershipsPage />} />
        <Route path=":branchId/admins" element={<AdminManagement />} />
        <Route path="chat" element={<ChatPage userRole="owner" />} />
        <Route path="coach-inbox" element={<OwnerCoachInbox />} />
        <Route path="*" element={<Navigate to="/owner" replace />} />
      </Routes>
    </Suspense>
  );
}

// Main Exported Component
export default function OwnerDashboard() {
  return (
    <ChatProvider>
      <ChatNotificationBridge />
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
              <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
                <WelcomeHeader />
                <div className="flex items-center gap-4">
                  <NotificationCenter />
                  <ProfileAvatar />
                </div>
              </header>

              <main className="flex-1 p-4 md:p-6 overflow-auto relative">
                <DashboardContent />
              </main>
            </div>
          </div>
    </ChatProvider>
  );
}