// src/pages/user/Memberships.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import PropTypes from "prop-types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const apiRequest = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...getAuthHeaders(),
        ...options.headers,
      },
    });

    if (response.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('Session expired. Please login again.');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail?.message || 
                          errorData.detail?.error || 
                          errorData.detail || 
                          `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    return response.status === 204 ? null : await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

const membershipAPI = {
  getPlans: () => apiRequest('/memberships/plans'),
  getCoachPackages: () => apiRequest('/memberships/coach-packages'),
  requestMembership: (id, isCoachPackage = false) =>
    apiRequest('/memberships/request', {
      method: 'POST',
      body: JSON.stringify(isCoachPackage ? { coach_package_id: id } : { plan_id: id }),
    }),
  getMyRequests: () => apiRequest('/memberships/my-requests'),
  getMySubscriptions: () => apiRequest('/memberships/my-subscriptions'),
};

export default function Memberships({ userRole = "user" }) {
  const [activeTab, setActiveTab] = useState("gym");
  const [selectedPackage, setSelectedPackage] = useState(null);
  const selectedPackageRef = useRef(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editingMembership, setEditingMembership] = useState(null);
  
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [coachPackages, setCoachPackages] = useState([]);
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingRequest, setProcessingRequest] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const isOwner = userRole === "owner";

  // Derived data — must be before any conditional returns
  const activeSubs = useMemo(() => mySubscriptions.filter(s => s.status === 'active'), [mySubscriptions]);
  const activeSub = activeSubs[0] || null; // primary active sub (for blocking logic)
  // Separate active gym and coach subs for independent blocking
  const activeGymSub = useMemo(() =>
    activeSubs.find(s => s.plan_id != null && s.coach_package_id == null) || null,
  [activeSubs]);
  const activeCoachSub = useMemo(() =>
    activeSubs.find(s => s.coach_package_id != null) || null,
  [activeSubs]);
  const pendingRequests = useMemo(() => myRequests.filter(r => r.status === 'pending'), [myRequests]);
  // Separate pending requests by type
  const pendingGymRequest = useMemo(() =>
    myRequests.find(r => r.status === 'pending' && r.plan_id != null && r.coach_package_id == null) || null,
  [myRequests]);
  const pendingCoachRequest = useMemo(() =>
    myRequests.find(r => r.status === 'pending' && r.coach_package_id != null) || null,
  [myRequests]);
  const historyRequests = useMemo(() => myRequests.filter(r => r.status !== 'pending'), [myRequests]);

  // Keep ref synchronized with state to avoid stale closures
  useEffect(() => {
    selectedPackageRef.current = selectedPackage;
  }, [selectedPackage]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [plans, packages, subscriptions, requests] = await Promise.all([
        membershipAPI.getPlans(),
        membershipAPI.getCoachPackages(),
        membershipAPI.getMySubscriptions().catch(() => []),
        membershipAPI.getMyRequests().catch(() => []),
      ]);

      setMembershipPlans(plans);
      setCoachPackages(packages);
      setMySubscriptions(subscriptions);
      setMyRequests(requests);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPackage = useCallback((pkg) => {
    if (isOwner && activeTab === "gym") {
      setEditingMembership(pkg);
    } else if (!isOwner) {
      setSelectedPackage(pkg);
      setShowPaymentModal(true);
    }
  }, [isOwner, activeTab]);

  const handleRequest = useCallback(async () => {
    const currentPackage = selectedPackageRef.current;
    const planId = currentPackage?.id;
    if (!planId) return;

    try {
      setProcessingRequest(true);
      const isCoachPackage = !!currentPackage.package_name || !!currentPackage.coach_id;
      await membershipAPI.requestMembership(planId, isCoachPackage);

      const planName = currentPackage.name || currentPackage.package_name;
      setShowPaymentModal(false);
      setSelectedPackage(null);

      // Refresh both requests and subscriptions
      const [requests, subscriptions] = await Promise.all([
        membershipAPI.getMyRequests().catch(() => []),
        membershipAPI.getMySubscriptions().catch(() => []),
      ]);
      setMyRequests(requests);
      setMySubscriptions(subscriptions);

      setSuccessMsg(planName);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err) {
      alert(`Request failed: ${err.message}`);
    } finally {
      setProcessingRequest(false);
    }
  }, []);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    alert(`Updated ${editingMembership.name} successfully! (Demo only)`);
    setEditingMembership(null);
  };

  // Determine item type by its own fields, NOT by ID lookup.
  // Coach packages always have `package_name`; gym plans never do.
  // This avoids false matches when a gym plan and a coach package share the same numeric ID.
  const itemIsCoachPackage = (item) => !!item.package_name || item.coach_id != null;

  // Match subscriptions for this plan/package card.
  const matchSubs = (item) => {
    const isCoach = itemIsCoachPackage(item);
    const name = item.package_name || item.name;
    return mySubscriptions.filter(sub => {
      if (!isCoach) {
        // Gym plan: match by plan_id, or by name when plan_id is set (gym sub)
        return sub.plan_id === item.id ||
          (name && sub.plan_name === name && sub.plan_id !== null);
      } else {
        // Coach package: match by coach_package_id (if set), or by name when plan_id is null
        return (sub.coach_package_id != null && sub.coach_package_id === item.id) ||
          (name && sub.plan_name === name && sub.plan_id === null);
      }
    });
  };

  const isSubscribed = (item) =>
    matchSubs(item).some(sub => sub.status === 'active');

  const hasPendingRequest = (item) => {
    const isCoach = itemIsCoachPackage(item);
    return myRequests.some(r =>
      r.status === 'pending' &&
      (isCoach ? r.coach_package_id === item.id : r.plan_id === item.id)
    );
  };

  const hasRejectedRequest = (item) => {
    const isCoach = itemIsCoachPackage(item);
    return myRequests.some(r =>
      r.status === 'rejected' &&
      (isCoach ? r.coach_package_id === item.id : r.plan_id === item.id)
    );
  };

  const renderActionButton = (item) => {
    if (isOwner) {
      if (activeTab === "gym") {
        return (
          <button
            onClick={() => handleSelectPackage(item)}
            className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg bg-${item.color}-600 text-white hover:bg-${item.color}-700`}
          >
            Edit Plan
          </button>
        );
      }
      return (
        <button disabled className="w-full py-3 rounded-xl font-semibold bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed">
          View Only
        </button>
      );
    }

    // This exact plan is already active
    if (isSubscribed(item)) {
      return (
        <button disabled className="w-full py-3 rounded-xl font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-not-allowed">
          ✓ Active Plan
        </button>
      );
    }

    // User has a pending request for this exact plan
    if (hasPendingRequest(item)) {
      return (
        <button disabled className="w-full py-3 rounded-xl font-semibold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 cursor-not-allowed text-sm">
          ⏳ Awaiting Admin Approval
        </button>
      );
    }

    // Block based on type — gym and coach are independent
    const isCoachItem = itemIsCoachPackage(item);
    if (isCoachItem) {
      // Block if user already has an active coach package
      if (activeCoachSub) {
        return (
          <button disabled className="w-full py-3 rounded-xl font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm">
            Cancel "{activeCoachSub.plan_name}" first
          </button>
        );
      }
      // Block if user has a pending coach package request
      if (pendingCoachRequest) {
        return (
          <button disabled className="w-full py-3 rounded-xl font-semibold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 cursor-not-allowed text-sm">
            ⏳ Pending coach request
          </button>
        );
      }
    } else {
      // Block if user already has an active gym plan
      if (activeGymSub) {
        return (
          <button disabled className="w-full py-3 rounded-xl font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed text-sm">
            Cancel "{activeGymSub.plan_name}" first
          </button>
        );
      }
      // Block if user has a pending gym plan request
      if (pendingGymRequest) {
        return (
          <button disabled className="w-full py-3 rounded-xl font-semibold bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800 cursor-not-allowed text-sm">
            ⏳ Pending gym membership request
          </button>
        );
      }
    }

    if (hasRejectedRequest(item)) {
      return (
        <button
          onClick={() => handleSelectPackage(item)}
          className="w-full py-3 rounded-xl font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 transition text-sm"
        >
          Request Again
        </button>
      );
    }

    return (
      <button
        onClick={() => handleSelectPackage(item)}
        className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg ${
          item.popular
            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
            : `bg-${item.color}-600 text-white hover:bg-${item.color}-700`
        }`}
      >
        Request Membership
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400 mb-4">Failed to load memberships: {error}</p>
        <button 
          onClick={fetchData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success Banner */}
      {successMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">✅</span>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Request for <strong>{successMsg}</strong> submitted — awaiting admin approval.
            </p>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200 text-lg font-bold ml-3">×</button>
        </div>
      )}

      {/* Active Subscriptions — one card per active sub */}
      {!isOwner && activeSubs.length > 0 && (
        <div className="space-y-3">
          {activeSubs.length > 1 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-lg">⚠️</span>
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                You have {activeSubs.length} active subscriptions (1 gym + 1 coach package allowed at the same time).
              </p>
            </div>
          )}
          {activeSubs.map(sub => (
            <div key={sub.id} className="relative overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-5 text-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
              <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl shadow">
                    {sub.coach_package_id ? '👨‍🏫' : '🏋️'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-100 uppercase tracking-wider mb-0.5">
                      Active {sub.coach_package_id ? 'Coach Plan' : 'Gym Plan'}
                    </p>
                    <p className="text-xl font-bold">{sub.plan_name}</p>
                    <p className="text-sm text-emerald-100">
                      Valid until {new Date(sub.end_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {sub.sessions_remaining > 0 && <span className="ml-2">· {sub.sessions_remaining} sessions left</span>}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                  {sub.price > 0 ? `${sub.price} EGP` : 'Active'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Requests — compact horizontal chips */}
      {!isOwner && pendingRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 shrink-0">
            ⏳ Pending
          </span>
          {pendingRequests.map(r => (
            <span key={r.id} className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-full text-xs font-medium">
              {r.plan_name} · {r.requested_price} EGP
            </span>
          ))}
          <span className="text-xs text-amber-600 dark:text-amber-400 ml-auto">Awaiting admin approval</span>
        </div>
      )}

      {/* Request History — collapsed by default */}
      {!isOwner && historyRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
          >
            <span className="flex items-center gap-2">
              <span>📋</span>
              Request History
              <span className="text-xs font-normal text-gray-400 dark:text-gray-500">({historyRequests.length})</span>
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showHistory ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showHistory && (
            <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {historyRequests.map(r => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.plan_name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {r.requested_price} EGP
                      {r.discount > 0 && <span className="text-green-600 dark:text-green-400"> → {r.final_price} EGP</span>}
                      {' · '}{new Date(r.created_at).toLocaleDateString()}
                    </p>
                    {r.notes && <p className="text-xs text-gray-400 italic mt-0.5 truncate">"{r.notes}"</p>}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    r.status === 'approved'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  }`}>
                    {r.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Owner Badge */}
      {isOwner && (
        <div className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div>
            <p className="font-bold text-amber-800 dark:text-amber-300">Owner Mode</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You can edit gym subscriptions. Coach packages are view-only.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      {!isOwner && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Memberships & Packages</h2>
            <p className="text-gray-600 dark:text-gray-400">Choose the perfect plan for your fitness journey</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("gym")}
            className={`flex-1 px-6 py-4 font-medium transition-all relative ${
              activeTab === "gym"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span>🏋️</span>
              <span>Gym Memberships</span>
              {isOwner && <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Editable</span>}
            </span>
            {activeTab === "gym" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab("coach")}
            className={`flex-1 px-6 py-4 font-medium transition-all relative ${
              activeTab === "coach"
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span>👨‍🏫</span>
              <span>Coach Packages</span>
              {isOwner && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">View Only</span>}
            </span>
            {activeTab === "coach" && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>
            )}
          </button>
        </div>

        <div className="p-4 md:p-6">
          {/* Gym Memberships */}
          {activeTab === "gym" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {membershipPlans.map(membership => (
                <div
                  key={membership.id}
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 ${
                    membership.popular
                      ? "border-purple-500 dark:border-purple-400"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {isSubscribed(membership) && (
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                        ✓ Active Plan
                      </span>
                    </div>
                  )}
                  {membership.popular && (
                    <div className={`absolute top-4 z-10 ${isSubscribed(membership) ? 'right-4' : 'right-4'}`}>
                      <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                        ⭐ MOST POPULAR
                      </span>
                    </div>
                  )}

                  <div className={`p-6 bg-gradient-to-br from-${membership.color}-500 to-${membership.color}-600 text-white relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                      <span className="text-4xl mb-3 block">{membership.icon}</span>
                      <h3 className="text-2xl font-bold mb-2">{membership.name}</h3>
                      <p className="text-sm opacity-90">{membership.period}</p>
                    </div>
                  </div>

                  <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    {membership.price_per_session ? (
                      <div>
                        <div className="text-4xl font-black text-gray-900 dark:text-white mb-1">
                          {membership.price_per_session} EGP
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">per session</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-4xl font-black text-gray-900 dark:text-white">
                            {membership.price}
                          </span>
                          <span className="text-lg text-gray-500 dark:text-gray-400">EGP</span>
                        </div>
                        {membership.original_price && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg text-gray-400 line-through">
                              {membership.original_price} EGP
                            </span>
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                              Save {membership.savings} EGP
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {membership.sessions} sessions
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 flex-1">
                    <ul className="space-y-3">
                      {membership.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-6 pt-0">
                    {renderActionButton(membership)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Coach Packages */}
          {activeTab === "coach" && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-900 dark:text-blue-300">
                    {isOwner
                      ? "👑 Owner View: You can view coach packages but cannot edit them. Contact coaches directly to negotiate packages."
                      : "Choose a coaching package. Your subscription will be reviewed and confirmed by the admin."
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {coachPackages.map(pkg => (
                  <div
                    key={pkg.id}
                    className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] ${
                      pkg.popular
                        ? "border-purple-500 dark:border-purple-400"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {isSubscribed(pkg) && (
                      <div className="absolute top-4 left-4 z-10">
                        <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-1">
                          ✓ Active Plan
                        </span>
                      </div>
                    )}
                    {pkg.popular && (
                      <div className="absolute top-4 right-4 z-10">
                        <span className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                          ⭐ BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className={`p-6 bg-gradient-to-br from-${pkg.color}-500 to-${pkg.color}-600 text-white`}>
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg overflow-hidden shrink-0">
                          {pkg.coach_avatar && (pkg.coach_avatar.startsWith('http') || pkg.coach_avatar.startsWith('/')) ? (
                            <img src={pkg.coach_avatar.startsWith('/') ? `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1','')}${pkg.coach_avatar}` : pkg.coach_avatar} alt={pkg.coach_name} className="w-full h-full object-cover" />
                          ) : (
                            pkg.coach_avatar
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{pkg.coach_name}</h4>
                          <p className="text-sm opacity-90">{pkg.coach_specialty}</p>
                          <div className="flex items-center gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                              <svg key={i} className={`w-3 h-3 ${i < Math.floor(pkg.coach_rating) ? "text-yellow-400" : "text-white/30"}`} fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                            <span className="text-xs ml-1">({pkg.coach_rating})</span>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-bold">{pkg.package_name}</h3>
                      <p className="text-sm opacity-90 mt-1">{pkg.period} • {pkg.sessions} sessions</p>
                    </div>

                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-black text-gray-900 dark:text-white">
                          {pkg.price}
                        </span>
                        <span className="text-lg text-gray-500 dark:text-gray-400">EGP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {pkg.price_per_session} EGP per session
                        </span>
                        {pkg.original_price && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
                            Save {pkg.savings} EGP
                          </span>
                        )}
                      </div>
                      {pkg.original_price && (
                        <p className="text-sm text-gray-400 line-through mt-1">
                          Regular: {pkg.original_price} EGP
                        </p>
                      )}
                    </div>

                    <div className="p-6">
                      <ul className="space-y-3">
                        {pkg.features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-6 pt-0">
                      {renderActionButton(pkg)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Confirmation Modal */}
      {showPaymentModal && selectedPackage && !isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Confirm Membership Request</h3>
                <button
                  onClick={() => { setShowPaymentModal(false); setSelectedPackage(null); }}
                  className="p-2 hover:bg-white/20 rounded-full transition text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Plan Details</p>
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-bold text-gray-900 dark:text-white">
                      {selectedPackage.name || selectedPackage.package_name}
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {selectedPackage.period}
                      {selectedPackage.sessions && ` • ${selectedPackage.sessions} sessions`}
                    </p>
                    {selectedPackage.coach_name && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">with {selectedPackage.coach_name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900 dark:text-white">
                      {selectedPackage.price ?? selectedPackage.price_per_session} EGP
                    </p>
                    {selectedPackage.original_price && (
                      <p className="text-sm text-gray-400 line-through">{selectedPackage.original_price} EGP</p>
                    )}
                  </div>
                </div>
                {selectedPackage.savings && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2 font-medium">
                    You save {selectedPackage.savings} EGP with this plan
                  </p>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-blue-500 text-lg mt-0.5">ℹ️</span>
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Your request will be sent to the admin for review. You'll be notified once it's approved or rejected.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowPaymentModal(false); setSelectedPackage(null); }}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequest}
                  disabled={processingRequest}
                  className={`flex-1 py-3 rounded-xl font-semibold transition shadow-lg ${
                    processingRequest
                      ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                  }`}
                >
                  {processingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingMembership && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-500 to-orange-600">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">Edit Membership Plan</h3>
                <button
                  onClick={() => setEditingMembership(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Name
                </label>
                <input
                  type="text"
                  defaultValue={editingMembership.name}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Price (EGP)
                  </label>
                  <input
                    type="number"
                    defaultValue={editingMembership.price || editingMembership.price_per_session}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Period
                  </label>
                  <input
                    type="text"
                    defaultValue={editingMembership.period}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Features (one per line)
                </label>
                <textarea
                  rows={4}
                  defaultValue={Array.isArray(editingMembership.features) ? editingMembership.features.join('\n') : editingMembership.features}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="popular"
                  defaultChecked={editingMembership.popular}
                  className="w-5 h-5 text-amber-600 rounded"
                />
                <label htmlFor="popular" className="text-gray-700 dark:text-gray-300">
                  Mark as Popular Plan
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingMembership(null)}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-orange-700 transition shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

Memberships.propTypes = {
  userRole: PropTypes.oneOf(["user", "owner", "admin", "coach"])
};

Memberships.defaultProps = {
  userRole: "user"
};