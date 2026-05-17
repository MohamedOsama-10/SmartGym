// src/components/Sidebar.jsx - UPDATED WITH USER PROFILE AVATAR
import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "../context/ProfileContext";
import { useChat } from "../context/ChatContext";
import ThemeToggle from "./ThemeToggle";

export default function Sidebar() {
  const { user, logout, loading, apiRequest } = useAuth();
  const { profile } = useProfile();
  const { conversations } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [userAvatar, setUserAvatar] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Total unread messages across all conversations
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  // Extract branchId from URL if exists (numeric gym IDs like /owner/1)
  const branchMatch = location.pathname.match(/\/owner\/(\d+)/);
  const branchId = branchMatch?.[1];

  // ✅ Fetch profile avatar for users and coaches
  useEffect(() => {
    const fetchProfileAvatar = async () => {
      if (!apiRequest) return;
      try {
        if (user?.role === 'user') {
          const data = await apiRequest('/users/me/profile');
          if (data?.avatar_url) setUserAvatar(data.avatar_url);
        } else if (user?.role === 'coach') {
          const data = await apiRequest('/users/me/coach-profile');
          if (data?.avatar_url) setUserAvatar(data.avatar_url);
        }
      } catch (error) {
        console.error('Failed to fetch avatar:', error);
      }
    };

    fetchProfileAvatar();
  }, [user, apiRequest]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <aside className="hidden md:flex w-72 bg-gray-900 dark:bg-gray-950 text-white h-screen sticky top-0 items-center justify-center transition-colors duration-300">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white"></div>
      </aside>
    );
  }

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
        : "text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-800 hover:text-white"
    }`;

  // Badge shown next to Messages link
  const UnreadBadge = ({ isActive }) =>
    totalUnread > 0 ? (
      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center ${
        isActive ? "bg-white/25 text-white" : "bg-red-500 text-white"
      }`}>
        {totalUnread > 99 ? "99+" : totalUnread}
      </span>
    ) : null;

  // Get initials for avatar fallback
  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  // ✅ Get display name based on role
  const getDisplayName = () => {
    if (user?.role === 'owner') {
      return profile?.name || user?.name || user?.email;
    }
    return user?.name || user?.email;
  };

  // ✅ Get avatar URL based on role
  const getAvatarUrl = () => {
    if (user?.role === 'owner') {
      return profile?.avatar;
    }
    if (user?.role === 'user' || user?.role === 'coach') {
      return userAvatar;
    }
    return null;
  };

  const displayName = getDisplayName();
  const avatarUrl = getAvatarUrl();

  const sidebarContent = (
    <aside className="w-72 bg-gray-900 dark:bg-gray-950 text-white h-screen flex flex-col transition-colors duration-300">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Fitness Pro</h1>
            <p className="text-xs text-gray-400">Management System</p>
          </div>
        </div>
      </div>

      {/* User Info - ✅ Updated to show profile image for all roles */}
      <div className="p-4 border-b border-gray-800 dark:border-gray-800">
        <div className="flex items-center gap-3 px-2">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500 shadow-lg"
              onError={(e) => {
                // Fallback if image fails to load
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${avatarUrl ? 'hidden' : ''}`}
          >
            {getInitials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {displayName}
            </p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {user?.role === "user" && (
          <>
            <NavLink to="/user" end className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </NavLink>
            <NavLink to="/user/workouts" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Workouts
            </NavLink>
            <NavLink to="/user/bookings" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Bookings
            </NavLink>
            <NavLink to="/user/progress" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Progress
            </NavLink>
            <NavLink to="/user/meals" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Meals
            </NavLink>
            <NavLink to="/user/memberships" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Memberships
            </NavLink>
            <NavLink to="/user/coaches" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Find Coaches
            </NavLink>
            
            {/* ✅ Added Profile link for users */}
            <NavLink to="/user/profile" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </NavLink>

            <NavLink to="/user/chat" className={linkClass}>
              {({ isActive }) => (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1">Messages</span>
                  <UnreadBadge isActive={isActive} />
                </>
              )}
            </NavLink>
          </>
        )}

        {user?.role === "coach" && (
          <>
            <NavLink to="/coach" end className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </NavLink>
            <NavLink to="/coach/users" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              My Trainees
            </NavLink>
            <NavLink to="/coach/bookings" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Bookings
            </NavLink>
            <NavLink to="/coach/profile" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </NavLink>
            <NavLink to="/coach/packages" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              My Packages
            </NavLink>
            <NavLink to="/coach/chat" className={linkClass}>
              {({ isActive }) => (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1">Messages</span>
                  <UnreadBadge isActive={isActive} />
                </>
              )}
            </NavLink>
          </>
        )}

        {user?.role === "owner" && (
          <>
            <NavLink to="/owner" end className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              All Branches
            </NavLink>

            {/* My Profile - Added for Owner */}
            <NavLink to="/owner/profile" className={linkClass}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              My Profile
            </NavLink>

            {branchId && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Current Branch
                  </p>
                </div>
                <NavLink to={`/owner/${branchId}`} end className={linkClass}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Overview
                </NavLink>
                <NavLink to={`/owner/${branchId}/coaches`} className={linkClass}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Coaches
                </NavLink>
                <NavLink to={`/owner/${branchId}/subscriptions`} className={linkClass}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                  Subscriptions
                </NavLink>

                <NavLink to={`/owner/${branchId}/admins`} className={linkClass}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Admins
                </NavLink>
              </>
            )}

            {/* Chat for owner - always available */}
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Communication
              </p>
            </div>
            <NavLink to="/owner/chat" className={linkClass}>
              {({ isActive }) => (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1">Messages</span>
                  <UnreadBadge isActive={isActive} />
                </>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-gray-800 dark:border-gray-800 space-y-2">
        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-gray-800/50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-300">Dark Mode</span>
          <ThemeToggle />
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
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

  return (
    <>
      {/* Hamburger button — mobile only */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-gray-900 text-white rounded-xl shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop — mobile only */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`md:hidden fixed top-0 left-0 h-full z-50 transform transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebarContent}
      </div>

      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex sticky top-0 h-screen">
        {sidebarContent}
      </div>
    </>
  );
}