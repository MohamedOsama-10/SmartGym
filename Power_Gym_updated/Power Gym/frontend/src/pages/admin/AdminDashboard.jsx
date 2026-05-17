// src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from "react-router-dom";
import { ChatProvider, useChat } from "../../context/ChatContext";
import ChatNotificationBridge from "../../components/chat/ChatNotificationBridge";
import NotificationCenter from "../../components/NotificationCenter";
import ThemeToggle from "../../components/ThemeToggle";
import { useProfile } from "../../context/ProfileContext";
import { useNotifications } from "../../context/NotificationContext";

// Lazy load pages
const ChatPage = React.lazy(() => import("../../components/chat/ChatPage"));
const AdminProfile = React.lazy(() => import("./AdminProfile"));

// ── API helpers ──────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const getToken = () => localStorage.getItem('access_token');

const apiRequest = async (endpoint, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (response.status === 401) { localStorage.clear(); window.location.href = '/login'; throw new Error('Session expired'); }
  if (!response.ok) { const e = await response.json(); throw new Error(e.detail || 'Request failed'); }
  return response.status === 204 ? null : response.json();
};

const dashboardAPI = {
  getStats: () => apiRequest('/dashboard/stats'),
  getRecentActivities: (limit = 10) => apiRequest(`/dashboard/activities?limit=${limit}`),
};

// Admin Sidebar Component
// Mobile-responsive wrapper for AdminSidebar
function MobileAdminSidebar() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  React.useEffect(() => { setOpen(false); }, [pathname]);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-xl shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && <div className="md:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setOpen(false)} />}
      <aside className={`md:hidden fixed top-0 left-0 h-full w-72 bg-gray-900 dark:bg-gray-950 text-white flex flex-col z-50 transform transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div><h1 className="text-xl font-bold text-white">Admin Panel</h1></div>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { path: "/admin", icon: "🏠", label: "Dashboard", end: true },
            { path: "/admin/users", icon: "👥", label: "User Management" },
            { path: "/admin/branches", icon: "🏢", label: "Branches" },
            { path: "/admin/coaches", icon: "💪", label: "Coaches Directory" },
            { path: "/admin/memberships", icon: "🎫", label: "Memberships" },
            { path: "/admin/subscriptions", icon: "💰", label: "Finance & Subscriptions" },
            { path: "/admin/reports", icon: "📊", label: "Reports & Analytics" },
            { path: "/admin/chat", icon: "💬", label: "Messages" },
            { path: "/admin/profile", icon: "👤", label: "My Profile" },
          ].map((item) => (
            <Link key={item.path} to={item.path} className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 hover:bg-gray-800 hover:text-white transition-all">
              <span className="text-lg w-5 text-center">{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => window.location.href='/logout'} className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}

function AdminSidebar() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { conversations } = useChat();
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const sidebarName = profile?.name || currentUser.full_name || currentUser.name || 'Admin';
  const sidebarInitials = sidebarName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  const sidebarRole = currentUser.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'Administrator';
  const sidebarAvatar = profile?.avatar || profile?.avatar_url || null;

  // Total unread messages across all conversations
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // Pending request counts for sidebar badges
  const [pendingSubRequests, setPendingSubRequests] = useState(0);
  const [pendingCoachPkgs, setPendingCoachPkgs] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

    const fetchCounts = () => {
      fetch(`${base}/admin/subscription-requests`, { headers })
        .then(r => r.ok ? r.json() : [])
        .then(data => setPendingSubRequests(Array.isArray(data) ? data.filter(r => r.status === 'pending').length : 0))
        .catch(() => {});

      fetch(`${base}/admin/coach-packages?status=pending`, { headers })
        .then(r => r.ok ? r.json() : [])
        .then(data => setPendingCoachPkgs(Array.isArray(data) ? data.length : 0))
        .catch(() => {});
    };

    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { path: "/admin", icon: "🏠", label: "Dashboard", end: true },
    { path: "/admin/users", icon: "👥", label: "User Management" },
    { path: "/admin/branches", icon: "🏢", label: "Branches" },
    { path: "/admin/coaches", icon: "💪", label: "Coaches Directory" },
    { path: "/admin/memberships", icon: "🎫", label: "Memberships", badge: pendingCoachPkgs },
    { path: "/admin/subscriptions", icon: "💰", label: "Finance & Subscriptions", badge: pendingSubRequests },
    { path: "/admin/reports", icon: "📊", label: "Reports & Analytics" },
    { path: "/admin/chat", icon: "💬", label: "Messages", badge: totalUnreadMessages },
    { path: "/admin/profile", icon: "👤", label: "My Profile" },
  ];

  return (
    <aside className="hidden md:flex w-72 bg-gray-900 dark:bg-gray-950 text-white min-h-screen flex-col transition-colors duration-300">
      {/* Logo Area */}
      <div className="p-6 border-b border-gray-800 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-xs text-gray-400">Management System</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-800 dark:border-gray-800">
        <Link to="/admin/profile" className="flex items-center gap-3 px-2 hover:opacity-80 transition">
          {sidebarAvatar ? (
            <img src={sidebarAvatar} alt="Profile" className="w-10 h-10 rounded-full object-cover shadow-lg" />
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
              {sidebarInitials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{sidebarName}</p>
            <p className="text-xs text-gray-400 capitalize">{sidebarRole}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            icon={item.icon}
            label={item.label}
            badge={item.badge}
          />
        ))}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-gray-800 dark:border-gray-800 space-y-2">
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gray-800/50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-300">Dark Mode</span>
          <ThemeToggle />
        </div>
        <button
          onClick={() => navigate('/logout')}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}

// NavLink Component
function NavLink({ to, end, icon, label, badge }) {
  const { pathname } = useLocation();
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(to + '/');

  const linkClass = `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
    isActive
      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
      : "text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-800 hover:text-white"
  }`;

  return (
    <Link to={to} className={linkClass}>
      <span className="text-lg w-5 text-center">{icon}</span>
      <span className="font-medium whitespace-nowrap flex-1">{label}</span>
      {badge > 0 && (
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${
          isActive ? "bg-white/25 text-white" : "bg-red-500 text-white"
        }`}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

// Activity Feed Component
function ActivityFeed({ activities }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
      </div>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center text-lg">
                {activity.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">{activity.user}</span>
                  {' '}{activity.action}{' '}
                  <span className="font-medium text-blue-600 dark:text-blue-400">{activity.target}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Admin Home Component
function AdminHome({ stats }) {
  const navigate = useNavigate();
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const kpiCards = [
    {
      label: "Total Users", value: stats.totalUsers, unit: "registered",
      to: "/admin/users",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      gradient: "from-blue-500 to-cyan-500", light: "from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20",
      border: "border-blue-200 dark:border-blue-800", text: "text-blue-600 dark:text-blue-400", hoverRing: "hover:ring-blue-300 dark:hover:ring-blue-700",
    },
    {
      label: "Active Members", value: stats.activeMembers, unit: "currently active",
      to: "/admin/users",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      gradient: "from-emerald-500 to-teal-500", light: "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20",
      border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-600 dark:text-emerald-400", hoverRing: "hover:ring-emerald-300 dark:hover:ring-emerald-700",
    },
    {
      label: "Total Revenue", value: `${(stats.totalRevenue || 0).toLocaleString()}`, unit: "EGP earned",
      to: "/admin/subscriptions",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      gradient: "from-violet-500 to-purple-600", light: "from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20",
      border: "border-violet-200 dark:border-violet-800", text: "text-violet-600 dark:text-violet-400", hoverRing: "hover:ring-violet-300 dark:hover:ring-violet-700",
    },
    {
      label: "Branches", value: stats.branches, unit: "locations",
      to: "/admin/branches",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
      gradient: "from-orange-500 to-amber-500", light: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20",
      border: "border-orange-200 dark:border-orange-800", text: "text-orange-600 dark:text-orange-400", hoverRing: "hover:ring-orange-300 dark:hover:ring-orange-700",
    },
    {
      label: "Coaches", value: stats.coaches, unit: "trainers",
      to: "/admin/coaches",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      gradient: "from-rose-500 to-pink-600", light: "from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20",
      border: "border-rose-200 dark:border-rose-800", text: "text-rose-600 dark:text-rose-400", hoverRing: "hover:ring-rose-300 dark:hover:ring-rose-700",
    },
    {
      label: "Pending Requests", value: stats.pendingApprovals, unit: "need review",
      to: "/admin/subscriptions",
      icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      gradient: "from-amber-500 to-yellow-500", light: "from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20",
      border: "border-amber-200 dark:border-amber-800", text: "text-amber-600 dark:text-amber-400", hoverRing: "hover:ring-amber-300 dark:hover:ring-amber-700",
      badge: stats.pendingApprovals > 0,
    },
  ];

  const quickActions = [
    { label: "Add User", desc: "Register new member", to: "/admin/users", gradient: "from-blue-500 to-indigo-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg> },
    { label: "New Branch", desc: "Open a location", to: "/admin/branches", gradient: "from-emerald-500 to-teal-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
    { label: "Coaches", desc: "Manage trainers", to: "/admin/coaches", gradient: "from-purple-500 to-violet-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { label: "Memberships", desc: "Plans & pricing", to: "/admin/memberships", gradient: "from-pink-500 to-rose-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg> },
    { label: "Finance", desc: "Revenue & subs", to: "/admin/subscriptions", gradient: "from-amber-500 to-orange-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { label: "Reports", desc: "Analytics & stats", to: "/admin/reports", gradient: "from-cyan-500 to-blue-600", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
  ];

  return (
    <div className="space-y-7 animate-fadeIn">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl shadow-2xl">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "30px 30px" }} />
        {/* Glowing orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

        <div className="relative z-10 p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Avatar icon */}
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-xl shadow-indigo-900/50">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <p className="text-indigo-300 text-sm font-semibold tracking-wide uppercase">{greeting}</p>
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white mt-0.5 tracking-tight">Administrator</h1>
                <p className="text-slate-400 text-sm mt-1">{dateStr}</p>
              </div>
            </div>

            {/* Right: mini stat pills */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Users", value: stats.totalUsers, color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
                { label: "Revenue", value: `${(stats.totalRevenue || 0).toLocaleString()} EGP`, color: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
                { label: "Pending", value: stats.pendingApprovals, color: stats.pendingApprovals > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
              ].map(p => (
                <div key={p.label} className={`px-4 py-2.5 rounded-2xl border backdrop-blur-sm ${p.color} flex flex-col items-center min-w-[80px]`}>
                  <span className="text-xl font-black">{p.value}</span>
                  <span className="text-xs font-medium opacity-80 mt-0.5">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Quick Actions</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map(a => (
            <Link key={a.label} to={a.to}
              className="group flex flex-col items-center gap-2.5 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
                {a.icon}
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{a.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3 px-1">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpiCards.map(card => (
            <Link key={card.label} to={card.to}
              className={`group relative overflow-hidden bg-gradient-to-br ${card.light} rounded-2xl border-2 ${card.border} p-5 hover:shadow-xl hover:-translate-y-0.5 ring-2 ring-transparent ${card.hoverRing} transition-all duration-300`}>
              {/* icon */}
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              {/* badge for pending */}
              {card.badge && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
              <div className={`text-2xl font-black ${card.text} mb-0.5`}>{card.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{card.unit}</div>
              <div className={`text-xs font-bold ${card.text} mt-2`}>{card.label}</div>
              {/* arrow */}
              <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity ${card.text}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Bottom Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Recent Activity</h3>
              </div>
              <Link to="/admin/reports" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">View all →</Link>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {stats.activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <svg className="w-12 h-12 mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium">No recent activity</p>
                </div>
              ) : (
                stats.activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-base shrink-0">
                      {activity.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        <span className="font-semibold">{activity.user}</span>
                        {' '}<span className="text-gray-500 dark:text-gray-400">{activity.action}</span>{' '}
                        <span className="font-medium text-indigo-600 dark:text-indigo-400">{activity.target}</span>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{activity.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-750">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">System Status</h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: "All Systems", status: "Operational", dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400" },
              { icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>, label: "Database", status: "Healthy", dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400" },
              { icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>, label: "Security", status: "Protected", dot: "bg-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-400" },
              { icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>, label: "API", status: "Online", dot: "bg-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-600 dark:text-cyan-400" },
            ].map(item => (
              <div key={item.label} className={`flex items-center justify-between p-3 rounded-xl ${item.bg}`}>
                <div className={`flex items-center gap-2.5 ${item.text}`}>
                  {item.icon}
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.dot} animate-pulse`} />
                  <span className={`text-xs font-bold ${item.text}`}>{item.status}</span>
                </div>
              </div>
            ))}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">Uptime</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">99.9%</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full w-[99.9%] bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ FIXED: User Management Component — role state matches button labels + BRANCH SELECTION ADDED
function UserManagement() {
  const { addNotification } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ✅ NEW: Branches state for dropdown
  const [branches, setBranches] = useState([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState([]);

  // ✅ FIX 1: Initial role is "Member" to match button labels (was "user")
  const [newUser, setNewUser] = useState({
    name: "",
    membershipId: "",
    staffId: "",
    status: "Active",
    role: "Member",
    gym_id: "",
    plan_id: "",
  });

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // user object to delete
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    membershipId: "",
    role: "Member",
    status: "Active",
    gym_id: "" // ✅ NEW: Branch selection for edit
  });
  const [editErrors, setEditErrors] = useState({});
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
  const getToken = () => localStorage.getItem('access_token');

  const apiRequest = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      let detail = `Request failed (${response.status})`;
      try {
        const errData = await response.json();
        if (errData.detail) detail = errData.detail;
      } catch (_) { /* non-JSON error body */ }
      throw new Error(detail);
    }

    return response.status === 204 ? null : await response.json();
  };

  useEffect(() => {
    loadUsers();
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoadingBranches(true);
      const [gymsData, gymInfo, plansData] = await Promise.all([
        apiRequest('/gyms/'),
        apiRequest('/admin/me/gym').catch(() => ({ gym_id: null })),
        apiRequest('/admin/membership-plans/').catch(() => []),
      ]);
      setBranches(gymsData);
      setMembershipPlans(Array.isArray(plansData) ? plansData.filter(p => p.is_active !== false) : []);
      // Pre-select admin's own branch when opening Add User modal
      if (gymInfo.gym_id) {
        setNewUser(prev => ({ ...prev, gym_id: String(gymInfo.gym_id) }));
      }
    } catch (err) {
      console.error("Error loading branches:", err);
      setBranches([]);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = {};
      if (filter !== 'all') params.role = filter;
      if (searchQuery) params.search = searchQuery;

      const queryString = new URLSearchParams(params).toString();
      const data = await apiRequest(`/admin/users/?${queryString}`);
      setUsers(data);
    } catch (err) {
      setError(err.message);
      console.error("Error loading users:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [filter, searchQuery]);

  const validateForm = () => {
    const errors = {};
    if (!newUser.name.trim()) {
      errors.name = "Full name is required";
    } else if (newUser.name.length < 3) {
      errors.name = "Name must be at least 3 characters";
    }
    if (newUser.role === 'Member') {
      if (!newUser.membershipId.trim()) {
        errors.membershipId = "Membership ID is required for members";
      }
    } else {
      if (!newUser.staffId.trim()) {
        errors.staffId = "Staff ID is required";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      // ✅ FIX 2: Map display labels to backend role values
      const roleMap = {
        'Member': 'user',
        'Coach': 'coach',
        'Owner': 'owner',
        'Admin': 'admin'
      };

      const backendRole = roleMap[newUser.role] || 'user';

      let createdUser;
      if (backendRole === 'coach') {
        // Coaches use the dedicated endpoint with staff_id
        createdUser = await apiRequest('/admin/coaches/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: newUser.name,
            staff_id: newUser.staffId,
            status: newUser.status,
            ...(newUser.gym_id && { gym_id: parseInt(newUser.gym_id) }),
          }),
        });
      } else {
        // Member uses membershipId; Admin/Owner use staffId stored as membership_id
        // so the placeholder email encodes the ID and claim-account can find them
        const idField = newUser.role === 'Member' ? newUser.membershipId : newUser.staffId;
        createdUser = await apiRequest('/admin/users/', {
          method: 'POST',
          body: JSON.stringify({
            full_name: newUser.name,
            role: backendRole,
            status: newUser.status,
            ...(idField && { membership_id: idField }),
            ...(newUser.gym_id && { gym_id: parseInt(newUser.gym_id) }),
          }),
        });
      }

      // If a plan was selected for a Member, create subscription immediately
      if (newUser.role === 'Member' && newUser.plan_id && createdUser?.id) {
        try {
          await apiRequest('/admin/subscriptions', {
            method: 'POST',
            body: JSON.stringify({ user_id: createdUser.id, plan_id: parseInt(newUser.plan_id) }),
          });
        } catch (subErr) {
          console.warn("Subscription creation failed:", subErr.message);
          // non-fatal — user was still created
        }
      }

      // ✅ FIX 3: Refresh the list after creation so new user appears
      await loadUsers();

      setNewUser(prev => ({
        name: "", membershipId: "", staffId: "",
        status: "Active", role: "Member", gym_id: prev.gym_id, plan_id: "",
      }));

      setIsModalOpen(false);
      const assignedId = newUser.role === 'Member' ? newUser.membershipId : newUser.staffId;
      const msg = newUser.role === 'Member'
        ? `Member "${newUser.name}" created! They can sign up using Membership ID: ${assignedId}`
        : `${newUser.role} "${newUser.name}" created! They can sign up using Staff ID: ${assignedId}`;
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(""), 5000);
      addNotification({ title: "User Created", message: msg });

    } catch (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('membership id')) {
        setFormErrors({ membershipId: msg });
      } else if (msg.toLowerCase().includes('staff id')) {
        setFormErrors({ staffId: msg });
      } else if (msg.toLowerCase().includes('email')) {
        setFormErrors({ email: msg });
      } else {
        setFormErrors({ submit: msg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadUsers();
      setSuccessMessage(`User "${deleteTarget.full_name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(""), 4000);
      addNotification({ title: "User Deleted", message: `User "${deleteTarget.full_name}" was removed` });
    } catch (error) {
      setSuccessMessage("Failed to delete: " + error.message);
      setTimeout(() => setSuccessMessage(""), 4000);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeModal = () => {
    if (!isSubmitting) {
      setIsModalOpen(false);
      setNewUser({ name: "", membershipId: "", staffId: "", status: "Active", role: "Member", gym_id: "" });
      setFormErrors({});
    }
  };

  // Reverse map: backend role → display label
  const roleToLabel = { 'user': 'Member', 'coach': 'Coach', 'owner': 'Owner', 'admin': 'Admin' };
  const labelToRole = { 'Member': 'user', 'Coach': 'coach', 'Owner': 'owner', 'Admin': 'admin' };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.full_name,
      membershipId: user.membership_id || "",
      role: roleToLabel[user.role] || "Member",
      status: user.status || "Active",
      gym_id: user.gym_id ? String(user.gym_id) : "" // ✅ NEW: Pre-fill branch
    });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (!isEditSubmitting) {
      setIsEditModalOpen(false);
      setEditingUser(null);
      setEditErrors({});
    }
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editForm.name.trim()) {
      errors.name = "Full name is required";
    } else if (editForm.name.length < 3) {
      errors.name = "Name must be at least 3 characters";
    }
    if (editForm.membershipId && !/^\d+$/.test(editForm.membershipId)) {
      errors.membershipId = "ID must contain only digits";
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!validateEditForm()) return;
    setIsEditSubmitting(true);
    try {
      await apiRequest(`/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: editForm.name,
          membership_id: editForm.membershipId || null,
          role: labelToRole[editForm.role] || 'user',
          status: editForm.status,
          gym_id: editForm.gym_id ? parseInt(editForm.gym_id) : null // ✅ NEW: Include branch in edit
        }),
      });
      await loadUsers();
      setIsEditModalOpen(false);
      setEditingUser(null);
      setSuccessMessage(`User "${editForm.name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(""), 5000);
      addNotification({ title: "User Updated", message: `User "${editForm.name}" was updated` });
    } catch (error) {
      const msg = error.message || '';
      if (msg.toLowerCase().includes('membership id')) {
        setEditErrors({ membershipId: msg });
      } else {
        setEditErrors({ submit: msg });
      }
    } finally {
      setIsEditSubmitting(false);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Success Message */}
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 max-w-md animate-fadeIn">
          <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Success!</p>
              <p className="text-sm text-green-100">{successMessage}</p>
            </div>
            <button onClick={() => setSuccessMessage("")} className="ml-2 text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-2">User Management</h2>
            <p className="text-indigo-100">Manage all users across the system</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition shadow-lg flex items-center gap-2 hover:scale-105 transform"
          >
            <span className="text-xl">➕</span>
            Add New User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or membership ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="user">Members</option>
            <option value="coach">Coaches</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
          Error loading users: {error}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">User</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Membership ID</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Branch</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Role</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Joined</th>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {users.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-4xl">👥</span>
                    <p>No users found. Add your first user to get started!</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.filter(u => u.role === "user" || u.role === "coach").map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user.full_name}</p>
                        {/* ✅ Shows "Not registered yet" for pending users */}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {user.email || (
                            <span className="text-yellow-600 dark:text-yellow-400 italic">Not registered yet</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* ✅ NEW: Membership ID column */}
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-lg">
                      {user.membership_id || '—'}
                    </span>
                  </td>
                  {/* ✅ NEW: Branch column */}
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {user.gym_name || user.branch_name || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                      user.role === 'coach' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      user.role === 'owner' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role === 'user' ? 'Member' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      user.status === 'Inactive' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(user)}
                        className="px-3 py-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Add New User</h3>
                    <p className="text-indigo-100 text-sm">Create basic profile — user completes signup</p>
                  </div>
                </div>
                <button onClick={closeModal} disabled={isSubmitting} className="text-white/80 hover:text-white transition disabled:opacity-50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formErrors.submit && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
                  {formErrors.submit}
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {newUser.role === 'Member'
                    ? 'Assign a Membership ID — the member uses it on the Sign Up page to activate their account.'
                    : `Assign a Staff ID — the ${newUser.role.toLowerCase()} uses it on the Sign Up page to activate their account.`}
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={newUser.name}
                    onChange={handleInputChange}
                    placeholder="Enter full name"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                      formErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-transparent'
                    }`}
                    disabled={isSubmitting}
                  />
                </div>
                {formErrors.name && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formErrors.name}
                  </p>
                )}
              </div>

              {/* Membership ID — Member only */}
              {newUser.role === 'Member' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-wrap">
                    Membership ID <span className="text-red-500">*</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                      Next suggested: {(() => { const memIds = users.map(u => parseInt(u.membership_id, 10)).filter(n => !isNaN(n)); if (memIds.length > 0) return Math.max(...memIds) + 1; const userIds = users.map(u => u.id).filter(Boolean); return userIds.length > 0 ? Math.max(...userIds) + 1 : 1001; })()}
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3 3 0 01-3-3m5 0a3 3 0 013 3" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      name="membershipId"
                      value={newUser.membershipId}
                      onChange={handleInputChange}
                      placeholder="e.g., 1234"
                      className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono ${
                        formErrors.membershipId ? 'border-red-500 focus:ring-red-500' : 'border-transparent'
                      }`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {formErrors.membershipId && (
                    <p className="text-red-500 text-sm flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.membershipId}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400">Member will use this ID to complete signup</p>
                </div>
              )}

              {/* Staff ID — Coach / Admin / Owner */}
              {newUser.role !== 'Member' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Staff ID <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3 3 0 01-3-3m5 0a3 3 0 013 3" />
                      </svg>
                    </div>
                    <input
                      type="text" name="staffId" value={newUser.staffId} onChange={handleInputChange}
                      placeholder={`e.g. ${newUser.role.toUpperCase()}-001`} disabled={isSubmitting}
                      className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono ${formErrors.staffId ? 'border-red-500 focus:ring-red-500' : 'border-transparent'}`}
                    />
                  </div>
                  {formErrors.staffId && <p className="text-red-500 text-sm">{formErrors.staffId}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400">{newUser.role} will use this ID on the Sign Up page to activate their account</p>
                </div>
              )}

              {/* Branch Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Branch <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <select
                    name="gym_id"
                    value={newUser.gym_id}
                    onChange={handleInputChange}
                    disabled={isSubmitting || isLoadingBranches}
                    className={`w-full pl-12 pr-10 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer ${
                      formErrors.gym_id ? 'border-red-500 focus:ring-red-500' : 'border-transparent'
                    } ${isLoadingBranches ? 'opacity-60' : ''}`}
                  >
                    <option value="">
                      {isLoadingBranches ? 'Loading branches...' : 'Select a branch'}
                    </option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.location ? `— ${branch.location}` : ''}
                      </option>
                    ))}
                  </select>
                  {/* Custom dropdown arrow */}
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {formErrors.gym_id && (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formErrors.gym_id}
                  </p>
                )}
                {branches.length === 0 && !isLoadingBranches && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ No branches available. Please create a branch first.
                  </p>
                )}
              </div>

              {/* Membership Plan — Member only */}
              {newUser.role === 'Member' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Membership Plan <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                    <select
                      name="plan_id"
                      value={newUser.plan_id}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                      className="w-full pl-12 pr-10 py-3 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">No plan (assign later)</option>
                      {membershipPlans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {p.price} EGP{p.period ? ` / ${p.period}` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  {newUser.plan_id && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      An active subscription will be created automatically
                    </p>
                  )}
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {/* ✅ FIX 6: Buttons use display labels that match state */}
                  {['Member', 'Coach', 'Owner', 'Admin'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewUser(prev => ({ ...prev, role }))}
                      disabled={isSubmitting}
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        newUser.role === role
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'Active', icon: '✅' },
                    { value: 'Inactive', icon: '❌' },
                    { value: 'Pending', icon: '⏳' }
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setNewUser(prev => ({ ...prev, status: s.value }))}
                      disabled={isSubmitting}
                      className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        newUser.status === s.value
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{s.icon}</span>
                      {s.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Create User</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeEditModal}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn max-h-[90vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Edit User</h3>
                    <p className="text-teal-100 text-sm truncate max-w-xs">{editingUser.full_name}</p>
                  </div>
                </div>
                <button onClick={closeEditModal} disabled={isEditSubmitting} className="text-white/80 hover:text-white transition disabled:opacity-50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {editErrors.submit && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">
                  {editErrors.submit}
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, name: e.target.value }));
                      if (editErrors.name) setEditErrors(prev => ({ ...prev, name: "" }));
                    }}
                    placeholder="Enter full name"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all ${
                      editErrors.name ? 'border-red-500' : 'border-transparent'
                    }`}
                    disabled={isEditSubmitting}
                  />
                </div>
                {editErrors.name && <p className="text-red-500 text-sm">{editErrors.name}</p>}
              </div>

              {/* Membership ID */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Membership ID</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={editForm.membershipId}
                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, membershipId: e.target.value }));
                      if (editErrors.membershipId) setEditErrors(prev => ({ ...prev, membershipId: "" }));
                    }}
                    placeholder="e.g., 1234"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-mono ${
                      editErrors.membershipId ? 'border-red-500' : 'border-transparent'
                    }`}
                    disabled={isEditSubmitting}
                  />
                </div>
                {editErrors.membershipId && <p className="text-red-500 text-sm">{editErrors.membershipId}</p>}
              </div>

              {/* ✅ NEW: Branch Selection in Edit */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Branch</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <select
                    value={editForm.gym_id}
                    onChange={(e) => setEditForm(prev => ({ ...prev, gym_id: e.target.value }))}
                    disabled={isEditSubmitting || isLoadingBranches}
                    className="w-full pl-12 pr-10 py-3 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">— No branch assigned —</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} {branch.location ? `— ${branch.location}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Member', 'Coach', 'Owner', 'Admin'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, role }))}
                      disabled={isEditSubmitting}
                      className={`py-3 px-4 rounded-xl font-medium transition-all ${
                        editForm.role === role
                          ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'Active', icon: '✅' },
                    { value: 'Inactive', icon: '❌' },
                    { value: 'Pending', icon: '⏳' }
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, status: s.value }))}
                      disabled={isEditSubmitting}
                      className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                        editForm.status === s.value
                          ? 'bg-teal-600 text-white shadow-lg'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{s.icon}</span>{s.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isEditSubmitting}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {isEditSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🗑️</div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Delete User?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This will permanently delete <span className="font-bold text-gray-900 dark:text-white">{deleteTarget.full_name}</span>. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  COACH MANAGEMENT PAGE  (full CRUD + sends coach notifications)
// ═══════════════════════════════════════════════════════════════
function CoachesPage() {
  const { addNotification } = useNotifications();
  const [coaches, setCoaches] = useState([]);
  const [gyms, setGyms]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [modal, setModal]     = useState(null); // null | { mode:'add'|'edit'|'delete', coach?:{} }
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  // Max trainees inline editing
  const [maxTraineesEdit, setMaxTraineesEdit] = useState({}); // { [coachId]: value }
  // Profile modal
  const [profileModal, setProfileModal] = useState(null); // null | coach full profile data
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileEdit, setProfileEdit] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);

  const EMPTY_FORM = {
    full_name: "", staff_id: "", experience_years: "",
    hourly_rate: "", gym_id: "", specialization: "", status: "Active",
  };
  const [form, setForm] = useState(EMPTY_FORM);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [c, g] = await Promise.all([
        apiRequest("/admin/coaches/"),
        apiRequest("/gyms/"),
      ]);
      setCoaches(c);
      setGyms(g);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY_FORM); setModal({ mode: "add" }); };
  const openEdit = (c) => {
    setForm({
      full_name: c.full_name ?? "",
      staff_id: c.staff_id ?? "",
      experience_years: c.experience_years ?? "",
      hourly_rate: c.hourly_rate ?? "",
      gym_id: c.gym_id ?? "",
      specialization: c.specialization ?? "",
      status: c.status ?? "Active",
    });
    setModal({ mode: "edit", coach: c });
  };
  const openDelete = (c) => setModal({ mode: "delete", coach: c });
  const closeModal = () => { setModal(null); setSaving(false); };

  const openProfile = async (c) => {
    setProfileLoading(true);
    setProfileModal({ loading: true, full_name: c.full_name, avatar_url: c.avatar_url });
    try {
      const data = await apiRequest(`/admin/coaches/${c.id}/profile`);
      setProfileModal(data);
      setProfileEdit({
        full_name: data.full_name ?? "",
        experience_years: data.experience_years ?? "",
        hourly_rate: data.hourly_rate ?? "",
        specialization: data.specialty ?? "",
        status: data.is_available ? "Active" : "Inactive",
      });
    } catch (e) {
      showToast(e.message, "error");
      setProfileModal(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const saveProfileEdit = async () => {
    if (!profileModal?.id) return;
    setProfileSaving(true);
    try {
      await apiRequest(`/admin/coaches/${profileModal.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: profileEdit.full_name || null,
          experience_years: profileEdit.experience_years !== "" ? +profileEdit.experience_years : null,
          hourly_rate: profileEdit.hourly_rate !== "" ? +profileEdit.hourly_rate : null,
          specialization: profileEdit.specialization || null,
          status: profileEdit.status || null,
        }),
      });
      setProfileModal(prev => ({
        ...prev,
        full_name: profileEdit.full_name,
        experience_years: profileEdit.experience_years !== "" ? +profileEdit.experience_years : null,
        hourly_rate: profileEdit.hourly_rate !== "" ? +profileEdit.hourly_rate : null,
        specialty: profileEdit.specialization,
        is_available: profileEdit.status === "Active",
      }));
      showToast("Coach updated successfully");
      addNotification({ title: "Coach Updated", message: `Coach profile updated successfully` });
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await apiRequest("/admin/coaches/", {
          method: "POST",
          body: JSON.stringify({
            full_name: form.full_name,
            staff_id: form.staff_id,
            experience_years: form.experience_years ? +form.experience_years : null,
            hourly_rate: form.hourly_rate ? +form.hourly_rate : null,
            gym_id: form.gym_id ? +form.gym_id : null,
            specialization: form.specialization || null,
            status: form.status,
          }),
        });
        showToast("Coach added successfully");
        addNotification({ title: "Coach Added", message: `Coach "${form.full_name}" was added to the directory` });
      } else {
        await apiRequest(`/admin/coaches/${modal.coach.id}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: form.full_name || null,
            experience_years: form.experience_years ? +form.experience_years : null,
            hourly_rate: form.hourly_rate ? +form.hourly_rate : null,
            gym_id: form.gym_id ? +form.gym_id : null,
            specialization: form.specialization || null,
            status: form.status || null,
          }),
        });
        showToast("Coach updated — notification sent to coach");
        addNotification({ title: "Coach Updated", message: `Coach "${form.full_name}" was updated` });
      }
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await apiRequest(`/admin/coaches/${modal.coach.id}`, { method: "DELETE" });
      showToast("Coach removed — notification sent to coach", "warning");
      addNotification({ title: "Coach Removed", message: `Coach "${modal.coach.full_name}" was removed from the directory` });
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveMaxTrainees = async (coachId) => {
    const val = maxTraineesEdit[coachId];
    if (val === undefined || val === "") return;
    try {
      await apiRequest(`/admin/coaches/${coachId}/max-trainees`, {
        method: "PUT",
        body: JSON.stringify({ max_clients: parseInt(val) }),
      });
      showToast("Max trainees updated");
      addNotification({ title: "Max Trainees Updated", message: `Coach's maximum trainees limit was updated to ${val}` });
      setMaxTraineesEdit(prev => { const n = { ...prev }; delete n[coachId]; return n; });
      load();
    } catch (e) {
      showToast(e.message, "error");
    }
  };

  const filtered = coaches.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.gym_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (s) => {
    const map = { Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                  Inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                  Pending:  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
    return map[s] || map.Inactive;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-3xl shadow-2xl p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px,white 1px,transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1">Coach Directory</h2>
            <p className="text-purple-100">Add, edit or remove coaches — changes notify each coach automatically</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-6 py-3 bg-white text-purple-700 font-bold rounded-2xl shadow-lg hover:bg-purple-50 transition-all hover:scale-105 active:scale-95">
            <span className="text-xl">➕</span> Add Coach
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 transition-all ${
          toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-amber-500" : "bg-emerald-500"
        }`}>
          <span>{toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
        <div className="relative">
          <svg className="w-5 h-5 text-gray-400 absolute left-4 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search coaches by name, email or branch…"
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-0 focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" />
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700">
          <div className="text-6xl mb-4">💪</div>
          <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">No coaches yet</p>
          <p className="text-gray-400 mt-1 mb-6">Click "Add Coach" to register the first coach</p>
          <button onClick={openAdd} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition">
            ➕ Add Coach
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(c => (
            <div key={c.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden hover:shadow-2xl transition-all duration-300 border-gray-200 dark:border-gray-700">

              {/* Gradient header — same as Find Coach */}
              <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden">
                    {c.avatar_url ? (
                      <img src={c.avatar_url.startsWith('/') ? `http://127.0.0.1:8000${c.avatar_url}` : c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                    ) : (
                      (c.full_name || "?")[0].toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold mb-1 truncate">{c.full_name}</h3>
                    <p className="text-sm opacity-90 mb-2 truncate">{c.specialization || c.specialty || "General Fitness"}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge(c.status)}`}>
                        {c.status || "Active"}
                      </span>
                      {c.gym_name && (
                        <span className="text-xs opacity-80 truncate">📍 {c.gym_name}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 truncate">
                  {c.email || (c.staff_id ? `Staff ID: ${c.staff_id}` : "—")}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{c.experience_years ?? "—"}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Yrs Exp</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                      {c.hourly_rate != null ? `$${c.hourly_rate}` : "—"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Per Hour</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className="text-xl font-bold text-green-600 dark:text-green-400">
                      {c.current_clients ?? 0}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Trainees</p>
                  </div>
                </div>

                {/* Max trainees inline edit */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">Max trainees:</span>
                  <input
                    type="number" min="0"
                    value={maxTraineesEdit[c.id] !== undefined ? maxTraineesEdit[c.id] : (c.max_clients ?? 30)}
                    onChange={e => setMaxTraineesEdit(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className="w-16 px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-1 focus:ring-purple-500 text-gray-900 dark:text-white text-center"
                  />
                  <button
                    onClick={() => saveMaxTrainees(c.id)}
                    disabled={maxTraineesEdit[c.id] === undefined}
                    className="px-2 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-40"
                    title="Save"
                  >✓</button>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button onClick={() => openProfile(c)}
                    className="flex-1 py-2.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl font-medium hover:bg-purple-100 dark:hover:bg-purple-900/40 transition text-sm">
                    👤 Profile
                  </button>
                  <button onClick={() => openDelete(c)}
                    className="py-2.5 px-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition text-sm">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && modal.mode !== "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {modal.mode === "add" ? "➕ Add New Coach" : `✏️ Edit Coach — ${modal.coach?.full_name}`}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Full Name", key: "full_name", type: "text", placeholder: "e.g. Hassan Ahmed" },
                ...(modal.mode === "add" ? [
                  { label: "Staff ID", key: "staff_id", type: "text", placeholder: "e.g. COACH-001 (coach uses this to sign up)" },
                ] : [
                  { label: "Experience (years)", key: "experience_years", type: "number", placeholder: "e.g. 5" },
                  { label: "Hourly Rate ($)", key: "hourly_rate", type: "number", placeholder: "e.g. 50" },
                ]),
                { label: "Specialization", key: "specialization", type: "text", placeholder: "e.g. Strength & Conditioning" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white" />
                </div>
              ))}

              {/* Branch selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Branch</label>
                <select value={form.gym_id} onChange={e => setForm({ ...form, gym_id: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white">
                  <option value="">— No branch assigned —</option>
                  {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white">
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Pending</option>
                </select>
              </div>

              {modal.mode === "add" && (
                <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  ℹ️ Give the Staff ID to the coach — they use it on the Sign Up page to create their account.
                </p>
              )}
              {modal.mode === "edit" && (
                <p className="text-xs text-gray-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  ℹ️ The coach will receive an in-app notification listing exactly what was changed.
                </p>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={closeModal}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {modal.mode === "add" ? "Add Coach" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {modal?.mode === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🗑️</div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Remove Coach?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              This will remove <span className="font-bold text-gray-900 dark:text-white">{modal.coach?.full_name}</span> from the coach directory.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-6">
              ⚠️ The coach will be notified automatically via their notification center.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={closeModal}
                className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Yes, Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setProfileModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-3xl text-white relative">
              <button onClick={() => setProfileModal(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-3xl font-bold overflow-hidden shadow-lg">
                  {profileModal.avatar_url ? (
                    <img src={profileModal.avatar_url.startsWith('/') ? `http://127.0.0.1:8000${profileModal.avatar_url}` : profileModal.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profileModal.full_name || "?")[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-black">{profileModal.full_name}</h3>
                  <p className="text-purple-200 text-sm">{profileModal.specialty || "General Fitness"}</p>
                  {profileModal.loading ? (
                    <div className="mt-2 w-24 h-4 bg-white/20 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span>⭐ {profileModal.rating?.toFixed(1) ?? "0.0"} ({profileModal.total_reviews ?? 0} reviews)</span>
                      <span>👥 {profileModal.total_clients ?? 0} clients</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {profileModal.loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="p-6 space-y-5">
                {/* Read-only info */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Email", profileModal.email || "—"],
                    ["Phone", profileModal.phone || "—"],
                    ["Trainees", `${profileModal.current_clients ?? 0} / ${profileModal.max_clients ?? 30}`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Max Trainees Edit */}
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-300 flex-1">Max Trainees Limit</span>
                  <input
                    type="number" min="0"
                    value={maxTraineesEdit[profileModal.id] !== undefined ? maxTraineesEdit[profileModal.id] : (profileModal.max_clients ?? 30)}
                    onChange={e => setMaxTraineesEdit(prev => ({ ...prev, [profileModal.id]: e.target.value }))}
                    className="w-20 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-600 rounded-xl focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white text-center"
                  />
                  <button
                    onClick={async () => { await saveMaxTrainees(profileModal.id); setProfileModal(prev => ({ ...prev, max_clients: parseInt(maxTraineesEdit[profileModal.id] ?? profileModal.max_clients) })); }}
                    disabled={maxTraineesEdit[profileModal.id] === undefined}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-40"
                  >Save</button>
                </div>

                {/* Bio */}
                {profileModal.bio && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Bio</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{profileModal.bio}</p>
                  </div>
                )}

                {/* CV */}
                {profileModal.cv_url && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">CV / Resume</h4>
                    <a href={profileModal.cv_url.startsWith('/') ? `http://127.0.0.1:8000${profileModal.cv_url}` : profileModal.cv_url}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
                      📄 Download CV
                    </a>
                  </div>
                )}

                {/* Certifications */}
                {profileModal.certifications?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Certifications</h4>
                    <div className="space-y-2">
                      {profileModal.certifications.map(c => (
                        <div key={c.id} className="flex items-start gap-3 bg-green-50 dark:bg-green-900/20 rounded-xl p-3">
                          <span className="text-green-500 mt-0.5">🏅</span>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{c.issuer}{c.date_obtained ? ` · ${c.date_obtained}` : ""}{c.verified ? " · ✅ Verified" : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Education */}
                {profileModal.education?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Education</h4>
                    <div className="space-y-2">
                      {profileModal.education.map(e => (
                        <div key={e.id} className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{e.degree}{e.field_of_study ? ` — ${e.field_of_study}` : ""}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{e.institution}{e.graduation_year ? ` · ${e.graduation_year}` : ""}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Experience */}
                {profileModal.experience?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Work Experience</h4>
                    <div className="space-y-2">
                      {profileModal.experience.map(ex => (
                        <div key={ex.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white">{ex.position} @ {ex.company}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {ex.start_date?.slice(0, 7)} — {ex.current ? "Present" : (ex.end_date?.slice(0, 7) || "—")}
                          </p>
                          {ex.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ex.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social links */}
                {(profileModal.social_instagram || profileModal.social_facebook || profileModal.social_linkedin || profileModal.social_youtube) && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Social Links</h4>
                    <div className="flex flex-wrap gap-2">
                      {profileModal.social_instagram && <a href={profileModal.social_instagram} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-xl text-xs font-semibold hover:bg-pink-100 transition">📸 Instagram</a>}
                      {profileModal.social_facebook && <a href={profileModal.social_facebook} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-semibold hover:bg-blue-100 transition">👥 Facebook</a>}
                      {profileModal.social_linkedin && <a href={profileModal.social_linkedin} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 rounded-xl text-xs font-semibold hover:bg-sky-100 transition">💼 LinkedIn</a>}
                      {profileModal.social_youtube && <a href={profileModal.social_youtube} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold hover:bg-red-100 transition">▶️ YouTube</a>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MEMBERSHIP MANAGEMENT PAGE  (Gym Plans + Coach Packages tabs)
// ═══════════════════════════════════════════════════════════════
function MembershipsPage() {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState("gym"); // "gym" | "packages"

  const [plans, setPlans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  // Coach packages state
  const [packages, setPackages]         = useState([]);
  const [pkgLoading, setPkgLoading]     = useState(false);
  const [pkgStatusFilter, setPkgStatusFilter] = useState("all");
  const [rejectModal, setRejectModal]   = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const EMPTY = { name: "", description: "", price: "", duration_days: "", features: "", status: "Active" };
  const [form, setForm]         = useState(EMPTY);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/admin/membership-plans/");
      setPlans(data);
    } catch (e) {
      // If endpoint not ready yet, use empty state — not an error
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Coach packages ──
  const loadPackages = async () => {
    setPkgLoading(true);
    try {
      const qs = pkgStatusFilter !== "all" ? `?status=${pkgStatusFilter}` : "";
      const data = await apiRequest(`/admin/coach-packages${qs}`);
      setPackages(data);
    } catch (e) { showToast(e.message, "error"); }
    finally { setPkgLoading(false); }
  };
  useEffect(() => { if (activeTab === "packages") loadPackages(); }, [activeTab, pkgStatusFilter]);

  const handleApprovePkg = async (pkg) => {
    try {
      await apiRequest(`/admin/coach-packages/${pkg.id}/approve`, { method: "PUT" });
      showToast(`"${pkg.package_name}" approved`);
      addNotification({ title: "Package Approved", message: `Coach package "${pkg.package_name}" was approved` });
      loadPackages();
    } catch (e) { showToast(e.message, "error"); }
  };
  const handleRejectPkg = async () => {
    if (!rejectReason.trim()) { showToast("Rejection reason required", "error"); return; }
    try {
      await apiRequest(`/admin/coach-packages/${rejectModal.pkg.id}/reject`, {
        method: "PUT", body: JSON.stringify({ reason: rejectReason }),
      });
      showToast(`"${rejectModal.pkg.package_name}" rejected`);
      addNotification({ title: "Package Rejected", message: `Coach package "${rejectModal.pkg.package_name}" was rejected` });
      setRejectModal(null); setRejectReason(""); loadPackages();
    } catch (e) { showToast(e.message, "error"); }
  };

  const openAdd  = () => { setForm(EMPTY); setModal({ mode: "add" }); };
  const openEdit = (p) => {
    setForm({
      name: p.name ?? "",
      description: p.description ?? "",
      price: p.price ?? "",
      duration_days: p.duration_days ?? "",
      features: Array.isArray(p.features) ? p.features.join(", ") : (p.features ?? ""),
      status: p.status ?? "Active",
    });
    setModal({ mode: "edit", plan: p });
  };
  const openDelete = (p) => setModal({ mode: "delete", plan: p });
  const closeModal = () => { setModal(null); setSaving(false); };

  const buildPayload = () => ({
    name: form.name,
    description: form.description || null,
    price: form.price ? +form.price : 0,
    duration_days: form.duration_days ? +form.duration_days : 30,
    features: form.features ? form.features.split(",").map(f => f.trim()).filter(Boolean) : [],
    status: form.status,
  });

  const handleSave = async () => {
    if (!form.name || !form.price) { showToast("Name and price are required", "error"); return; }
    setSaving(true);
    try {
      if (modal.mode === "add") {
        await apiRequest("/admin/membership-plans/", { method: "POST", body: JSON.stringify(buildPayload()) });
        showToast("Membership plan created");
        addNotification({ title: "Plan Created", message: `Membership plan "${form.name}" was created` });
      } else {
        await apiRequest(`/admin/membership-plans/${modal.plan.id}`, { method: "PUT", body: JSON.stringify(buildPayload()) });
        showToast("Membership plan updated");
        addNotification({ title: "Plan Updated", message: `Membership plan "${form.name}" was updated` });
      }
      closeModal(); load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await apiRequest(`/admin/membership-plans/${modal.plan.id}`, { method: "DELETE" });
      showToast("Membership plan deleted", "warning");
      addNotification({ title: "Plan Deleted", message: `Membership plan "${modal.plan.name}" was deleted` });
      closeModal(); load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (s) => {
    const map = { Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                  Inactive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
    return map[s] || map.Inactive;
  };

  const PKG_BADGE = {
    pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className={`relative overflow-hidden rounded-3xl shadow-2xl p-8 bg-gradient-to-r ${activeTab === "gym" ? "from-pink-600 via-rose-600 to-red-600" : "from-indigo-600 via-purple-600 to-pink-600"}`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px,white 1px,transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1">Membership Management</h2>
            <p className="text-pink-100">{activeTab === "gym" ? "Define gym membership plans — pricing, duration and features" : "Review and approve coach-submitted packages before they go live"}</p>
          </div>
          {activeTab === "gym" && (
            <button onClick={openAdd}
              className="flex items-center gap-2 px-6 py-3 bg-white text-pink-700 font-bold rounded-2xl shadow-lg hover:bg-pink-50 transition-all hover:scale-105 active:scale-95">
              <span className="text-xl">➕</span> Add Plan
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab("gym")}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === "gym" ? "bg-pink-600 text-white shadow" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-pink-300"}`}>
          🎫 Gym Plans
        </button>
        <button onClick={() => setActiveTab("packages")}
          className={`px-6 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === "packages" ? "bg-indigo-600 text-white shadow" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"}`}>
          📦 Coach Packages
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 transition-all ${
          toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-amber-500" : "bg-emerald-500"
        }`}>
          <span>{toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* ── GYM PLANS TAB ── */}
      {activeTab === "gym" && (loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 p-16 text-center">
          <div className="text-7xl mb-5">🎫</div>
          <h3 className="text-2xl font-black text-gray-800 dark:text-white mb-2">No membership plans yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
            Create your first membership plan to allow users to subscribe to the gym.
          </p>
          <button onClick={openAdd}
            className="px-8 py-4 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-2xl font-bold shadow-lg hover:from-pink-700 hover:to-rose-700 transition-all hover:scale-105">
            ➕ Create First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map(p => {
            const color = p.color || "pink";
            const features = Array.isArray(p.features) ? p.features : (p.features ? [p.features] : []);
            return (
              <div key={p.id} className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                p.is_popular ? "border-purple-500 dark:border-purple-400" : "border-gray-200 dark:border-gray-700"
              }`}>
                {p.is_popular && (
                  <div className="absolute top-4 right-4 z-10">
                    <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                      ⭐ MOST POPULAR
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className={`p-6 bg-gradient-to-br from-${color}-500 to-${color}-600 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <span className="text-4xl mb-3 block">{p.icon || "📅"}</span>
                    <h3 className="text-2xl font-bold mb-1">{p.name}</h3>
                    <p className="text-sm opacity-90">{p.period || (p.duration_days ? `${p.duration_days} days` : "1 Month")}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-black text-gray-900 dark:text-white">{p.price}</span>
                    <span className="text-lg text-gray-500 dark:text-gray-400">EGP</span>
                  </div>
                  {p.original_price && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg text-gray-400 line-through">{p.original_price} EGP</span>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                        Save {p.savings} EGP
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">{p.sessions || "Unlimited"} sessions</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${statusBadge(p.status)}`}>{p.status}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="p-6 flex-1">
                  {p.description && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{p.description}</p>}
                  <ul className="space-y-3">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Subscriber count + actions */}
                <div className="p-6 pt-0 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span><strong>{p.subscriber_count ?? 0}</strong> active subscribers</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={() => openEdit(p)}
                      className="flex-1 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition flex items-center justify-center gap-1">
                      ✏️ Edit
                    </button>
                    <button onClick={() => openDelete(p)}
                      className="flex-1 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition flex items-center justify-center gap-1">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* ── COACH PACKAGES TAB ── */}
      {activeTab === "packages" && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2 flex-wrap">
            {["all", "pending", "approved", "rejected"].map(s => (
              <button key={s} onClick={() => setPkgStatusFilter(s)}
                className={`px-5 py-2 rounded-xl font-semibold text-sm transition capitalize ${
                  pkgStatusFilter === s
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                }`}>
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {pkgLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">No packages found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {packages.map(pkg => {
                const color = pkg.color || "blue";
                const features = Array.isArray(pkg.features) ? pkg.features : [];
                const avatarIsUrl = pkg.coach_avatar && (pkg.coach_avatar.startsWith('http') || pkg.coach_avatar.startsWith('/'));
                const avatarSrc = avatarIsUrl
                  ? (pkg.coach_avatar.startsWith('/') ? `http://127.0.0.1:8000${pkg.coach_avatar}` : pkg.coach_avatar)
                  : null;
                return (
                  <div key={pkg.id} className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl ${
                    pkg.popular ? "border-purple-500 dark:border-purple-400" : "border-gray-200 dark:border-gray-700"
                  }`}>
                    {/* Status badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize ${PKG_BADGE[pkg.status] || ""}`}>
                        {pkg.status}
                      </span>
                    </div>
                    {pkg.popular && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                          ⭐ BEST VALUE
                        </span>
                      </div>
                    )}

                    {/* Header — same as user coach card */}
                    <div className={`p-6 bg-gradient-to-br from-${color}-500 to-${color}-600 text-white`}>
                      <div className="flex items-center gap-4 mb-4 mt-6">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg overflow-hidden shrink-0">
                          {avatarSrc
                            ? <img src={avatarSrc} alt={pkg.coach_name} className="w-full h-full object-cover" />
                            : <span>{pkg.coach_avatar}</span>
                          }
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{pkg.coach_name}</h4>
                          <p className="text-sm opacity-90">{pkg.coach_specialty}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <svg key={i} className={`w-3 h-3 ${i < Math.floor(pkg.coach_rating || 4.5) ? "text-yellow-400" : "text-white/30"}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span className="text-xs ml-1">({pkg.coach_rating || 4.5})</span>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold">{pkg.package_name}</h3>
                      <p className="text-sm opacity-90 mt-1">{pkg.period || "1 Month"} • {pkg.sessions} sessions</p>
                    </div>

                    {/* Price */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-black text-gray-900 dark:text-white">{pkg.price}</span>
                        <span className="text-lg text-gray-500 dark:text-gray-400">EGP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{pkg.price_per_session} EGP per session</span>
                        {pkg.original_price && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                            Save {pkg.savings} EGP
                          </span>
                        )}
                      </div>
                      {pkg.original_price && (
                        <p className="text-sm text-gray-400 line-through mt-1">Regular: {pkg.original_price} EGP</p>
                      )}
                      {pkg.rejection_reason && (
                        <p className="text-xs text-red-500 mt-2 italic">Rejected: "{pkg.rejection_reason}"</p>
                      )}
                    </div>

                    {/* Features */}
                    <div className="p-6">
                      <ul className="space-y-3">
                        {features.map((f, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Admin actions */}
                    <div className="p-6 pt-0">
                      {pkg.status === "pending" ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprovePkg(pkg)}
                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-1">
                            ✓ Approve
                          </button>
                          <button onClick={() => { setRejectReason(""); setRejectModal({ pkg }); }}
                            className="flex-1 py-3 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl transition flex items-center justify-center gap-1">
                            ✗ Reject
                          </button>
                        </div>
                      ) : pkg.status === "approved" ? (
                        <button onClick={() => { setRejectReason(""); setRejectModal({ pkg }); }}
                          className="w-full py-3 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl transition">
                          Revoke Approval
                        </button>
                      ) : (
                        <button onClick={() => handleApprovePkg(pkg)}
                          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition">
                          ✓ Re-Approve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reject Package Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">Reject Package</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Rejecting <span className="font-semibold text-gray-800 dark:text-gray-200">{rejectModal.pkg.package_name}</span> by {rejectModal.pkg.coach_name}</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={handleRejectPkg}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {modal && modal.mode !== "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {modal.mode === "add" ? "🎫 New Membership Plan" : `✏️ Edit — ${modal.plan?.name}`}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Plan Name *", key: "name", type: "text", placeholder: "e.g. Gold Monthly" },
                { label: "Price ($) *", key: "price", type: "number", placeholder: "e.g. 79" },
                { label: "Duration (days)", key: "duration_days", type: "number", placeholder: "e.g. 30" },
                { label: "Description", key: "description", type: "text", placeholder: "Short description…" },
                { label: "Features (comma-separated)", key: "features", type: "text", placeholder: "Unlimited classes, Locker room, …" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={closeModal}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-semibold hover:from-pink-700 hover:to-rose-700 transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {modal.mode === "add" ? "Create Plan" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {modal?.mode === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🗑️</div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Delete Plan?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Delete <span className="font-bold text-gray-900 dark:text-white">{modal.plan?.name}</span>? Active subscribers will keep their current subscription until it expires.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={closeModal}
                className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Delete Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  COACH PACKAGES ADMIN PAGE
// ═══════════════════════════════════════════════════════════════
function CoachPackagesAdminPage() {
  const { addNotification } = useNotifications();
  const [packages, setPackages] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // null | { pkg }
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving]     = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const data = await apiRequest(`/admin/coach-packages${qs}`);
      setPackages(data);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleApprove = async (pkg) => {
    setSaving(true);
    try {
      await apiRequest(`/admin/coach-packages/${pkg.id}/approve`, { method: "PUT" });
      showToast(`Package "${pkg.package_name}" approved`);
      addNotification({ title: "Package Approved", message: `Coach package "${pkg.package_name}" was approved` });
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const openReject = (pkg) => { setRejectReason(""); setRejectModal({ pkg }); };
  const closeReject = () => { setRejectModal(null); setRejectReason(""); };

  const handleReject = async () => {
    if (!rejectReason.trim()) { showToast("Please provide a rejection reason", "error"); return; }
    setSaving(true);
    try {
      await apiRequest(`/admin/coach-packages/${rejectModal.pkg.id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: rejectReason }),
      });
      showToast(`Package "${rejectModal.pkg.package_name}" rejected`);
      addNotification({ title: "Package Rejected", message: `Coach package "${rejectModal.pkg.package_name}" was rejected` });
      closeReject();
      load();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const STATUS_BADGE = {
    pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px,white 1px,transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-white mb-1">Coach Packages</h2>
          <p className="text-indigo-100">Review and approve coach-submitted packages before they go live</p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 ${
          toast.type === "error" ? "bg-red-500" : "bg-emerald-500"
        }`}>
          <span>{toast.type === "error" ? "❌" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "approved", "rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition capitalize ${
              statusFilter === s
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
            }`}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Packages list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-xl font-semibold text-gray-600 dark:text-gray-400">No packages found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {["Coach", "Package", "Price", "Sessions", "Period", "Features", "Status", "Actions"].map(h => (
                    <th key={h} className="px-5 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {packages.map(pkg => (
                  <tr key={pkg.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30 transition">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{pkg.coach_name}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{pkg.package_name}</p>
                      {pkg.is_popular && <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold">★ Popular</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
                      {pkg.price} EGP
                      {pkg.original_price && <span className="text-xs text-gray-400 line-through ml-1">{pkg.original_price}</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{pkg.sessions}</td>
                    <td className="px-5 py-4 text-sm text-gray-500 dark:text-gray-400">{pkg.period || "—"}</td>
                    <td className="px-5 py-4 max-w-[180px]">
                      {Array.isArray(pkg.features) && pkg.features.length > 0 ? (
                        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                          {pkg.features.slice(0, 3).map((f, i) => <li key={i} className="truncate">• {f}</li>)}
                          {pkg.features.length > 3 && <li className="text-gray-400">+{pkg.features.length - 3} more</li>}
                        </ul>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${STATUS_BADGE[pkg.status] || STATUS_BADGE.pending}`}>
                          {pkg.status}
                        </span>
                        {pkg.status === "rejected" && pkg.rejection_reason && (
                          <p className="text-xs text-red-400 mt-1 max-w-[120px] truncate" title={pkg.rejection_reason}>{pkg.rejection_reason}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {pkg.status !== "approved" && (
                          <button onClick={() => handleApprove(pkg)} disabled={saving}
                            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50">
                            Approve
                          </button>
                        )}
                        {pkg.status !== "rejected" && (
                          <button onClick={() => openReject(pkg)}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition">
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">Reject Package</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
              Rejecting <span className="font-bold text-gray-900 dark:text-white">{rejectModal.pkg.package_name}</span> by {rejectModal.pkg.coach_name}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Rejection Reason *</label>
              <textarea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this package is being rejected..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white resize-none" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={closeReject} className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleReject} disabled={saving}
                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Reject Package
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subscriptions Management Component
function FinanceSubscriptionsPage() {
  const { addNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem("sub_activeTab") || "requests");
  const switchTab = (tab) => { sessionStorage.setItem("sub_activeTab", tab); setActiveTab(tab); };
  const [requests, setRequests] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [coachPackagesList, setCoachPackagesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  // Search & filter
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [subSearch, setSubSearch] = useState("");
  const [subStatusFilter, setSubStatusFilter] = useState("active");

  // Approve modal
  const [approveModal, setApproveModal] = useState(null); // { req }
  const [approveDiscount, setApproveDiscount] = useState("");

  // Reject modal
  const [rejectModal, setRejectModal] = useState(null); // { req }
  const [rejectNotes, setRejectNotes] = useState("");

  // Add/Edit subscription modal
  const [subModal, setSubModal] = useState(null); // { mode: 'add'|'edit', sub? }
  const [subForm, setSubForm] = useState({ user_id: "", plan_id: "", price: "", discount_pct: "", start_date: "", end_date: "", status: "active" });
  const [editSubCoachId, setEditSubCoachId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Cancel confirm
  const [cancelTarget, setCancelTarget] = useState(null);

  // Financial & branch state
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null); // null = All

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [reqs, subs, usersData, plansData, gymsData, pkgsData] = await Promise.all([
        apiRequest("/admin/subscription-requests"),
        apiRequest("/admin/subscriptions"),
        apiRequest("/admin/users/"),
        apiRequest("/admin/membership-plans/").catch(() => []),
        apiRequest("/gyms/").catch(() => []),
        apiRequest("/memberships/coach-packages").catch(() => []),
      ]);
      setRequests(reqs);
      setSubscriptions(subs);
      setUsers(usersData);
      setPlans(plansData);
      setCoachPackagesList(pkgsData);
      setBranches(Array.isArray(gymsData) ? gymsData : (gymsData.gyms ?? []));
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Approve ──
  const handleApprove = async () => {
    if (!approveModal) return;
    setSaving(true);
    try {
      const body = {};
      if (approveDiscount !== "") body.discount_pct = parseFloat(approveDiscount) || 0;
      await apiRequest(`/admin/subscription-requests/${approveModal.req.id}/approve`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      showToast("Request approved — subscription activated");
      addNotification({ title: "Subscription Approved", message: "Subscription request approved and activated" });
      setApproveModal(null);
      setApproveDiscount("");
      switchTab("subscriptions");
      setSubStatusFilter("active");
      loadData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Reject ──
  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/subscription-requests/${rejectModal.req.id}/reject`, {
        method: "PUT",
        body: JSON.stringify({ notes: rejectNotes || null }),
      });
      showToast("Request rejected", "warning");
      addNotification({ title: "Request Rejected", message: "Subscription request was rejected" });
      setRejectModal(null);
      setRejectNotes("");
      loadData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Add / Edit subscription ──
  const openAddSub = () => {
    setSubForm({ user_id: "", plan_id: "", coach_package_id: "", _planValue: "", price: "", discount_pct: "", start_date: "", end_date: "", status: "active" });
    setUserSearch("");
    setShowUserDropdown(false);
    setSubModal({ mode: "add" });
  };
  const openEditSub = (sub) => {
    const foundUser = users.find(u => u.id === (sub.user_id ?? sub.customer_id));
    // Pre-select the coach for coach subscriptions
    const coachId = sub.coach_package_id
      ? (coachPackagesList.find(p => p.id === sub.coach_package_id)?.coach_id ?? "")
      : "";
    setEditSubCoachId(String(coachId));
    setSubForm({
      user_id: sub.user_id ?? sub.customer_id ?? "",
      plan_id: sub.plan_id ?? "",
      coach_package_id: sub.coach_package_id ?? "",
      price: sub.price ?? "",
      discount_pct: "",
      start_date: sub.start_date ? sub.start_date.slice(0, 10) : "",
      end_date: sub.end_date ? sub.end_date.slice(0, 10) : "",
      status: sub.status ?? "active",
    });
    setUserSearch(foundUser?.full_name || "");
    setShowUserDropdown(false);
    setSubModal({ mode: "edit", sub });
  };

  const handlePlanChange = (value) => {
    // value format: "gym:3" or "coach:2"
    const [type, id] = value.split(":");
    if (type === "gym") {
      const plan = plans.find(p => String(p.id) === id);
      setSubForm(prev => ({ ...prev, _planValue: value, plan_id: id, coach_package_id: "", price: plan ? String(plan.price) : "" }));
    } else {
      const pkg = coachPackagesList.find(p => String(p.id) === id);
      setSubForm(prev => ({ ...prev, _planValue: value, plan_id: "", coach_package_id: id, price: pkg ? String(pkg.price) : "" }));
    }
  };

  // Compute preview final price for modal
  const subPreviewFinal = (() => {
    const base = parseFloat(subForm.price) || 0;
    const pct = parseFloat(subForm.discount_pct) || 0;
    return pct > 0 ? Math.max(0, base * (1 - pct / 100)) : base;
  })();

  const handleSaveSub = async () => {
    if (!subForm.user_id) { showToast("Please select a user", "error"); return; }
    if (subModal.mode === "add" && !subForm.plan_id && !subForm.coach_package_id) { showToast("Please select a plan", "error"); return; }
    setSaving(true);
    try {
      if (subModal.mode === "add") {
        const body = {
          user_id: parseInt(subForm.user_id),
          discount_pct: subForm.discount_pct ? parseFloat(subForm.discount_pct) : 0,
        };
        if (subForm.coach_package_id) {
          body.coach_package_id = parseInt(subForm.coach_package_id);
        } else {
          body.plan_id = parseInt(subForm.plan_id);
        }
        await apiRequest("/admin/subscriptions", { method: "POST", body: JSON.stringify(body) });
        showToast("Subscription created");
        addNotification({ title: "Subscription Created", message: "New subscription created successfully" });
      } else {
        const discPct = parseFloat(subForm.discount_pct) || 0;
        const body = {
          status: subForm.status,
          final_price: subPreviewFinal,
          discount_pct: discPct > 0 ? discPct : undefined,
          ...(subModal.sub?.coach_package_id
            ? { coach_package_id: parseInt(subForm.coach_package_id) }
            : { plan_id: parseInt(subForm.plan_id) }),
        };
        await apiRequest(`/admin/subscriptions/${subModal.sub.id}`, { method: "PUT", body: JSON.stringify(body) });
        showToast("Subscription updated");
        addNotification({ title: "Subscription Updated", message: "Subscription details were updated" });
      }
      setSubModal(null);
      loadData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Cancel subscription ──
  const handleCancel = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await apiRequest(`/admin/subscriptions/${cancelTarget.id}`, { method: "DELETE" });
      showToast("Subscription cancelled", "warning");
      addNotification({ title: "Subscription Cancelled", message: "A subscription was cancelled" });
      setCancelTarget(null);
      loadData();
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // Close user dropdown on outside click
  useEffect(() => {
    if (!showUserDropdown) return;
    const close = () => setShowUserDropdown(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showUserDropdown]);

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const filteredRequests = requests.filter(r => {
    const matchSearch = !reqSearch ||
      (r.user_name || "").toLowerCase().includes(reqSearch.toLowerCase()) ||
      (r.plan_name || "").toLowerCase().includes(reqSearch.toLowerCase());
    const matchStatus = reqStatusFilter === "all" || r.status === reqStatusFilter;
    return matchSearch && matchStatus;
  });

  const branchSubs = selectedBranch
    ? subscriptions.filter(s => s.gym_name === selectedBranch.name)
    : subscriptions;

  const filteredSubscriptions = branchSubs.filter(s => {
    const matchSearch = !subSearch ||
      (s.user_name || "").toLowerCase().includes(subSearch.toLowerCase()) ||
      (s.plan_name || "").toLowerCase().includes(subSearch.toLowerCase());
    const matchStatus = subStatusFilter === "all" || s.status === subStatusFilter;
    return matchSearch && matchStatus;
  });

  // KPI computed from branch-filtered subscriptions
  const kpiActive = branchSubs.filter(s => s.status === "active");
  const kpiInactive = branchSubs.filter(s => s.status !== "active");
  const kpiRevenue = kpiActive.reduce((sum, s) => sum + (s.price || 0), 0);
  const kpiAvg = kpiActive.length > 0 ? Math.round(kpiRevenue / kpiActive.length) : 0;

  // Revenue by branch (only shown when "All" selected)
  const branchRevMap = {};
  subscriptions.filter(s => s.status === "active").forEach(s => {
    const name = s.gym_name || "Unassigned";
    branchRevMap[name] = (branchRevMap[name] || 0) + (s.price || 0);
  });
  const totalBranchRev = Object.values(branchRevMap).reduce((a, b) => a + b, 0);
  const branchRevList = Object.entries(branchRevMap)
    .map(([name, rev]) => ({ name, rev, pct: totalBranchRev > 0 ? Math.round(rev / totalBranchRev * 100) : 0 }))
    .sort((a, b) => b.rev - a.rev);

  const statusBadge = (s) => {
    const map = {
      pending:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      rejected: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
      active:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      cancelled:"bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
      expired:  "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    };
    return map[s] || map.pending;
  };

  const customerUsers = users.filter(u => u.role === "user" || u.role === "customer" || u.role === "Member");

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 rounded-3xl shadow-2xl p-8 min-h-[160px]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px,white 1px,transparent 0)", backgroundSize: "28px 28px" }} />
        {/* Decorative orbs */}
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-indigo-400/10 rounded-full blur-2xl" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-white">Finance & Subscriptions</h2>
            </div>
            <p className="text-violet-200 text-sm">Revenue analytics, membership requests, and active subscriptions</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} title="Refresh"
              className="flex items-center gap-2 px-4 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-2xl border border-white/20 hover:bg-white/20 transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button onClick={openAddSub}
              className="flex items-center gap-2 px-6 py-3 bg-white text-violet-700 font-bold rounded-2xl shadow-lg hover:bg-violet-50 transition-all hover:scale-105">
              <span className="text-lg">＋</span> Add Subscription
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 transition-all animate-fadeIn ${
          toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-amber-500" : "bg-emerald-500"
        }`}>
          <span>{toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : "✅"}</span>
          {toast.msg}
        </div>
      )}

      {/* Branch Filter Pills */}
      {branches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Branch</span>
            <button
              onClick={() => setSelectedBranch(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                !selectedBranch
                  ? "bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/30"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600"
              }`}
            >
              All Branches
            </button>
            {branches.map(b => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  selectedBranch?.id === b.id
                    ? "bg-violet-600 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/30"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-600"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Revenue", value: kpiRevenue.toLocaleString(), unit: "EGP", icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ), from: "from-emerald-500", to: "to-teal-600", bg: "from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", val: "text-emerald-600 dark:text-emerald-400" },
          { label: "Active Subscriptions", value: kpiActive.length, unit: "members", icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ), from: "from-blue-500", to: "to-indigo-600", bg: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", val: "text-blue-600 dark:text-blue-400" },
          { label: "Avg. Revenue / Member", value: kpiAvg.toLocaleString(), unit: "EGP", icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          ), from: "from-violet-500", to: "to-purple-600", bg: "from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20", border: "border-violet-200 dark:border-violet-800", text: "text-violet-700 dark:text-violet-300", val: "text-violet-600 dark:text-violet-400" },
          { label: "Cancelled / Expired", value: kpiInactive.length, unit: "subscriptions", icon: (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ), from: "from-amber-500", to: "to-orange-600", bg: "from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", val: "text-amber-600 dark:text-amber-400" },
        ].map(card => (
          <div key={card.label} className={`relative overflow-hidden bg-gradient-to-br ${card.bg} rounded-2xl p-5 border-2 ${card.border} hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300`}>
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2.5 bg-gradient-to-br ${card.from} ${card.to} rounded-xl text-white shadow-lg`}>
                {card.icon}
              </div>
            </div>
            <div className={`text-3xl font-black ${card.val} mb-0.5`}>{card.value}</div>
            <div className={`text-xs ${card.text} font-semibold`}>{card.unit}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Revenue by Branch (only when All selected) */}
      {!selectedBranch && branchRevList.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Revenue by Branch
          </h3>
          <div className="space-y-4">
            {branchRevList.map((b, i) => {
              const colors = ["from-violet-500 to-indigo-500", "from-blue-500 to-cyan-500", "from-emerald-500 to-teal-500", "from-amber-500 to-orange-500", "from-pink-500 to-rose-500"];
              return (
                <div key={b.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${colors[i % colors.length]}`} />
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{b.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{b.rev.toLocaleString()} EGP <span className="text-xs font-normal text-gray-400">({b.pct}%)</span></span>
                  </div>
                  <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all duration-700`} style={{ width: `${b.pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => switchTab("requests")}
            className={`flex-1 px-6 py-4 font-semibold transition-all relative flex items-center justify-center gap-2 ${
              activeTab === "requests" ? "text-violet-600 dark:text-violet-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            ⏳ Membership Requests
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">{pendingCount}</span>
            )}
            {activeTab === "requests" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400 rounded-t-full" />}
          </button>
          <button
            onClick={() => switchTab("subscriptions")}
            className={`flex-1 px-6 py-4 font-semibold transition-all relative flex items-center justify-center gap-2 ${
              activeTab === "subscriptions" ? "text-violet-600 dark:text-violet-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
              🎫 Subscriptions
            {selectedBranch && (
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">{selectedBranch.name}</span>
            )}
            {activeTab === "subscriptions" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400 rounded-t-full" />}
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
            </div>
          ) : activeTab === "requests" ? (
            // ── Requests Tab ──
            <>
              {/* Search + Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by user or plan…"
                    value={reqSearch}
                    onChange={e => setReqSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <select
                  value={reqStatusFilter}
                  onChange={e => setReqStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="font-medium">{requests.length === 0 ? "No membership requests yet" : "No results match your filter"}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map(r => (
                    <div key={r.id} className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900 dark:text-white">{r.user_name || r.customer_name || `Customer #${r.customer_id}`}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>{r.status}</span>
                          {r.coach_package_id
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">Coach Package</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Gym Plan</span>
                          }
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                          <span className="font-medium">{r.plan_name}</span>
                          {' · '}
                          {r.discount > 0 ? (
                            <>
                              <span className="line-through text-gray-400">{r.requested_price} EGP</span>
                              <span className="ml-1 font-semibold text-emerald-600 dark:text-emerald-400">{r.final_price} EGP</span>
                              <span className="ml-1 text-xs text-emerald-500">(−{r.discount_pct > 0 ? `${r.discount_pct}%` : `${(r.requested_price - r.final_price).toFixed(0)} EGP`})</span>
                            </>
                          ) : (
                            <span>{r.requested_price} EGP</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                          {r.notes && <span className="ml-2 italic">"{r.notes}"</span>}
                        </p>
                      </div>
                      {r.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => { setApproveModal({ req: r }); setApproveDiscount(""); }}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => { setRejectModal({ req: r }); setRejectNotes(""); }}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl transition"
                          >
                            ✗ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            // ── Subscriptions Tab ──
            <>
              {/* Search + Filter bar */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search by user or plan…"
                    value={subSearch}
                    onChange={e => setSubSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <select
                  value={subStatusFilter}
                  onChange={e => setSubStatusFilter(e.target.value)}
                  className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>

              {filteredSubscriptions.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <div className="text-5xl mb-3">🎫</div>
                  <p className="font-medium">{subscriptions.length === 0 ? "No subscriptions yet" : "No results match your filter"}</p>
                  {subscriptions.length === 0 && (
                    <button onClick={openAddSub} className="mt-4 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition">
                      ➕ Add First Subscription
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-3 text-left font-semibold">User</th>
                        <th className="pb-3 text-left font-semibold">Plan</th>
                        {!selectedBranch && <th className="pb-3 text-left font-semibold">Branch</th>}
                        <th className="pb-3 text-left font-semibold">Original Price</th>
                        <th className="pb-3 text-left font-semibold">Discount</th>
                        <th className="pb-3 text-left font-semibold">Final Price</th>
                        <th className="pb-3 text-left font-semibold">Period</th>
                        <th className="pb-3 text-left font-semibold">Status</th>
                        <th className="pb-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredSubscriptions.map(sub => {
                        const hasDiscount = sub.discount_amount > 0;
                        return (
                          <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-gray-900 dark:text-white">{sub.user_name || `User #${sub.customer_id}`}</p>
                            </td>
                            <td className="py-3 pr-4">
                              <p className="text-gray-700 dark:text-gray-300 font-medium">{sub.plan_name}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sub.coach_package_id ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                                {sub.coach_package_id ? 'Coach Plan' : 'Gym Plan'}
                              </span>
                            </td>
                            {!selectedBranch && (
                              <td className="py-3 pr-4">
                                {sub.gym_name ? (
                                  <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{sub.gym_name}</span>
                                ) : <span className="text-gray-400 text-xs">—</span>}
                              </td>
                            )}
                            <td className="py-3 pr-4">
                              {sub.original_price != null ? (
                                <span className={`${hasDiscount ? "line-through text-gray-400" : "font-semibold text-gray-900 dark:text-white"}`}>
                                  {sub.original_price} EGP
                                </span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-3 pr-4">
                              {hasDiscount ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">−{sub.discount_amount} EGP</span>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="py-3 pr-4">
                              <span className="font-bold text-gray-900 dark:text-white">{sub.price} EGP</span>
                            </td>
                            <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                              {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : "—"}
                              <span className="mx-1">→</span>
                              {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "—"}
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(sub.status)}`}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => openEditSub(sub)}
                                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                                >
                                  ✏️ Edit
                                </button>
                                {sub.status === "active" && (
                                  <button
                                    onClick={() => setCancelTarget(sub)}
                                    className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                  >
                                    🚫 Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Approve Modal ── */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">Approve Request</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Approving <span className="font-semibold text-gray-800 dark:text-gray-200">{approveModal.req.plan_name}</span> for{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{approveModal.req.user_name || `Customer #${approveModal.req.customer_id}`}</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Discount % <span className="text-gray-400 font-normal">(optional, 0–100)</span>
              </label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={approveDiscount}
                onChange={e => setApproveDiscount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
              {approveDiscount && parseFloat(approveDiscount) > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">
                  Final price: {(approveModal.req.requested_price * (1 - parseFloat(approveDiscount) / 100)).toFixed(2)} EGP
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setApproveModal(null)}
                className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleApprove} disabled={saving}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">Reject Request</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Rejecting <span className="font-semibold text-gray-800 dark:text-gray-200">{rejectModal.req.plan_name}</span>
            </p>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Reason / Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="e.g. Payment not received yet…"
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleReject} disabled={saving}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Subscription Modal ── */}
      {subModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {subModal.mode === "add" ? "➕ New Subscription" : "✏️ Edit Subscription"}
              </h3>
              <button onClick={() => setSubModal(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">

              {/* User searchable input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">User *</label>
                <div className="relative">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by name or ID…"
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); if (!e.target.value) setSubForm(prev => ({ ...prev, user_id: "" })); }}
                      onFocus={() => setShowUserDropdown(true)}
                      className={`w-full pl-9 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 ${subForm.user_id ? "border-violet-400 dark:border-violet-500" : "border-gray-200 dark:border-gray-600"}`}
                    />
                    {subForm.user_id && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-500 text-xs font-semibold">✓</span>
                    )}
                  </div>
                  {showUserDropdown && userSearch.length > 0 && (() => {
                    const q = userSearch.toLowerCase();
                    const filtered = users.filter(u =>
                      (u.role === "user" || u.role === "customer" || u.role === "Member") &&
                      (u.full_name?.toLowerCase().includes(q) || String(u.id).includes(q) || (u.membership_id || "").toLowerCase().includes(q))
                    );
                    return filtered.length > 0 ? (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                        {filtered.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => { setSubForm(prev => ({ ...prev, user_id: u.id })); setUserSearch(u.full_name); setShowUserDropdown(false); }}
                            className="w-full px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white text-sm">{u.full_name}</p>
                              {u.membership_id && <p className="text-xs text-gray-400">ID: {u.membership_id}</p>}
                            </div>
                            <span className="text-xs text-gray-400">#{u.id}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No users found
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Plan dropdown → auto-fills price */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Plan {subModal.mode === "add" ? "*" : ""}
                  {subModal.mode === "edit" && (
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${subModal.sub?.coach_package_id ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      {subModal.sub?.coach_package_id ? "👨‍🏫 Coach Subscription" : "🏋️ Gym Subscription"}
                    </span>
                  )}
                </label>

                {/* Edit mode — Coach subscription: pick coach first, then package */}
                {subModal.mode === "edit" && subModal.sub?.coach_package_id ? (
                  <div className="flex flex-col gap-2">
                    {/* Step 1: Choose coach */}
                    <select
                      value={editSubCoachId}
                      onChange={e => {
                        setEditSubCoachId(e.target.value);
                        setSubForm(prev => ({ ...prev, coach_package_id: "" }));
                      }}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">👨‍🏫 Select a coach…</option>
                      {[...new Map(coachPackagesList.map(p => [p.coach_id, p])).values()].map(p => (
                        <option key={p.coach_id} value={String(p.coach_id)}>{p.coach_name}</option>
                      ))}
                    </select>
                    {/* Step 2: Choose package of that coach */}
                    <select
                      value={subForm.coach_package_id}
                      onChange={e => setSubForm(prev => ({ ...prev, coach_package_id: e.target.value }))}
                      disabled={!editSubCoachId}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">📦 Select a package…</option>
                      {coachPackagesList
                        .filter(p => String(p.coach_id) === editSubCoachId)
                        .map(p => (
                          <option key={p.id} value={p.id}>{p.package_name} — {p.price} EGP</option>
                        ))}
                    </select>
                  </div>
                ) : subModal.mode === "edit" ? (
                  /* Edit mode — Gym subscription */
                  <select
                    value={subForm.plan_id}
                    onChange={e => setSubForm(prev => ({ ...prev, plan_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">Select a plan…</option>
                    {plans.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.price} EGP</option>
                    ))}
                  </select>
                ) : (
                  /* Add mode — show all gym plans + coach packages */
                  <select
                    value={subForm._planValue || ""}
                    onChange={e => handlePlanChange(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                  >
                    <option value="">Select a plan…</option>
                    {plans.length > 0 && (
                      <optgroup label="🏋️ Gym Plans">
                        {plans.map(p => (
                          <option key={`gym:${p.id}`} value={`gym:${p.id}`}>{p.name} — {p.price} EGP</option>
                        ))}
                      </optgroup>
                    )}
                    {coachPackagesList.length > 0 && (
                      <optgroup label="👨‍🏫 Coach Packages">
                        {coachPackagesList.map(p => (
                          <option key={`coach:${p.id}`} value={`coach:${p.id}`}>{p.package_name} ({p.coach_name}) — {p.price} EGP</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Price — auto-filled for add, editable for edit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Price (EGP) {subModal.mode === "add" ? <span className="text-gray-400 font-normal text-xs ml-1">auto from plan</span> : ""}
                  </label>
                  <input
                    type="number"
                    value={subForm.price}
                    readOnly={subModal.mode === "add"}
                    onChange={e => subModal.mode === "edit" && setSubForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder={subModal.mode === "add" ? "Select a plan first" : "e.g. 500"}
                    className={`w-full px-4 py-3 border rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 ${
                      subModal.mode === "add"
                        ? "bg-gray-100 dark:bg-gray-600 border-gray-200 dark:border-gray-600 cursor-not-allowed text-gray-500 dark:text-gray-400"
                        : "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Discount %</label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={subForm.discount_pct}
                      onChange={e => setSubForm(prev => ({ ...prev, discount_pct: e.target.value }))}
                      placeholder="0"
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Final price preview */}
              {subForm.price && (
                <div className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm ${
                  parseFloat(subForm.discount_pct) > 0
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                    : "bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                }`}>
                  <span className="text-gray-600 dark:text-gray-400">Final price after discount:</span>
                  <div className="flex items-center gap-2">
                    {parseFloat(subForm.discount_pct) > 0 && (
                      <span className="line-through text-gray-400 text-xs">{parseFloat(subForm.price).toFixed(2)} EGP</span>
                    )}
                    <span className="font-bold text-gray-900 dark:text-white">{subPreviewFinal.toFixed(2)} EGP</span>
                  </div>
                </div>
              )}

              {/* Status (edit only) */}
              {subModal.mode === "edit" && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <select value={subForm.status} onChange={e => setSubForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500">
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={() => setSubModal(null)}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleSaveSub} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {subModal.mode === "add" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirm ── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🚫</div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Cancel Subscription?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Cancel <span className="font-bold text-gray-900 dark:text-white">{cancelTarget.plan_name}</span> for{" "}
              <span className="font-bold text-gray-900 dark:text-white">{cancelTarget.user_name || `User #${cancelTarget.customer_id}`}</span>?
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCancelTarget(null)}
                className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Keep
              </button>
              <button onClick={handleCancel} disabled={saving}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Cancel Subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Branch Management Component — fully connected to backend
function BranchManagement() {
  const { addNotification } = useNotifications();
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [form, setForm] = useState({ name: "", location: "", phone: "", status: "Active" });
  const [formErrors, setFormErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiRequest('/gyms/');
      setBranches(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadBranches(); }, []);

  const openCreateModal = () => {
    setEditingBranch(null);
    setForm({ name: "", location: "", phone: "", status: "Active" });
    setFormErrors({});
    setImageFile(null);
    setImagePreview(null);
    setIsModalOpen(true);
  };

  const openEditModal = (branch) => {
    setEditingBranch(branch);
    setForm({ name: branch.name || "", location: branch.location || "", phone: branch.phone || "", status: branch.status || "Active" });
    setFormErrors({});
    setImageFile(null);
    setImagePreview(branch.image_url ? `http://127.0.0.1:8000${branch.image_url}` : null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (!isSubmitting) { setIsModalOpen(false); setEditingBranch(null); setFormErrors({}); setImageFile(null); setImagePreview(null); }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Branch name is required";
    if (!form.location.trim()) errors.location = "Location is required";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const payload = { name: form.name.trim(), location: form.location.trim(), phone: form.phone.trim() || null, status: form.status };
      let gymId;
      if (editingBranch) {
        await apiRequest(`/gyms/${editingBranch.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        gymId = editingBranch.id;
        setSuccessMessage(`Branch "${form.name}" updated successfully!`);
        addNotification({ title: "Branch Updated", message: `Branch "${form.name}" was updated successfully` });
      } else {
        const created = await apiRequest('/gyms/', { method: 'POST', body: JSON.stringify(payload) });
        gymId = created.id;
        setSuccessMessage(`Branch "${form.name}" created successfully!`);
        addNotification({ title: "Branch Created", message: `New branch "${form.name}" was created` });
      }
      if (imageFile && gymId) {
        const fd = new FormData();
        fd.append("file", imageFile);
        const token = localStorage.getItem('access_token');
        const imgRes = await fetch(`http://127.0.0.1:8000/api/v1/gyms/${gymId}/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
        if (!imgRes.ok) {
          const err = await imgRes.json().catch(() => ({}));
          throw new Error(typeof err.detail === 'string' ? err.detail : 'Image upload failed');
        }
      }
      await loadBranches();
      setIsModalOpen(false);
      setEditingBranch(null);
      setImageFile(null);
      setImagePreview(null);
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (err) {
      setFormErrors({ submit: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await apiRequest(`/gyms/${id}`, { method: 'DELETE' });
      await loadBranches();
      setDeleteConfirmId(null);
      setSuccessMessage("Branch deleted successfully.");
      setTimeout(() => setSuccessMessage(""), 4000);
      addNotification({ title: "Branch Deleted", message: "A branch was deleted successfully" });
    } catch (err) {
      alert("Failed to delete branch: " + err.message);
    }
  };

  const cardGradients = ["from-blue-500 to-indigo-600","from-purple-500 to-pink-600","from-emerald-500 to-teal-600","from-orange-500 to-rose-600","from-cyan-500 to-blue-600","from-violet-500 to-purple-600"];
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1','');

  return (
    <div className="space-y-6 animate-fadeIn">
      {successMessage && (
        <div className="fixed top-6 right-6 z-50 max-w-md animate-fadeIn">
          <div className="bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="font-semibold">{successMessage}</p>
            <button onClick={() => setSuccessMessage("")} className="ml-2 text-white/80 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 rounded-3xl shadow-2xl p-8">
        <div className="absolute inset-0 opacity-10"><div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }}></div></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white mb-2">Branch Management</h2>
            <p className="text-emerald-100">{branches.length} {branches.length === 1 ? 'branch' : 'branches'} total</p>
          </div>
          <button onClick={openCreateModal} className="px-6 py-3 bg-white text-green-600 rounded-xl font-semibold hover:bg-green-50 transition shadow-lg flex items-center gap-2 hover:scale-105 transform">
            <span className="text-xl">➕</span> Create New Branch
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400">Error loading branches: {error}</div>}

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-4"><span className="text-4xl">🏢</span></div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No branches yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first gym branch to get started</p>
          <button onClick={openCreateModal} className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg flex items-center gap-2">
            <span>➕</span> Create First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch, index) => (
            <div key={branch.id} className="group bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-2xl transition-all duration-300">
              {/* Cover image / gradient header */}
              <div className={`relative h-44 ${!branch.image_url ? `bg-gradient-to-br ${cardGradients[index % cardGradients.length]}` : ''}`}>
                {branch.image_url ? (
                  <img
                    src={branch.image_url.startsWith('/') ? `${API_BASE}${branch.image_url}` : branch.image_url}
                    alt={branch.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-6xl opacity-30">🏢</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow ${(branch.status || 'Active') === 'Active' ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                    {branch.status || 'Active'}
                  </span>
                </div>
                {/* Name / location overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-xl font-bold text-white drop-shadow-lg truncate">{branch.name}</h3>
                  <p className="text-sm text-white/85 flex items-center gap-1 mt-0.5">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                    <span className="truncate">{branch.location}</span>
                  </p>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4 space-y-3">
                {branch.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {branch.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Added {new Date(branch.created_at).toLocaleDateString()}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => openEditModal(branch)}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirmId(branch.id)}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition text-sm">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fadeIn">
            <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-white mb-2">Delete Branch?</h3>
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">This action cannot be undone. All data associated with this branch will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition shadow-lg">Delete</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
            <div className={`p-6 ${editingBranch ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">{editingBranch ? '✏️' : '🏢'}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{editingBranch ? 'Edit Branch' : 'Create New Branch'}</h3>
                    <p className="text-emerald-100 text-sm">{editingBranch ? editingBranch.name : 'Add a new gym branch to the system'}</p>
                  </div>
                </div>
                <button onClick={closeModal} disabled={isSubmitting} className="text-white/80 hover:text-white transition disabled:opacity-50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formErrors.submit && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">{formErrors.submit}</div>}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Branch Name <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="text-gray-400">🏢</span></div>
                  <input type="text" value={form.name} onChange={(e) => { setForm(p => ({ ...p, name: e.target.value })); if (formErrors.name) setFormErrors(p => ({ ...p, name: "" })); }} placeholder="e.g., Downtown Branch"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${formErrors.name ? 'border-red-500' : 'border-transparent'}`} disabled={isSubmitting} />
                </div>
                {formErrors.name && <p className="text-red-500 text-sm">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Location / Address <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                  <input type="text" value={form.location} onChange={(e) => { setForm(p => ({ ...p, location: e.target.value })); if (formErrors.location) setFormErrors(p => ({ ...p, location: "" })); }} placeholder="e.g., 123 Main Street, Cairo"
                    className={`w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all ${formErrors.location ? 'border-red-500' : 'border-transparent'}`} disabled={isSubmitting} />
                </div>
                {formErrors.location && <p className="text-red-500 text-sm">{formErrors.location}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone <span className="text-gray-400 text-xs">(optional)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <input type="text" value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g., +20 123 456 7890"
                    className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 transition-all" disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ value: 'Active', icon: '🟢' }, { value: 'Inactive', icon: '🔴' }].map((s) => (
                    <button key={s.value} type="button" onClick={() => setForm(p => ({ ...p, status: s.value }))} disabled={isSubmitting}
                      className={`py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${form.status === s.value ? 'bg-green-600 text-white shadow-lg shadow-green-600/30' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                      <span>{s.icon}</span>{s.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch image upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Branch Image <span className="text-gray-400 text-xs">(optional)</span></label>
                {imagePreview && (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden mb-2">
                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition text-xs">✕</button>
                  </div>
                )}
                <label className={`flex flex-col items-center justify-center w-full h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${imagePreview ? 'border-green-400 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40 hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10'}`}>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">📷</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{imageFile ? imageFile.name : 'Click to upload image'}</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} disabled={isSubmitting} />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} disabled={isSubmitting} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-70">
                  {isSubmitting ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{editingBranch ? 'Saving...' : 'Creating...'}</span></>) : (<><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={editingBranch ? "M5 13l4 4L19 7" : "M12 4v16m8-8H4"} /></svg><span>{editingBranch ? 'Save Changes' : 'Create Branch'}</span></>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Reports Component
function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, finData, usersData, coachesData] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest('/admin/financial-stats'),
        apiRequest('/admin/users/'),
        apiRequest('/admin/coaches/'),
      ]);
      setData({ statsData, finData, usersData, coachesData });
      setRefreshedAt(new Date());
    } catch (e) { } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = data?.statsData ?? {};
  const fin = data?.finData ?? {};
  const users = data?.usersData ?? [];
  const coaches = data?.coachesData ?? [];

  const roleCounts = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const statusCounts = users.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc; }, {});
  const availableCoaches = coaches.filter(c => c.status === 'Active').length;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRegs = users.filter(u => u.created_at && new Date(u.created_at) > sevenDaysAgo).length;
  const branches = fin.branches ?? [];

  const statCards = [
    { label: 'Total Users', value: stats.total_users ?? users.length, color: 'blue', icon: '👥' },
    { label: 'Active Members', value: stats.active_members ?? 0, color: 'green', icon: '✅' },
    { label: 'Total Coaches', value: stats.total_coaches ?? coaches.length, color: 'purple', icon: '🏋️' },
    { label: 'Total Branches', value: stats.total_branches ?? 0, color: 'orange', icon: '🏢' },
    { label: 'Total Revenue', value: `${(fin.total_revenue ?? 0).toLocaleString()} EGP`, color: 'emerald', icon: '💰' },
    { label: 'Active Subscriptions', value: fin.active_subscriptions ?? 0, color: 'teal', icon: '🎫' },
    { label: 'New This Week', value: recentRegs, color: 'indigo', icon: '🆕' },
    { label: 'Pending Approvals', value: stats.pending_approvals ?? 0, color: 'yellow', icon: '⏳' },
  ];

  const colorMap = {
    blue: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400',
    green: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400',
    purple: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400',
    orange: 'from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400',
    emerald: 'from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    teal: 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400',
    indigo: 'from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400',
    yellow: 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 rounded-3xl shadow-2xl p-8">
        <div className="absolute inset-0 opacity-10"><div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }}></div></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-white mb-2">Reports & Analytics</h2>
            <p className="text-orange-100">Live system overview{refreshedAt && <span className="ml-2 opacity-70 text-sm">· Updated {refreshedAt.toLocaleTimeString()}</span>}</p>
          </div>
          <button onClick={load} disabled={loading} className="px-6 py-3 bg-white text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition shadow-lg flex items-center gap-2 disabled:opacity-60">
            <span className={`text-xl ${loading ? 'animate-spin' : ''}`}>🔄</span>
            {loading ? 'Refreshing…' : 'Refresh Data'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div key={card.label} className={`bg-gradient-to-br ${colorMap[card.color]} rounded-2xl p-5 border-2 hover:shadow-lg hover:scale-105 transition-all duration-200`}>
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className={`text-2xl font-black ${colorMap[card.color].split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>{card.value}</div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">User Breakdown by Role</h3>
          {Object.keys(roleCounts).length === 0 ? <p className="text-sm text-gray-500">No users yet.</p> : (
            <div className="space-y-3">
              {Object.entries(roleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => {
                const pct = users.length > 0 ? Math.round(count / users.length * 100) : 0;
                return (
                  <div key={role}>
                    <div className="flex justify-between mb-1"><span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{role}</span><span className="text-sm font-bold text-gray-900 dark:text-white">{count} <span className="font-normal text-gray-400">({pct}%)</span></span></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">User Breakdown by Status</h3>
          {Object.keys(statusCounts).length === 0 ? <p className="text-sm text-gray-500">No users yet.</p> : (
            <div className="space-y-3">
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                const pct = users.length > 0 ? Math.round(count / users.length * 100) : 0;
                const barColor = status === 'Active' ? 'from-green-500 to-emerald-500' : status === 'Inactive' ? 'from-red-400 to-red-500' : 'from-yellow-400 to-amber-500';
                return (
                  <div key={status}>
                    <div className="flex justify-between mb-1"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">{status}</span><span className="text-sm font-bold text-gray-900 dark:text-white">{count} <span className="font-normal text-gray-400">({pct}%)</span></span></div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r ${barColor} rounded-full`} style={{ width: `${pct}%` }}></div></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Coach Availability</h3>
          {coaches.length === 0 ? <p className="text-sm text-gray-500">No coaches yet.</p> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800"><span className="text-sm font-semibold text-green-700 dark:text-green-300">Available / Active</span><span className="text-2xl font-black text-green-600 dark:text-green-400">{availableCoaches}</span></div>
              <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"><span className="text-sm font-semibold text-red-700 dark:text-red-300">Unavailable / Inactive</span><span className="text-2xl font-black text-red-600 dark:text-red-400">{coaches.length - availableCoaches}</span></div>
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700"><span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Coaches</span><span className="text-2xl font-black text-gray-700 dark:text-gray-200">{coaches.length}</span></div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Subscription Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800"><span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Active Subscriptions</span><span className="text-2xl font-black text-blue-600 dark:text-blue-400">{fin.active_subscriptions ?? '—'}</span></div>
            <div className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800"><span className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">Cancelled / Expired</span><span className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{fin.inactive_subscriptions ?? '—'}</span></div>
            <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800"><span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Active Revenue</span><span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{(fin.total_revenue ?? 0).toLocaleString()} EGP</span></div>
          </div>
        </div>
      </div>

      {branches.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700"><h3 className="text-lg font-bold text-gray-900 dark:text-white">Revenue by Branch</h3></div>
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>{['Branch', 'Subscriptions', 'Revenue', 'Share'].map(h => <th key={h} className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {branches.map(b => (
                <tr key={b.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{b.name}</td>
                  <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.count}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{b.revenue.toLocaleString()} EGP</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full" style={{ width: `${b.pct}%` }}></div></div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-10 text-right">{b.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Main Admin Dashboard Component
export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  const { profile } = useProfile();

  // Read real logged-in user from localStorage
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  })();
  const displayName = profile?.name || currentUser.full_name || currentUser.name || 'Admin';
  const displayEmail = profile?.email || currentUser.email || '';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  const headerAvatar = profile?.avatar || profile?.avatar_url || null;

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const [userData, statsData] = await Promise.all([
          apiRequest('/admin/users/'),
          apiRequest('/admin/stats'),
        ]);
        setUsers(userData);
        setServerStats(statsData);
      } catch (err) {
        console.error("Error loading dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered search results from loaded users
  const searchResults = searchQuery.trim().length < 1 ? [] : users
    .filter(u => {
      const q = searchQuery.toLowerCase();
      return (
        (u.full_name && u.full_name.toLowerCase().startsWith(q)) ||
        (u.email && u.email.toLowerCase().startsWith(q))
      );
    })
    .slice(0, 6)
    .map(u => ({
      id: u.id,
      name: u.full_name || u.email,
      email: u.email,
      role: u.role,
      icon: u.role === 'coach' ? '💪' : u.role === 'admin' ? '🛡️' : u.role === 'owner' ? '🏢' : '👤',
      path: u.role === 'coach' ? '/admin/coaches' : '/admin/users',
    }));

  const handleSearchSelect = (result) => {
    setSearchQuery('');
    setShowSearchDropdown(false);
    navigate(result.path);
  };

  // Derive recent activity from the latest registered users
  const activities = [...users]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8)
    .map(u => ({
      id: u.id,
      icon: u.role === 'coach' ? '💪' : u.role === 'admin' ? '🛡️' : u.role === 'owner' ? '🏢' : '👤',
      user: u.full_name,
      action: 'joined as',
      target: u.role === 'user' ? 'Member' : u.role.charAt(0).toUpperCase() + u.role.slice(1),
      time: new Date(u.created_at).toLocaleDateString(),
    }));

  const stats = {
    totalUsers: serverStats?.total_users ?? users.length,
    activeMembers: serverStats?.active_members ?? users.filter(u => u.status === 'Active' && u.role === 'user').length,
    totalRevenue: serverStats?.total_revenue ?? 0,
    branches: serverStats?.total_branches ?? 0,
    coaches: serverStats?.total_coaches ?? users.filter(u => u.role === 'coach').length,
    pendingApprovals: serverStats?.pending_approvals ?? users.filter(u => u.status === 'Pending').length,
    activities,
  };

  return (
    <ChatProvider>
      <ChatNotificationBridge />
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
          <MobileAdminSidebar />
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-hidden pt-16 md:pt-0">
            <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-40">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Administrator Dashboard</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Full system access and management</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative hidden md:block" ref={searchRef}>
                    <input
                      type="text"
                      placeholder="Search users, coaches..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                      onFocus={() => setShowSearchDropdown(true)}
                      onKeyDown={e => e.key === 'Escape' && setShowSearchDropdown(false)}
                      className="w-80 pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {showSearchDropdown && searchResults.length > 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                        {searchResults.map(result => (
                          <button
                            key={result.id}
                            onClick={() => handleSearchSelect(result)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                          >
                            <span className="text-lg">{result.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{result.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.email}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg capitalize">{result.role}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showSearchDropdown && searchQuery.trim().length >= 1 && searchResults.length === 0 && (
                      <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 px-4 py-3 z-50">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No results found</p>
                      </div>
                    )}
                  </div>
                  <NotificationCenter />
                  <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-gray-700">
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{displayEmail}</p>
                    </div>
                    {headerAvatar ? (
                      <img src={headerAvatar} alt="Profile" className="w-10 h-10 rounded-full object-cover shadow-lg" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">{initials}</div>
                    )}
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 p-6 overflow-auto">
              <React.Suspense fallback={
                <div className="flex items-center justify-center h-screen">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center"><span className="text-4xl">⚙️</span></div>
                  </div>
                </div>
              }>
                <Routes>
                  <Route index element={<AdminHome stats={stats} />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="branches" element={<BranchManagement />} />
                  <Route path="coaches" element={<CoachesPage />} />
                  <Route path="memberships" element={<MembershipsPage />} />
                  <Route path="subscriptions" element={<FinanceSubscriptionsPage />} />
                  <Route path="finance" element={<Navigate to="/admin/subscriptions" replace />} />
                  <Route path="coach-packages" element={<Navigate to="/admin/memberships" replace />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="chat" element={<ChatPage userRole="admin" />} />
                  <Route path="profile" element={<AdminProfile />} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </React.Suspense>
            </main>
          </div>
        </div>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          .animate-fadeIn { animation: fadeIn 0.6s ease-out; }
          .animate-bounce-slow { animation: bounce-slow 2s ease-in-out infinite; }
        `}</style>
    </ChatProvider>
  );
}