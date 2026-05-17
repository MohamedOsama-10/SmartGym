// src/components/StatDetailViews.jsx
import { useState, useEffect } from 'react';

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

// TotalMembersView
export function TotalMembersView({ gymId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gymId) return;
    apiGet(`/gyms/${gymId}/customers`)
      .then(data => { setMembers(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [gymId]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white transition-colors">All Members</h3>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">Total number of members subscribed to this branch</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Member
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">Loading members...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-red-500">Failed to load members: {error}</div>
      ) : members.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">No members registered at this branch.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 transition-colors">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Member</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Join Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Expiry Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Coach</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300 transition-colors">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white transition-colors">{member.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 transition-colors">{member.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 transition-colors">{member.joinDate || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 transition-colors">{member.subscriptionEnd || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 transition-colors">{member.coach}</td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      member.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    } transition-colors`}>
                      {member.status === "active" ? "Active" : "Expired"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors">View</button>
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

// Active Members View
export function ActiveMembersView({ gymId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gymId) return;
    apiGet(`/gyms/${gymId}/customers`)
      .then(data => { setMembers(data.filter(m => m.status === 'active')); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [gymId]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white transition-colors">Active Members</h3>
        <p className="text-gray-500 dark:text-gray-400 transition-colors">Members with valid subscriptions</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">Loading members...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-red-500">Failed to load members: {error}</div>
      ) : members.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">No active members at this branch.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((member) => (
            <div key={member.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center gap-4 transition-colors">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-xl font-bold">
                {member.name.charAt(0)}
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 dark:text-white transition-colors">{member.name}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors">{member.phone || member.email}</p>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-green-600 dark:text-green-400 font-medium">Active Subscription</span>
                  {member.subscriptionEnd && (
                    <span className="text-gray-500 dark:text-gray-400">Expires: {member.subscriptionEnd}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Coach</p>
                <p className="font-medium text-gray-900 dark:text-white transition-colors">{member.coach}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Coaches View
export function CoachesView({ gymId }) {
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!gymId) return;
    apiGet(`/gyms/${gymId}/coaches`)
      .then(data => { setCoaches(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [gymId]);

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white transition-colors">Training Team</h3>
          <p className="text-gray-500 dark:text-gray-400 transition-colors">Coaches information and performance</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Coach
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">Loading coaches...</div>
      ) : error ? (
        <div className="flex items-center justify-center py-12 text-red-500">Failed to load coaches: {error}</div>
      ) : coaches.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">No coaches assigned to this branch.</div>
      ) : (
        <div className="space-y-4">
          {coaches.map((coach) => (
            <div key={coach.id} className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-6 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Coach Basic Info */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xl font-bold">
                    {coach.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 dark:text-white transition-colors">{coach.name}</h4>
                    <p className="text-purple-600 dark:text-purple-400 font-medium">{coach.specialty}</p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>{coach.experience_years} yrs experience</span>
                      {coach.hourly_rate > 0 && (
                        <>
                          <span>•</span>
                          <span>{coach.hourly_rate} EGP/hr</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{coach.current_clients ?? coach.total_clients ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Clients</p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{coach.rating ?? '—'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Rating</p>
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{coach.total_reviews ?? 0}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Reviews</p>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    coach.is_available
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  } transition-colors`}>
                    {coach.is_available ? "Available" : "Unavailable"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Revenue View
export function RevenueView({ gymId, revenue }) {
  const monthlyData = [
    { month: "January", amount: 45000, target: 40000 },
    { month: "February", amount: 52000, target: 45000 },
    { month: "March", amount: 48000, target: 50000 },
    { month: "April", amount: 61000, target: 55000 },
    { month: "May", amount: 58000, target: 60000 },
    { month: "June", amount: revenue, target: 65000 },
  ];

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white transition-colors">Revenue Details</h3>
        <p className="text-gray-500 dark:text-gray-400 transition-colors">Monthly revenue and financial performance</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
          <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">Total Monthly Revenue</p>
          <p className="text-3xl font-bold text-green-700 dark:text-green-300">{revenue.toLocaleString()} EGP</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Average Daily Revenue</p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{Math.round(revenue / 30).toLocaleString()} EGP</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
          <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-1">Monthly Target</p>
          <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">65,000 EGP</p>
        </div>
      </div>

      {/* Monthly Revenue Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 transition-colors">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Month</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Actual Revenue</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Target</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Achievement %</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 transition-colors">
            {monthlyData.map((data, index) => {
              const percentage = Math.round((data.amount / data.target) * 100);
              return (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{data.month}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white font-bold">{data.amount.toLocaleString()} EGP</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{data.target.toLocaleString()} EGP</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${percentage >= 100 ? 'bg-green-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{percentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      percentage >= 100 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      percentage >= 80 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    } transition-colors`}>
                      {percentage >= 100 ? 'Achieved' : percentage >= 80 ? 'Good' : 'Weak'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
