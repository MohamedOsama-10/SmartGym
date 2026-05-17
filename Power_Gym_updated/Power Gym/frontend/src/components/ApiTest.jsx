import { useState } from 'react';
import { authAPI, profileAPI, bookingsAPI, gymsAPI } from '../services/api';

function ApiTest() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test, status, data) => {
    setResults(prev => [...prev, { test, status, data, time: new Date().toLocaleTimeString() }]);
  };

  // ==================== AUTH TESTS ====================
  
  const testSignup = async () => {
    setLoading(true);
    try {
      const data = await authAPI.signup({
        full_name: "Frontend Test User",
        email: `test${Date.now()}@example.com`,
        password: "password123",
        role: "user"
      });
      addResult('✅ SIGNUP', 'SUCCESS', data);
    } catch (err) {
      addResult('❌ SIGNUP', 'FAILED', err.message);
    }
    setLoading(false);
  };

  const testLogin = async () => {
    setLoading(true);
    try {
      const data = await authAPI.login({
        email: "testuser@example.com",
        password: "password123",
        role: "user"
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      addResult('✅ LOGIN', 'SUCCESS', { user: data.user, tokens: 'stored in localStorage' });
    } catch (err) {
      addResult('❌ LOGIN', 'FAILED', err.message);
    }
    setLoading(false);
  };

  const testWrongPassword = async () => {
    setLoading(true);
    try {
      await authAPI.login({
        email: "testuser@example.com",
        password: "wrongpassword",
        role: "user"
      });
      addResult('❌ WRONG PASSWORD', 'SHOULD HAVE FAILED', null);
    } catch (err) {
      addResult('✅ WRONG PASSWORD', 'CORRECTLY REJECTED', err.message);
    }
    setLoading(false);
  };

  const testLogout = async () => {
    setLoading(true);
    try {
      await authAPI.logout();
      localStorage.clear();
      addResult('✅ LOGOUT', 'SUCCESS', 'Tokens cleared');
    } catch (err) {
      addResult('❌ LOGOUT', 'FAILED', err.message);
    }
    setLoading(false);
  };

  // ==================== PROFILE TESTS ====================

  const testGetProfile = async () => {
    setLoading(true);
    try {
      const data = await profileAPI.getCustomerProfile();
      addResult('✅ GET PROFILE', 'SUCCESS', data);
    } catch (err) {
      addResult('❌ GET PROFILE', 'FAILED', err.message);
    }
    setLoading(false);
  };

  const testUpdateProfile = async () => {
    setLoading(true);
    try {
      const data = await profileAPI.updateCustomerProfile({
        height: 180,
        weight: 75,
        goal: "muscle-gain",
        weight_goal: 80
      });
      addResult('✅ UPDATE PROFILE', 'SUCCESS', data);
    } catch (err) {
      addResult('❌ UPDATE PROFILE', 'FAILED', err.message);
    }
    setLoading(false);
  };

  // ==================== GYM TESTS ====================

  const testListGyms = async () => {
    setLoading(true);
    try {
      const data = await gymsAPI.listGyms();
      addResult('✅ LIST GYMS', 'SUCCESS', data);
    } catch (err) {
      addResult('❌ LIST GYMS', 'FAILED', err.message);
    }
    setLoading(false);
  };

  // ==================== BOOKING TESTS ====================

  const testGetBookings = async () => {
    setLoading(true);
    try {
      const data = await bookingsAPI.getMyBookings();
      addResult('✅ GET MY BOOKINGS', 'SUCCESS', data);
    } catch (err) {
      addResult('❌ GET MY BOOKINGS', 'FAILED', err.message);
    }
    setLoading(false);
  };

  const clearResults = () => setResults([]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 Gym API Test Suite</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Authentication</h3>
        <button onClick={testSignup} disabled={loading}>Test Signup</button>
        <button onClick={testLogin} disabled={loading}>Test Login</button>
        <button onClick={testWrongPassword} disabled={loading}>Test Wrong Password</button>
        <button onClick={testLogout} disabled={loading}>Test Logout</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Profile</h3>
        <button onClick={testGetProfile} disabled={loading}>Get Profile</button>
        <button onClick={testUpdateProfile} disabled={loading}>Update Profile</button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Gyms & Bookings</h3>
        <button onClick={testListGyms} disabled={loading}>List Gyms</button>
        <button onClick={testGetBookings} disabled={loading}>Get My Bookings</button>
      </div>

      <button onClick={clearResults} style={{ background: 'red', color: 'white' }}>
        Clear Results
      </button>

      <div style={{ marginTop: '20px' }}>
        <h3>Results:</h3>
        {results.map((r, i) => (
          <div key={i} style={{ 
            border: '1px solid #ccc', 
            margin: '10px 0', 
            padding: '10px',
            background: r.status === 'SUCCESS' ? '#d4edda' : '#f8d7da'
          }}>
            <strong>{r.test}</strong> - {r.status} <small>({r.time})</small>
            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(r.data, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApiTest;