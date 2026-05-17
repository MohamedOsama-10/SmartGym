//D:\gym_system\gym-project\frontend\src\App.jsx
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProfileProvider } from './context/ProfileContext';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Logout from './pages/Logout';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import CoachDashboard from './pages/coach/CoachDashboard';
import UserDashboard from './pages/user/UserDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import Notifications from './pages/Notifications';
import { useAuth } from './context/AuthContext';
import PropTypes from 'prop-types';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired
};

// Loading Component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">💪</span>
        </div>
      </div>
    </div>
  );
}

// Protected Route Component - Now with ProfileProvider inside
function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, isReady } = useAuth();
  
  // Wait for auth to be ready
  if (loading || !isReady) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  }
  
  // Check role against allowed roles (lowercase)
  if (allowedRoles && !allowedRoles.includes(user.role?.toLowerCase())) {
    const roleDashboard = {
      'owner': '/owner',
      'admin': '/admin',
      'coach': '/coach',
      'user': '/user'
    };
    const redirectTo = roleDashboard[user.role?.toLowerCase()] || '/login';
    return <Navigate to={redirectTo} replace />;
  }
  
  // Wrap with ErrorBoundary and Suspense
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.string)
};

ProtectedRoute.defaultProps = {
  allowedRoles: null
};

// Role-based redirect for root path
function RoleBasedRedirect() {
  const { user, loading, isReady } = useAuth();
  
  if (loading || !isReady) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  const roleDashboard = {
    'owner': '/owner',
    'admin': '/admin',
    'coach': '/coach',
    'user': '/user'
  };
  
  const targetRoute = roleDashboard[user.role?.toLowerCase()] || '/login';
  return <Navigate to={targetRoute} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes - NO ProfileProvider */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/logout" element={<Logout />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Protected Routes - ProfileProvider wraps each dashboard */}
      <Route 
        path="/admin/*" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/owner/*" 
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <OwnerDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/coach/*" 
        element={
          <ProtectedRoute allowedRoles={['coach']}>
            <CoachDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/user/*" 
        element={
          <ProtectedRoute allowedRoles={['user']}>
            <UserDashboard />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } 
      />
      
      {/* Root path - auto redirect based on role */}
      <Route path="/" element={<RoleBasedRedirect />} />
      
      {/* 404 - Not Found */}
      <Route 
        path="*" 
        element={
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="text-center">
              <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">Page not found</p>
              <a 
                href="/" 
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Go Home
              </a>
            </div>
          </div>
        } 
      />
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AuthProvider>
          <ProfileProvider>
            <NotificationProvider>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </NotificationProvider>
          </ProfileProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;