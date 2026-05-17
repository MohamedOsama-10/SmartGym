// src/pages/coach/CoachDashboard.jsx
import React, { Suspense, useState, useEffect, useRef } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { ChatProvider } from "../../context/ChatContext";
import NotificationCenter from "../../components/NotificationCenter";
import ChatNotificationBridge from "../../components/chat/ChatNotificationBridge";
import coachAPI from "../../services/coachAPI";

// Lazy load sub-pages
const Users = React.lazy(() => import('./Users'));
const Bookings = React.lazy(() => import('./Bookings'));
const ChatPage = React.lazy(() => import('../../components/chat/ChatPage'));
const CoachProfile = React.lazy(() => import('./CoachProfile'));
const Programs = React.lazy(() => import('./Programs'));
const ProgramDetails = React.lazy(() => import('./ProgramDetails'));
const NewProgram = React.lazy(() => import('./NewProgram'));

// Helper functions for streak management
const getTodayKey = () => new Date().toISOString().split('T')[0];

const getStreakData = () => {
  const stored = localStorage.getItem('coachStreakData');
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    streak: 0,
    lastLoginDate: null,
    loginDates: []
  };
};

const saveStreakData = (data) => {
  localStorage.setItem('coachStreakData', JSON.stringify(data));
};

const calculateStreak = () => {
  const data = getStreakData();
  const today = getTodayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];

  if (data.lastLoginDate === today) {
    return data.streak;
  }

  if (data.lastLoginDate === yesterdayKey || data.lastLoginDate === null) {
    const newStreak = data.streak + 1;
    const updatedData = {
      streak: newStreak,
      lastLoginDate: today,
      loginDates: [...data.loginDates, today]
    };
    saveStreakData(updatedData);
    return newStreak;
  }

  const updatedData = {
    streak: 1,
    lastLoginDate: today,
    loginDates: [today]
  };
  saveStreakData(updatedData);
  return 1;
};

// Loading fallback component
const DashboardFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="relative">
      <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl">💪</span>
      </div>
    </div>
  </div>
);

export default React.memo(function CoachDashboard() {
  const navigate = useNavigate();
  
  const [coachData, setCoachData] = useState({
    name: "Loading...",
    rating: 0,
    totalClients: 0,
    unreadMessages: 0,
    earningsThisMonth: 0,
    successRate: 0,
    isLoading: true,
    error: null
  });
  
  const [streak, setStreak] = useState(0);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);

  // Chat search state
  const [chatSearch, setChatSearch] = useState('');
  const [chatSearchResults, setChatSearchResults] = useState([]);
  const [showChatDropdown, setShowChatDropdown] = useState(false);
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const chatSearchRef = useRef(null);
  const chatSearchTimeout = useRef(null);

  // Outside-click handler — must be before any early returns
  useEffect(() => {
    const handler = (e) => {
      if (chatSearchRef.current && !chatSearchRef.current.contains(e.target))
        setShowChatDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const profile = await coachAPI.getProfile();
        const bookings = await coachAPI.getBookings({ limit: 200 });

        // Total distinct clients — use backend-computed value (status: upcoming/confirmed/attended)
        const totalClients = profile.total_clients || 0;

        // Success rate = attended / (attended + cancelled + missed) sessions
        const completedSessions = bookings.filter(b => b.status === 'attended').length;
        const decidedSessions   = bookings.filter(b => ['attended','cancelled','missed'].includes(b.status)).length;
        const successRate = decidedSessions > 0 ? Math.round((completedSessions / decidedSessions) * 100) : 0;

        // Monthly earnings: attended sessions this month × hourly rate
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyCompleted = bookings.filter(b => {
          const bookingDate = new Date(b.session_date);
          return bookingDate >= startOfMonth && b.status === 'attended';
        });
        const earningsThisMonth = monthlyCompleted.reduce(
          (sum, b) => sum + (b.price || profile.hourly_rate || 0), 0
        );

        // Active clients this month (had a confirmed/attended booking this month)
        const activeThisMonth = new Set(
          bookings
            .filter(b => {
              const d = new Date(b.session_date);
              return d >= startOfMonth && ['confirmed', 'attended', 'upcoming'].includes(b.status);
            })
            .map(b => b.customer_id)
        ).size;

        // Unread messages: sum unreadCount from all conversations
        let unreadMessages = 0;
        try {
          const token = localStorage.getItem('access_token');
          if (token) {
            const chatRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1'}/chat/conversations`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (chatRes.ok) {
              const convs = await chatRes.json();
              unreadMessages = (convs || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);
            }
          }
        } catch (_) { /* chat errors are non-fatal */ }

        setCoachData({
          name: profile.name || profile.email,
          rating: profile.rating || 0,
          totalClients,
          activeThisMonth,
          unreadMessages,
          earningsThisMonth,
          successRate,
          isLoading: false,
          error: null,
          ...profile
        });
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setCoachData(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }));
      }
    };

    fetchDashboardData();
    
    const prevData = getStreakData();
    const wasAlreadyToday = prevData.lastLoginDate === getTodayKey();
    const currentStreak = calculateStreak();
    setStreak(currentStreak);
    // Only animate when streak actually incremented (first visit today)
    if (!wasAlreadyToday && currentStreak > 1) {
      setShowStreakAnimation(true);
      const timer = setTimeout(() => setShowStreakAnimation(false), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const calculateProgress = (current, goal) => {
    return Math.min((current / goal) * 100, 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage < 50) return "from-red-500 to-red-600";
    if (percentage < 85) return "from-amber-500 to-orange-600";
    if (percentage <= 100) return "from-emerald-500 to-green-600";
    return "from-blue-500 to-indigo-600";
  };

  const getStreakMessage = (streakCount) => {
    if (streakCount === 1) return "First Day! 🎉";
    if (streakCount === 7) return "One Week! 🔥";
    if (streakCount === 30) return "One Month! 💪";
    if (streakCount === 100) return "Century! 🏆";
    if (streakCount >= 365) return "One Year! 🌟";
    return "Coaching Days";
  };

  if (coachData.isLoading) {
    return <DashboardFallback />;
  }

  if (coachData.error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600">
        <div className="text-center">
          <p className="text-xl font-bold mb-2">Error loading dashboard</p>
          <p>{coachData.error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Chat search: admins + coach's clients/subscribers ──────────────────
  const handleChatSearch = (q) => {
    setChatSearch(q);
    setShowChatDropdown(true);
    clearTimeout(chatSearchTimeout.current);
    if (!q.trim()) { setChatSearchResults([]); return; }
    setChatSearchLoading(true);
    chatSearchTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        const base = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
        const API_ORIGIN = import.meta.env.VITE_API_URL
          ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
          : 'http://127.0.0.1:8000';
        const headers = { Authorization: `Bearer ${token}` };

        // Search in parallel: admins + all users (clients/subscribers come from here)
        const [adminsRes, usersRes] = await Promise.all([
          fetch(`${base}/admin/users/?role=admin&search=${encodeURIComponent(q)}`, { headers }),
          fetch(`${base}/admin/users/?search=${encodeURIComponent(q)}`, { headers }),
        ]);

        const admins = adminsRes.ok ? await adminsRes.json() : [];
        const users  = usersRes.ok  ? await usersRes.json()  : [];

        // Merge, deduplicate by id, exclude self
        const currentUser = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
        const seen = new Set();
        const merged = [...(Array.isArray(admins) ? admins : []), ...(Array.isArray(users) ? users : [])]
          .filter(u => {
            if (u.id === currentUser.id) return false;
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          })
          .slice(0, 8)
          .map(u => ({
            id: u.id,
            name: u.full_name || u.email || '',
            email: u.email || '',
            role: u.role || 'user',
            avatarSrc: u.avatar_url
              ? (u.avatar_url.startsWith('http') ? u.avatar_url : `${API_ORIGIN}${u.avatar_url}`)
              : null,
          }));

        setChatSearchResults(merged);
      } catch { setChatSearchResults([]); }
      finally { setChatSearchLoading(false); }
    }, 300);
  };

  const openChatWith = (result) => {
    setChatSearch('');
    setChatSearchResults([]);
    setShowChatDropdown(false);
    navigate('/coach/chat', {
      state: { openUserId: result.id, openUserName: result.name, openUserAvatar: result.avatarSrc },
    });
  };

  return (
    <ChatProvider>
      <ChatNotificationBridge />
        <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
          <Sidebar />
          <div className="flex-1 pt-16 md:pt-0 flex flex-col min-h-screen">
            <header className="relative z-50 flex items-center justify-between px-4 md:px-6 py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Coach Dashboard</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Welcome back, {coachData.name}</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Chat User Search */}
                <div className="relative hidden md:block" ref={chatSearchRef}>
                  <input
                    type="text"
                    placeholder="Search admins, clients..."
                    value={chatSearch}
                    onChange={e => handleChatSearch(e.target.value)}
                    onFocus={() => chatSearch && setShowChatDropdown(true)}
                    onKeyDown={e => e.key === 'Escape' && setShowChatDropdown(false)}
                    className="w-56 pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {showChatDropdown && chatSearch.trim() && (
                    <div className="absolute top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                      {chatSearchLoading ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">Searching...</p>
                        </div>
                      ) : chatSearchResults.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 px-4 py-3">No users found</p>
                      ) : chatSearchResults.map(r => (
                        <button key={r.id} onClick={() => openChatWith(r)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {r.avatarSrc
                              ? <img src={r.avatarSrc} alt={r.name} className="w-full h-full object-cover"
                                  onError={e => { e.target.style.display='none'; e.target.parentNode.innerText=r.name.slice(0,2).toUpperCase(); }} />
                              : r.name.slice(0,2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.email}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                              r.role === 'coach' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            } capitalize`}>{r.role}</span>
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <NotificationCenter />
                <button
                  onClick={() => navigate('/coach/profile')}
                  className="relative group"
                  title="View Profile"
                >
                  {coachData.avatar_url ? (
                    <img
                      src={coachData.avatar_url}
                      alt={coachData.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-200 cursor-pointer"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                  ) : null}
                  <div
                    className={`w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full items-center justify-center text-white text-sm font-bold shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-200 cursor-pointer ${coachData.avatar_url ? 'hidden' : 'flex'}`}
                  >
                    {coachData.name ? coachData.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    View Profile
                  </div>
                </button>
              </div>
            </header>

            <main className="flex-1 p-4 md:p-8 overflow-auto">
              <Suspense fallback={<DashboardFallback />}>
                <Routes>
                  <Route
                    index
                    element={
                      <DashboardHome 
                        coachData={coachData} 
                        streak={streak} 
                        showStreakAnimation={showStreakAnimation}
                        calculateProgress={calculateProgress}
                        getProgressColor={getProgressColor}
                        getStreakMessage={getStreakMessage}
                      />
                    }
                  />
                  <Route path="users" element={<Users coachData={coachData} />} />
                  <Route path="bookings" element={<Bookings />} />
                  <Route path="chat" element={<ChatPage userRole="coach" />} />
                  <Route path="profile" element={<CoachProfile coachData={coachData} />} />
                  <Route path="programs" element={<Programs />} />
                  <Route path="programs/new" element={<NewProgram />} />
                  <Route path="programs/:id" element={<ProgramDetails />} />
                  <Route path="packages" element={<MyPackagesPage />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </div>
    </ChatProvider>
  );
});

// Dashboard Home Component - Extracted to avoid JSX nesting issues
function DashboardHome({ 
  coachData, 
  streak, 
  showStreakAnimation,
  calculateProgress,
  getProgressColor,
  getStreakMessage
}) {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-4 md:p-8 lg:p-10">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg animate-bounce-slow">
                  👨‍🏫
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tight">
                    Welcome back, {coachData.name}!
                  </h1>
                  <p className="text-indigo-100 flex items-center gap-2 mt-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {coachData.rating} Rating • {coachData.totalClients} Clients
                  </p>
                </div>
              </div>
            </div>
            
            <div className={`relative group ${showStreakAnimation ? 'animate-streak-pop' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition animate-pulse-slow"></div>
              <div className="relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-6 shadow-2xl transform group-hover:scale-105 transition">
                <div className="text-center">
                  <div className="text-5xl mb-2 animate-fire">🔥</div>
                  <div className="text-4xl font-black text-white mb-1">
                    {streak}
                  </div>
                  <div className="text-orange-100 text-sm font-semibold uppercase tracking-wider">
                    {getStreakMessage(streak)}
                  </div>
                </div>
                {showStreakAnimation && (
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-lg animate-bounce">
                    +1
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streak Milestones */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Coaching Streak Progress</h3>
        <div className="relative">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 transition-all duration-1000"
              style={{ width: `${((streak % 7 || 7) / 7) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Day {streak % 7 || 7}/7</span>
            <span>{streak % 7 === 0 ? "Weekly bonus reached! 🎉" : `${7 - (streak % 7)} days to weekly bonus`}</span>
          </div>
          <div className="flex justify-between mt-4">
            {[7, 30, 100, 365].map((milestone) => (
              <div key={milestone} className={`text-center ${streak >= milestone ? 'text-orange-500' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${streak >= milestone ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {streak >= milestone ? '🔥' : '🔒'}
                </div>
                <span className="text-xs font-medium">{milestone}d</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Cards */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Clients */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border-2 border-blue-200 dark:border-blue-800 hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">👥</span>
                <span className="text-xs font-bold px-2 py-1 bg-blue-500 text-white rounded-full">
                  {coachData.activeThisMonth || 0} this month
                </span>
              </div>
              <div className="mb-2">
                <div className="text-sm text-blue-700 dark:text-blue-300 font-semibold mb-1">Total Clients</div>
                <div className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400">
                  {coachData.totalClients}
                </div>
                <div className="text-xs text-blue-600/70 dark:text-blue-400/70">
                  {coachData.activeThisMonth || 0} active this month
                </div>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-5 border-2 border-purple-200 dark:border-purple-800 hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">💰</span>
                <span className="text-xs font-bold px-2 py-1 bg-purple-500 text-white rounded-full">
                  {coachData.earningsThisMonth > 0 ? 'EGP' : '—'}
                </span>
              </div>
              <div className="mb-2">
                <div className="text-sm text-purple-700 dark:text-purple-300 font-semibold mb-1">Earnings</div>
                <div className="text-2xl md:text-3xl font-black text-purple-600 dark:text-purple-400">
                  {coachData.earningsThisMonth}
                </div>
                <div className="text-xs text-purple-600/70 dark:text-purple-400/70">
                  This month (EGP)
                </div>
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-5 border-2 border-amber-200 dark:border-amber-800 hover:shadow-xl hover:scale-105 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-3xl">🏆</span>
                <span className="text-xs font-bold px-2 py-1 bg-amber-500 text-white rounded-full">
                  {coachData.successRate}%
                </span>
              </div>
              <div className="mb-2">
                <div className="text-sm text-amber-700 dark:text-amber-300 font-semibold mb-1">Success Rate</div>
                <div className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-400">
                  {coachData.successRate}%
                </div>
                <div className="text-xs text-amber-600/70 dark:text-amber-400/70">
                  Completed sessions
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coach's Note */}
        {coachData.successRate > 90 && (
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-6 border-2 border-indigo-200 dark:border-indigo-800">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                  💬 Coach's Insight
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Excellent performance this month! Keep up the great work with your clients.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* My Trainees Card */}
        <Link to="users" className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-10 transition"></div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <span className="text-3xl">👥</span>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">My Trainees</h3>
            <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
              {coachData.totalClients}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getProgressColor(calculateProgress(coachData.totalClients, 150))} transition-all duration-1000`}
                  style={{ width: `${calculateProgress(coachData.totalClients, 150)}%` }}
                ></div>
              </div>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                {Math.round(calculateProgress(coachData.totalClients, 150))}%
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">of 150 client goal</p>
          </div>
        </Link>

        {/* Bookings Card */}
        <Link to="bookings" className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:scale-105">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-0 group-hover:opacity-10 transition"></div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <span className="text-3xl">📅</span>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-purple-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Bookings</h3>
            <p className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white mb-2">
              Manage
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage sessions
            </p>
          </div>
        </Link>

        {/* Chat Card */}
        <Link to="chat" className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105">
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition"></div>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <span className="text-3xl">💬</span>
              </div>
              <svg className="w-6 h-6 text-white/80 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Messages</h3>
            <p className="text-2xl font-black text-white mb-2">
              {coachData.unreadMessages}
            </p>
            <p className="text-sm text-emerald-100">
              Unread messages from clients
            </p>
          </div>
        </Link>
      </div>

      {/* Add custom animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.75;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes fire {
          0%, 100% {
            transform: scale(1) rotate(0deg);
          }
          25% {
            transform: scale(1.1) rotate(-5deg);
          }
          75% {
            transform: scale(1.1) rotate(5deg);
          }
        }

        @keyframes streak-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-fire {
          animation: fire 2s ease-in-out infinite;
        }

        .animate-streak-pop {
          animation: streak-pop 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

// ─── My Packages Page ───────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const getToken = () => localStorage.getItem('access_token');

async function coachApiRequest(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return res.status === 204 ? null : res.json();
}

const STATUS_BADGE = {
  pending:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const COLORS = ['blue', 'green', 'purple', 'orange', 'red'];

const EMPTY_FORM = {
  package_name: '',
  sessions: '',
  price: '',
  period: '',
  original_price: '',
  features: '',
  is_popular: false,
  color: 'blue',
};

function MyPackagesPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [modal, setModal]       = useState(null); // null | { mode:'add'|'edit', pkg? }
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await coachApiRequest('/coaches/me/packages');
      setPackages(data);
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd  = () => { setForm(EMPTY_FORM); setModal({ mode: 'add' }); };
  const openEdit = (pkg) => {
    setForm({
      package_name:   pkg.package_name ?? '',
      sessions:       pkg.sessions ?? '',
      price:          pkg.price ?? '',
      period:         pkg.period ?? '',
      original_price: pkg.original_price ?? '',
      features:       Array.isArray(pkg.features) ? pkg.features.join(', ') : '',
      is_popular:     pkg.is_popular ?? false,
      color:          pkg.color ?? 'blue',
    });
    setModal({ mode: 'edit', pkg });
  };
  const closeModal = () => { setModal(null); setSaving(false); };

  const handleSave = async () => {
    if (!form.package_name.trim() || !form.sessions || !form.price) {
      showToast('Package name, sessions, and price are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const body = {
        package_name:   form.package_name,
        sessions:       parseInt(form.sessions),
        price:          parseFloat(form.price),
        period:         form.period || null,
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        features:       form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
        is_popular:     form.is_popular,
        color:          form.color,
      };
      if (modal.mode === 'add') {
        await coachApiRequest('/coaches/me/packages', { method: 'POST', body: JSON.stringify(body) });
        showToast('Package created — pending admin approval');
      } else {
        await coachApiRequest(`/coaches/me/packages/${modal.pkg.id}`, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Package updated — pending re-approval');
      }
      closeModal();
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await coachApiRequest(`/coaches/me/packages/${deleteTarget.id}`, { method: 'DELETE' });
      showToast('Package removed');
      setDeleteTarget(null);
      load();
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-4 md:p-8">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px,white 1px,transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-1">My Packages</h2>
            <p className="text-blue-100 text-sm">New packages require admin approval before becoming visible to members</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-bold rounded-2xl shadow-lg hover:bg-blue-50 transition-all hover:scale-105 active:scale-95">
            <span className="text-xl">+</span> Add Package
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[9999] px-6 py-4 rounded-2xl shadow-2xl text-white font-semibold flex items-center gap-3 ${
          toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'
        }`}>
          <span>{toast.type === 'error' ? '✗' : '✓'}</span>
          {toast.msg}
        </div>
      )}

      {/* Packages grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-100 dark:border-gray-700">
          <div className="text-6xl mb-4">📦</div>
          <p className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">No packages yet</p>
          <p className="text-gray-400 mb-6">Create your first coaching package to offer to members</p>
          <button onClick={openAdd} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition">
            Add Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">{pkg.package_name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{pkg.period || 'No period'} · {pkg.sessions} sessions</p>
                  </div>
                  <span className={`ml-2 px-3 py-1 rounded-full text-xs font-bold capitalize shrink-0 ${STATUS_BADGE[pkg.status] || STATUS_BADGE.pending}`}>
                    {pkg.status}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-gray-900 dark:text-white">{pkg.price} EGP</span>
                    {pkg.original_price && (
                      <span className="text-sm text-gray-400 line-through">{pkg.original_price} EGP</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                    <span className="text-blue-500 text-sm">👥</span>
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{pkg.subscriber_count ?? 0}</span>
                    <span className="text-xs text-blue-400 dark:text-blue-500">members</span>
                  </div>
                </div>

                {pkg.price_per_session && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{pkg.price_per_session} EGP / session</p>
                )}

                {Array.isArray(pkg.features) && pkg.features.length > 0 && (
                  <ul className="space-y-1 mb-3">
                    {pkg.features.map((f, i) => (
                      <li key={i} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                        <span className="text-emerald-500">✓</span>{f}
                      </li>
                    ))}
                  </ul>
                )}

                {pkg.status === 'rejected' && pkg.rejection_reason && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Rejection reason:</p>
                    <p className="text-xs text-red-500 dark:text-red-300">{pkg.rejection_reason}</p>
                  </div>
                )}

                {pkg.status === 'pending' && (
                  <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">Awaiting admin approval</p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-900/30">
                <button onClick={() => openEdit(pkg)}
                  className="flex-1 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition">
                  Edit
                </button>
                <button onClick={() => setDeleteTarget(pkg)}
                  className="flex-1 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white">
                {modal.mode === 'add' ? 'Add New Package' : 'Edit Package'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Package Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Package Name *</label>
                <input type="text" value={form.package_name} onChange={e => setForm(f => ({ ...f, package_name: e.target.value }))}
                  placeholder="e.g. Premium Monthly"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
              </div>
              {/* Sessions & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sessions *</label>
                  <input type="number" min="1" value={form.sessions} onChange={e => setForm(f => ({ ...f, sessions: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Price (EGP) *</label>
                  <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="e.g. 1200"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
              </div>
              {/* Period & Original Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Period</label>
                  <input type="text" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    placeholder="e.g. 1 Month"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Original Price</label>
                  <input type="number" min="0" step="0.01" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white" />
                </div>
              </div>
              {/* Features */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Features (comma-separated)</label>
                <textarea rows={3} value={form.features} onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
                  placeholder="e.g. Nutrition plan, Weekly check-in, Custom workouts"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white resize-none" />
              </div>
              {/* Color */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${form.color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: { blue: '#3b82f6', green: '#22c55e', purple: '#a855f7', orange: '#f97316', red: '#ef4444' }[c] }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
              {/* Popular toggle */}
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, is_popular: !f.is_popular }))}
                  className={`relative w-12 h-6 rounded-full transition-colors ${form.is_popular ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_popular ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Mark as Popular</span>
              </div>

              <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                New packages require admin approval before becoming visible to members.
              </p>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex gap-3 justify-end">
              <button onClick={closeModal}
                className="px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-50 flex items-center gap-2">
                {saving && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {modal.mode === 'add' ? 'Create Package' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
            <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl">🗑️</div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Delete Package?</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This will deactivate <span className="font-bold text-gray-900 dark:text-white">{deleteTarget.package_name}</span> and hide it from members.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center gap-2">
                {deleting && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}