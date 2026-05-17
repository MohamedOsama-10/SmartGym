import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useProfile } from "../../context/ProfileContext";
import Sidebar from "../../components/Sidebar";
import { ChatProvider } from "../../context/ChatContext";
import NotificationCenter from "../../components/NotificationCenter";
import ChatNotificationBridge from "../../components/chat/ChatNotificationBridge";
import Memberships from "./Memberships";
import CoachDirectory from "./CoachDirectory";
import PropTypes from 'prop-types';

// Lazy load sub-pages
const Workouts = React.lazy(() => import('./Workouts'));
const Bookings = React.lazy(() => import('./Bookings'));
const Progress = React.lazy(() => import('./Progress'));
const Meals = React.lazy(() => import('./Meals'));
const ChatPage = React.lazy(() => import('../../components/chat/ChatPage'));
const UserProfile = React.lazy(() => import('./UserProfile'));

// Error Boundary for Dashboard
class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-red-600 mb-4">Dashboard Error</h2>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

DashboardErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

// Nutrition Card Component
const NutritionCard = React.memo(function NutritionCard({ 
  icon, 
  label, 
  current, 
  goal, 
  unit = 'g',
  colorScheme 
}) {
  const percentage = useMemo(() => {
    if (!goal || goal === 0) return 0;
    return Math.min((current / goal) * 100, 100);
  }, [current, goal]);

  const colors = {
    orange: {
      bg: 'from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      accent: 'bg-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
      subtext: 'text-orange-600/70 dark:text-orange-400/70',
      bar: 'from-orange-500 to-red-500',
      bgBar: 'bg-orange-200 dark:bg-orange-900'
    },
    blue: {
      bg: 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      accent: 'bg-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
      subtext: 'text-blue-600/70 dark:text-blue-400/70',
      bar: 'from-blue-500 to-indigo-500',
      bgBar: 'bg-blue-200 dark:bg-blue-900'
    },
    emerald: {
      bg: 'from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20',
      border: 'border-emerald-200 dark:border-emerald-800',
      accent: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      subtext: 'text-emerald-600/70 dark:text-emerald-400/70',
      bar: 'from-emerald-500 to-green-500',
      bgBar: 'bg-emerald-200 dark:bg-emerald-900'
    },
    amber: {
      bg: 'from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      accent: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      subtext: 'text-amber-600/70 dark:text-amber-400/70',
      bar: 'from-amber-500 to-yellow-500',
      bgBar: 'bg-amber-200 dark:bg-amber-900'
    }
  };

  const theme = colors[colorScheme] || colors.orange;

  const remaining = goal - current;
  const isOver = current > goal;

  return (
    <div
      className={`group relative overflow-hidden bg-gradient-to-br ${theme.bg} rounded-2xl p-4 md:p-5 border-2 ${theme.border} hover:shadow-xl hover:scale-105 transition-all duration-300`}
      role="region"
      aria-label={`${label} tracking`}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 ${theme.accent}/10 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition`}></div>
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl" role="img" aria-label={label}>{icon}</span>
          <span className={`text-xs font-bold px-2 py-1 ${isOver ? 'bg-red-500' : theme.accent} text-white rounded-full`}>
            {Math.round(percentage)}%
          </span>
        </div>
        <div className="mb-2">
          <div className={`text-sm ${theme.subtext} font-semibold mb-1`}>{label}</div>
          <div className={`text-xl md:text-2xl font-black ${theme.text} truncate`}>
            {current}{unit}
          </div>
          <div className={`text-xs ${theme.subtext}`}>
            of {goal}{unit}
          </div>
        </div>
        <div
          className={`h-2.5 ${theme.bgBar} rounded-full overflow-hidden shadow-inner`}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label={`${label} progress`}
        >
          <div
            className={`h-full bg-gradient-to-r ${isOver ? 'from-red-500 to-red-600' : theme.bar} rounded-full shadow-lg transition-all duration-1000 ease-out`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
        <div className="mt-2 text-xs font-medium">
          {percentage >= 100 ? (
            <span className="text-green-600 dark:text-green-400">Goal reached! {isOver ? `+${Math.round(current - goal)}${unit} over` : ''}</span>
          ) : (
            <span className={theme.subtext}>{Math.round(remaining)}{unit} remaining</span>
          )}
        </div>
      </div>
    </div>
  );
});

NutritionCard.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  current: PropTypes.number.isRequired,
  goal: PropTypes.number.isRequired,
  unit: PropTypes.string,
  colorScheme: PropTypes.oneOf(['orange', 'blue', 'emerald', 'amber']).isRequired
};

// Quick Action Card Component
const QuickActionCard = React.memo(function QuickActionCard({ 
  to, 
  icon, 
  title, 
  subtitle, 
  value, 
  colorScheme = 'blue',
  isSpecial = false
}) {
  const colors = {
    orange: 'from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700',
    blue: 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700',
    purple: 'from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700',
    emerald: 'from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
  };

  if (isSpecial) {
    return (
      <Link 
        to={to} 
        className={`group relative overflow-hidden bg-gradient-to-br ${colors[colorScheme]} rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 block`}
        aria-label={title}
      >
        <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition"></div>
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition">
              <span className="text-2xl md:text-3xl" role="img" aria-hidden="true">{icon}</span>
            </div>
            <svg className="w-5 h-5 text-white/80 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
          <h3 className="text-base md:text-lg font-bold text-white mb-1 truncate">{title}</h3>
          <p className="text-lg md:text-2xl font-black text-white mb-1 truncate">{value}</p>
          <p className="text-xs md:text-sm text-white/80 line-clamp-2">{subtitle}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link 
      to={to} 
      className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:scale-105 block"
      aria-label={title}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[colorScheme]} opacity-0 group-hover:opacity-10 transition`}></div>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${colors[colorScheme]} flex items-center justify-center shadow-lg group-hover:scale-110 transition`}>
            <span className="text-2xl md:text-3xl" role="img" aria-hidden="true">{icon}</span>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white mb-1 truncate">{title}</h3>
        <p className="text-xl md:text-3xl font-black text-gray-900 dark:text-white mb-1 truncate">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{subtitle}</p>
      </div>
    </Link>
  );
});

QuickActionCard.propTypes = {
  to: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  colorScheme: PropTypes.oneOf(['orange', 'blue', 'purple', 'emerald']),
  isSpecial: PropTypes.bool
};

// Local-timezone date string helper (YYYY-MM-DD) — avoids UTC offset bugs
function toLocalDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default React.memo(function UserDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, apiRequest } = useAuth();
  const { profile, loading: profileLoading } = useProfile();

  const [bookings, setBookings] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [nutrition, setNutrition] = useState(null);
  const [workoutStats, setWorkoutStats] = useState({ completed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [streak, setStreak] = useState(0);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  // Prevent the isDashboardHome effect from double-firing on initial mount
  const isFirstRender = useRef(true);

  // Memoized default nutrition data
  const defaultNutrition = useMemo(() => ({
    goals: {
      calories: 2500,
      protein: 150,
      carbs: 300,
      fats: 80,
      notes: "Stay consistent with your nutrition plan!"
    },
    today: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0
    }
  }), []);


  // Load dashboard data — defined as useCallback so it can be called from multiple effects
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let streakTimeout;

    try {
      const [bookingsRes, gymsRes, nutritionRes, workoutRes] = await Promise.all([
        apiRequest('/bookings/my-bookings').catch(err => {
          console.error('Bookings fetch error:', err);
          return [];
        }),
        apiRequest('/gyms/').catch(err => {
          console.error('Gyms fetch error:', err);
          return [];
        }),
        apiRequest('/meals/logs/today').catch(err => {
          console.error('Nutrition fetch error:', err);
          return null;
        }),
        apiRequest('/workouts/my-workouts/history?days=7').catch(err => {
          console.error('Workout fetch error:', err);
          return null;
        })
      ]);

      setBookings(bookingsRes || []);
      setGyms(gymsRes || []);

      if (nutritionRes) {
        setNutrition({
          goals: nutritionRes.goal || defaultNutrition.goals,
          today: nutritionRes.totals || defaultNutrition.today
        });
      } else {
        setNutrition(defaultNutrition);
      }

      // Count this week's completed workouts from localStorage (training programs)
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
      startOfWeek.setHours(0, 0, 0, 0);
      let localCompleted = 0;
      try {
        const stored = JSON.parse(localStorage.getItem(`completedWorkoutDays_${user?.id || 'guest'}`) || "{}");
        localCompleted = Object.values(stored).filter(
          v => v.completedAt && new Date(v.completedAt) >= startOfWeek
        ).length;
      } catch {}
      // Also count coach-assigned workouts completed this week (from API)
      const apiCompleted = workoutRes?.stats?.thisWeek || 0;
      setWorkoutStats({
        completed: localCompleted + apiCompleted,
        total: workoutRes?.history?.length || 0
      });

      // Streak from localStorage workout completions
      let storedDays = {};
      try { storedDays = JSON.parse(localStorage.getItem(`completedWorkoutDays_${user?.id || 'guest'}`) || "{}"); } catch {}
      const completedDates = new Set(
        Object.values(storedDays)
          .filter(v => v.completedAt)
          .map(v => v.completedAt.slice(0, 10))
      );
      let newStreak = 0;
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = toLocalDateStr(d);
        if (completedDates.has(key)) newStreak++;
        else if (i > 0) break;
      }
      setStreak(newStreak);

    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError("Failed to load dashboard data. Please try again later.");
    } finally {
      setLoading(false);
    }

    return () => { if (streakTimeout) clearTimeout(streakTimeout); };
  }, [apiRequest, defaultNutrition]);

  // Initial load on mount
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Refetch when user navigates back to the dashboard home (skip initial mount — covered by mount effect)
  const isDashboardHome = location.pathname === '/user' || location.pathname === '/user/';
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isDashboardHome) {
      loadDashboardData();
    }
  }, [isDashboardHome, loadDashboardData]);

  // Refetch when the browser tab becomes visible again (user switches back)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadDashboardData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadDashboardData]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, [logout, navigate]);

  const getStatusColor = useCallback((status) => {
    const colors = {
      'PENDING': 'bg-yellow-500/20 text-yellow-400',
      'CONFIRMED': 'bg-green-500/20 text-green-400',
      'COMPLETED': 'bg-blue-500/20 text-blue-400',
      'CANCELLED': 'bg-red-500/20 text-red-400',
      'UPCOMING': 'bg-purple-500/20 text-purple-400',
      'ATTENDED': 'bg-emerald-500/20 text-emerald-400'
    };
    return colors[status?.toUpperCase()] || 'bg-gray-500/20 text-gray-400';
  }, []);

  const getStreakMessage = useCallback((streakCount) => {
    if (streakCount === 0) return "Start Today! 🚀";
    if (streakCount === 1) return "First Day! 🎉";
    if (streakCount === 7) return "One Week! 🔥";
    if (streakCount === 30) return "One Month! 💪";
    if (streakCount === 100) return "Century! 🏆";
    if (streakCount >= 365) return "One Year! 🌟";
    return `${streakCount} Day Streak`;
  }, []);

  // Memoized user data with all API connections
  const userData = useMemo(() => ({
    name: user?.full_name || "User",
    coachName: profile?.assigned_coach_name || "Not Assigned",
    nutritionGoals: nutrition?.goals || defaultNutrition.goals,
    todaysNutrition: nutrition?.today || defaultNutrition.today,
    weekStats: {
      workoutsCompleted: workoutStats.completed,
      workoutsGoal: 5,
      avgCalories: nutrition?.today?.calories || 0
    }
  }), [user?.full_name, profile, nutrition, workoutStats, defaultNutrition]);

  if (loading || profileLoading) {
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4" role="img" aria-label="error">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <ChatNotificationBridge />
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-slate-900 dark:to-gray-900">
          <Sidebar />
          <div className="flex-1 pt-16 md:pt-0 flex flex-col min-h-screen">
            {/* Top Header */}
            <header className="relative z-50 flex items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm border-b border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white truncate">Dashboard</h2>
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Welcome back!</p>
              </div>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                {/* Refresh Button */}
                <button
                  onClick={loadDashboardData}
                  disabled={loading}
                  className="p-2 text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-40"
                  title="Refresh data"
                  aria-label="Refresh dashboard data"
                >
                  <svg
                    className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <div className="relative z-50">
                  <NotificationCenter />
                </div>

                {/* Profile Button */}
                <button
                  onClick={() => navigate('/user/profile')}
                  className="relative group"
                  title="View Profile"
                  aria-label="View Profile"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={user?.full_name || 'Profile'}
                      className="w-10 h-10 rounded-full object-cover shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-200"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-200 cursor-pointer">
                      {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                    View Profile
                  </div>
                </button>

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              <Suspense fallback={
                <div className="flex items-center justify-center h-screen">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl" role="img" aria-label="loading">💪</span>
                    </div>
                  </div>
                </div>
              }>
                <DashboardErrorBoundary>
                  <Routes>
                    <Route
                      index
                      element={
                        <div className="w-full space-y-6 animate-fadeIn">
                          {/* Welcome Section */}
                          <section className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-3xl shadow-2xl p-5 md:p-8">
                            <div className="absolute inset-0 opacity-10">
                              <div className="absolute inset-0" style={{
                                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                                backgroundSize: '40px 40px'
                              }}></div>
                            </div>
                            
                            <div className="relative z-10">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-lg animate-bounce-slow">
                                      <span role="img" aria-label="wave">👋</span>
                                    </div>
                                    <div>
                                      <h1 className="text-2xl md:text-3xl xl:text-4xl font-black text-white tracking-tight break-words">
                                        Welcome back, {userData.name}!
                                      </h1>
                                      <p className="text-indigo-100 flex items-center gap-2 mt-1">
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                                        </svg>
                                        Coached by <span className="font-bold text-white">{userData.coachName}</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Streak Badge */}
                                <div 
                                  className={`relative group ${showStreakAnimation ? 'animate-streak-pop' : ''}`}
                                  aria-label={`Current streak: ${streak} days`}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-red-500 rounded-2xl blur-xl opacity-75 group-hover:opacity-100 transition animate-pulse-slow"></div>
                                  <div className="relative bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-4 md:p-6 shadow-2xl transform group-hover:scale-105 transition">
                                    <div className="text-center">
                                      <div className="text-3xl md:text-5xl mb-1 md:mb-2 animate-fire" role="img" aria-label="fire">🔥</div>
                                      <div className="text-3xl md:text-4xl font-black text-white mb-1">
                                        {streak}
                                      </div>
                                      <div className="text-orange-100 text-xs md:text-sm font-semibold uppercase tracking-wider">
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
                          </section>

                          {/* Upcoming Bookings Preview */}
                          {bookings.length > 0 && (
                            <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Upcoming Sessions</h3>
                                <Link to="bookings" className="text-blue-600 hover:text-blue-500 text-sm font-medium">
                                  View All →
                                </Link>
                              </div>
                              <div className="space-y-3">
                                {bookings
                                  .filter(b => ['PENDING', 'CONFIRMED', 'UPCOMING'].includes(b.status?.toUpperCase()))
                                  .slice(0, 3)
                                  .map(booking => (
                                    <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 p-3 md:p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                      <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900 dark:text-white">
                                            {booking.session_date && new Date(`${booking.session_date}T${booking.session_time}`).toLocaleDateString('en-US', {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </p>
                                          <p className="text-sm text-gray-500 dark:text-gray-400">
                                            with Coach {booking.trainer_name || booking.coach?.user?.full_name || 'TBD'}
                                          </p>
                                        </div>
                                      </div>
                                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                        {booking.status}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </section>
                          )}

                          {/* Nutrition Cards */}
                          <section className="relative overflow-hidden bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-4 md:p-6">
                            {/* Section Header */}
                            <div className="flex items-center justify-between mb-5">
                              <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Today's Nutrition Goals</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track your daily macro targets</p>
                              </div>
                              <Link to="meals" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
                                Log Meals →
                              </Link>
                            </div>
                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 mb-6">
                              <NutritionCard
                                icon="🔥"
                                label="Calories"
                                current={userData.todaysNutrition.calories}
                                goal={userData.nutritionGoals.calories}
                                unit=""
                                colorScheme="orange"
                              />
                              <NutritionCard
                                icon="💪"
                                label="Protein"
                                current={userData.todaysNutrition.protein}
                                goal={userData.nutritionGoals.protein}
                                colorScheme="blue"
                              />
                              <NutritionCard
                                icon="🌾"
                                label="Carbs"
                                current={userData.todaysNutrition.carbs}
                                goal={userData.nutritionGoals.carbs}
                                colorScheme="emerald"
                              />
                              <NutritionCard
                                icon="🥑"
                                label="Fats"
                                current={userData.todaysNutrition.fats}
                                goal={userData.nutritionGoals.fats}
                                colorScheme="amber"
                              />
                            </div>

                            {/* Coach's Note */}
                            {userData.nutritionGoals.notes && (
                              <div className="relative overflow-hidden bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl p-4 md:p-6 border-2 border-indigo-200 dark:border-indigo-800">
                                <div className="flex items-start gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">
                                      Coach's Note
                                    </div>
                                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                      {userData.nutritionGoals.notes}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </section>

                          {/* Quick Action Cards */}
                          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
                            <QuickActionCard
                              to="meals"
                              icon="🍽️"
                              title="Today's Meals"
                              value={userData.todaysNutrition.calories}
                              subtitle={`of ${userData.nutritionGoals.calories} kcal goal`}
                              colorScheme="orange"
                            />
                            <QuickActionCard
                              to="workouts"
                              icon="💪"
                              title="This Week"
                              value={`${userData.weekStats.workoutsCompleted}/${userData.weekStats.workoutsGoal}`}
                              subtitle="workouts completed"
                              colorScheme="blue"
                            />
                            <QuickActionCard
                              to="progress"
                              icon="📈"
                              title="Your Progress"
                              value="View Stats"
                              subtitle="View detailed stats & analytics"
                              colorScheme="purple"
                            />
                            <QuickActionCard
                              to="chat"
                              icon="💬"
                              title="Chat with Coach"
                              value={userData.coachName}
                              subtitle="Get instant support & guidance"
                              colorScheme="emerald"
                              isSpecial={true}
                            />
                          </section>
                        </div>
                      }
                    />
                    <Route path="profile" element={<UserProfile />} />
                    <Route path="workouts" element={<Workouts />} />
                    <Route path="bookings" element={<Bookings />} />
                    <Route path="progress" element={<Progress />} />
                    <Route path="meals" element={<Meals />} />
                    <Route path="memberships" element={<Memberships />} />
                    <Route path="coaches" element={<CoachDirectory />} />
                    <Route path="chat" element={<ChatPage userRole="user" />} />
                  </Routes>
                </DashboardErrorBoundary>
              </Suspense>
            </main>
          </div>
        </div>

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
    </ChatProvider>
  );
});