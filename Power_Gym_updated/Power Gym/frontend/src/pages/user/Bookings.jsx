//D:\gym_system\gym-project\frontend\src\pages\user\Bookings.jsx
import { useState, useMemo, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const TYPE_ICONS = {
  gym: "💪",
  class: "👥",
  pt: "🎯",
  spa: "🧖",
  pool: "🏊",
  yoga: "🧘",
  cardio: "🏃"
};

const TYPE_COLORS = {
  gym: "blue",
  class: "purple",
  pt: "orange",
  spa: "pink",
  pool: "cyan",
  yoga: "purple",
  cardio: "red"
};

const STATUS_STYLES = {
  attended: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  missed: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  cancelled: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  upcoming: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  confirmed: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
};

export default function Bookings() {
  const { apiRequest } = useAuth();
  const navigate = useNavigate();
  
  const [bookings, setBookings] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedSubscription, setSelectedSubscription] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [viewMode, setViewMode] = useState("timeline");
  const [expandedBooking, setExpandedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  
  // Notes editing
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesText, setNotesText] = useState("");
  
  // Review modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [bookingsData, subscriptionsData] = await Promise.all([
        apiRequest('/bookings/my-bookings'),
        apiRequest('/subscriptions/my-subscriptions')
      ]);

      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setSubscriptions(Array.isArray(subscriptionsData) ? subscriptionsData : []);
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
      setError(err.message || "Failed to load booking history");
    } finally {
      setLoading(false);
    }
  };

  const transformedBookings = useMemo(() => {
    if (!Array.isArray(bookings)) return [];
    
    return bookings
      .filter(booking => booking && booking.id)
      .map(booking => ({
        id: booking.id,
        date: booking.session_date,
        time: booking.session_time,
        type: (booking.session_type || 'gym').toLowerCase(),
        title: booking.title || booking.session_type || 'Gym Session',
        trainer: booking.trainer_name || booking.coach?.user?.full_name || null,
        coachId: booking.coach?.id || null,
        duration: booking.duration_minutes || 60,
        status: (booking.status || 'upcoming').toLowerCase(),
        subscriptionId: booking.subscription_id,
        branch: booking.branch || booking.gym?.name || 'Main Branch',
        notes: booking.customer_notes || booking.notes || null,
        availability_slot_id: booking.availability_slot_id
      }))
      .sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
      });
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    let result = [...transformedBookings];
    
    if (selectedSubscription !== "all") {
      result = result.filter(b => String(b.subscriptionId) === String(selectedSubscription));
    }
    
    if (selectedType !== "all") {
      result = result.filter(b => b.type === selectedType);
    }
    
    return result;
  }, [transformedBookings, selectedSubscription, selectedType]);

  const bookingsBySubscription = useMemo(() => {
    const grouped = {};
    
    if (!Array.isArray(subscriptions)) return {};
    
    subscriptions.forEach(sub => {
      if (!sub || !sub.id) return;
      
      const subBookings = filteredBookings.filter(b => 
        String(b.subscriptionId) === String(sub.id)
      );
      
      grouped[sub.id] = {
        subscription: {
          id: sub.id,
          planName: sub.plan_name || sub.name || 'Unknown Plan',
          startDate: sub.start_date || sub.startDate,
          endDate: sub.end_date || sub.endDate,
          billingCycle: sub.billing_cycle || sub.billingCycle || 'monthly',
          price: sub.price || 0,
          status: sub.status || 'unknown',
          totalBookings: sub.total_bookings || subBookings.length || 0,
          attended: sub.attended_count || 0,
          missed: sub.missed_count || 0
        },
        bookings: subBookings
      };
    });
    
    const noSubBookings = filteredBookings.filter(b => !b.subscriptionId);
    if (noSubBookings.length > 0) {
      grouped['no-subscription'] = {
        subscription: {
          id: 'no-subscription',
          planName: 'Individual Bookings',
          startDate: null,
          endDate: null,
          billingCycle: 'N/A',
          price: 0,
          status: 'active',
          totalBookings: noSubBookings.length,
          attended: 0,
          missed: 0
        },
        bookings: noSubBookings
      };
    }
    
    return grouped;
  }, [filteredBookings, subscriptions]);

  const stats = useMemo(() => {
    const total = filteredBookings.length;
    const attended = filteredBookings.filter(b => b.status === "attended").length;
    const missed = filteredBookings.filter(b => b.status === "missed").length;
    const upcoming = filteredBookings.filter(b => ["upcoming", "pending", "confirmed"].includes(b.status)).length;
    const cancelled = filteredBookings.filter(b => b.status === "cancelled").length;
    const attendanceRate = (attended + missed) > 0 ? Math.round((attended / (attended + missed)) * 100) : 0;
    
    return { total, attended, missed, upcoming, cancelled, attendanceRate };
  }, [filteredBookings]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", { 
        weekday: "short", 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    } catch (e) {
      return "Invalid Date";
    }
  }, []);

  const getDaysAgo = useCallback((dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (date > now) return `in ${diffDays} days`;
      if (diffDays === 0) return "today";
      if (diffDays === 1) return "yesterday";
      return `${diffDays} days ago`;
    } catch (e) {
      return "";
    }
  }, []);

  // ✅ FIXED: Save notes using the correct API endpoint
  const handleSaveNotes = async (bookingId) => {
    try {
      await apiRequest(`/bookings/${bookingId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ customer_notes: notesText })
      });
      
      setBookings(prev => prev.map(b => 
        b.id === bookingId ? { ...b, customer_notes: notesText, notes: notesText } : b
      ));
      setEditingNotes(null);
      setNotesText("");
    } catch (err) {
      alert("Failed to save notes: " + err.message);
    }
  };

  // ✅ FIXED: Cancel booking with proper API call
  const handleCancelBooking = useCallback(async (bookingId) => {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    
    setActionLoading(prev => ({ ...prev, [bookingId]: 'cancel' }));
    
    try {
      await apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' });
      await fetchBookings();
      alert("Booking cancelled successfully");
    } catch (err) {
      alert("Failed to cancel booking: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(prev => ({ ...prev, [bookingId]: null }));
    }
  }, [apiRequest]);

  // ✅ FIXED: Reschedule navigates with booking data for coach selection
  const handleReschedule = useCallback((booking) => {
    navigate('/user/coaches', { 
      state: { 
        rescheduleBooking: {
          id: booking.id,
          title: booking.title,
          type: booking.type,
          date: booking.date,
          time: booking.time,
          coachId: booking.coachId,
          availability_slot_id: booking.availability_slot_id
        }
      } 
    });
  }, [navigate]);

  const handleBookNewSession = useCallback(() => {
    navigate('/user/coaches');
  }, [navigate]);

  const handleBookMakeup = useCallback(() => {
    navigate('/user/coaches');
  }, [navigate]);

  // ✅ FIXED: Review modal opens with booking data
  const openReviewModal = (booking) => {
    setSelectedBookingForReview(booking);
    setReviewRating(0);
    setReviewComment("");
    setShowReviewModal(true);
  };

  // ✅ FIXED: Submit review to backend
  const submitReview = async () => {
    if (reviewRating === 0) {
      alert("Please select a rating");
      return;
    }

    setReviewSubmitting(true);
    try {
      await apiRequest('/reviews/', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: selectedBookingForReview.id,
          coach_id: selectedBookingForReview.coachId,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      
      setShowReviewModal(false);
      alert("Review submitted successfully!");
    } catch (err) {
      alert("Failed to submit review: " + err.message);
    } finally {
      setReviewSubmitting(false);
    }
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
        <p className="text-red-600 dark:text-red-400 mb-4">Failed to load bookings: {error}</p>
        <button onClick={fetchBookings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Track and manage all your session bookings</p>
        </div>
        <button
          onClick={handleBookNewSession}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Book New Session
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Attended",    value: stats.attended,    color: "green",  icon: "✅" },
          { label: "Upcoming",    value: stats.upcoming,    color: "blue",   icon: "📅" },
          { label: "Missed",      value: stats.missed,      color: "red",    icon: "⚠️" },
          { label: "Cancelled",   value: stats.cancelled,   color: "gray",   icon: "🚫" },
          { label: "Attendance",  value: `${stats.attendanceRate}%`, color: "purple", icon: "🔥" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3`}>
            <span className="text-2xl">{icon}</span>
            <div>
              <p className={`text-xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Subscription</label>
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Subscriptions</option>
              {subscriptions.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.plan_name || sub.name} {sub.start_date ? `(${new Date(sub.start_date).getFullYear()})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Session Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="gym">💪 Gym Session</option>
              <option value="class">👥 Group Class</option>
              <option value="pt">🎯 Personal Training</option>
              <option value="spa">🧖 Spa</option>
              <option value="pool">🏊 Pool</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "timeline" ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "calendar" ? "bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm" : "text-gray-500 dark:text-gray-400"}`}
              >
                Calendar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">📅</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No bookings found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Start your fitness journey by booking your first session</p>
          <button
            onClick={handleBookNewSession}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Find a Coach
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(bookingsBySubscription).map(({ subscription, bookings: subBookings }) => (
            <div key={subscription.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">

              {/* Subscription Header */}
              <div className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${subscription.status === "active" ? "bg-gradient-to-r from-blue-600 to-indigo-600" : "bg-gray-600"}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-lg">
                    {subscription.status === "active" ? "⭐" : "📦"}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">{subscription.planName}</h3>
                    <p className="text-white/70 text-xs">
                      {formatDate(subscription.startDate)} — {formatDate(subscription.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-lg font-black text-white leading-none">{subBookings.length}</p>
                    <p className="text-white/70 text-xs">bookings</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${subscription.status === "active" ? "bg-white text-blue-600" : "bg-white/20 text-white"}`}>
                    {subscription.status === "active" ? "Active" : "Expired"}
                  </span>
                </div>
              </div>

              {/* Booking Cards */}
              {subBookings.length === 0 ? (
                <div className="py-10 text-center text-gray-500 dark:text-gray-400">
                  <p className="text-sm mb-3">No bookings in this subscription period</p>
                  <button onClick={handleBookNewSession} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                    Book a Session
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {subBookings.map((booking) => {
                    const isExpanded = expandedBooking === booking.id;
                    const isEditing = editingNotes === booking.id;
                    const statusStyle = STATUS_STYLES[booking.status] || STATUS_STYLES.upcoming;
                    const isUpcoming = ["upcoming", "pending", "confirmed"].includes(booking.status);

                    return (
                      <div key={booking.id}>
                        {/* Booking Row */}
                        <div
                          className="px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          onClick={() => setExpandedBooking(isExpanded ? null : booking.id)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xl flex-shrink-0">
                              {TYPE_ICONS[booking.type] || '💪'}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{booking.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(booking.date)}</span>
                                {booking.time && (
                                  <>
                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{booking.time}</span>
                                  </>
                                )}
                                {booking.trainer && (
                                  <>
                                    <span className="text-gray-300 dark:text-gray-600">·</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">{booking.trainer}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Right side */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <span className={`hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusStyle}`}>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </span>
                              <span className={`text-xs font-medium ${isUpcoming ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                                {getDaysAgo(booking.date)}
                              </span>
                              <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-5 pb-5 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                            <div className="pt-4 space-y-4">
                              {/* Meta info */}
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-400 mb-0.5">Status</p>
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle}`}>
                                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                  </span>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-400 mb-0.5">Branch</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{booking.branch}</p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                                  <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{booking.duration} min</p>
                                </div>
                              </div>

                              {/* Notes */}
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Notes</p>
                                  {!isEditing && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingNotes(booking.id);
                                        setNotesText(booking.notes || "");
                                      }}
                                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                    >
                                      {booking.notes ? 'Edit' : '+ Add Notes'}
                                    </button>
                                  )}
                                </div>
                                {isEditing ? (
                                  <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                    <textarea
                                      value={notesText}
                                      onChange={(e) => setNotesText(e.target.value)}
                                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                                      rows={3}
                                      placeholder="Add notes about this session..."
                                    />
                                    <div className="flex gap-2">
                                      <button onClick={() => handleSaveNotes(booking.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                                        Save
                                      </button>
                                      <button onClick={() => { setEditingNotes(null); setNotesText(""); }} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium">
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 min-h-[48px]">
                                    {booking.notes || <span className="italic text-gray-400">No notes yet.</span>}
                                  </p>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 flex-wrap">
                                {isUpcoming && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleCancelBooking(booking.id); }}
                                      disabled={actionLoading[booking.id] === 'cancel'}
                                      className="flex-1 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-sm font-medium hover:bg-red-100 transition disabled:opacity-50"
                                    >
                                      {actionLoading[booking.id] === 'cancel' ? 'Cancelling...' : 'Cancel'}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReschedule(booking); }}
                                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                                    >
                                      Reschedule
                                    </button>
                                  </>
                                )}
                                {booking.status === "attended" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openReviewModal(booking); }}
                                    className="flex-1 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg text-sm font-medium hover:bg-green-100 transition"
                                  >
                                    📝 Leave Review
                                  </button>
                                )}
                                {booking.status === "missed" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBookMakeup(); }}
                                    className="flex-1 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg text-sm font-medium hover:bg-amber-100 transition"
                                  >
                                    📅 Book Makeup
                                  </button>
                                )}
                                {booking.status === "cancelled" && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleBookNewSession(); }}
                                    className="flex-1 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg text-sm font-medium hover:bg-purple-100 transition"
                                  >
                                    🔄 Book Again
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedBookingForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Rate Your Session</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">with {selectedBookingForReview.trainer || 'your trainer'}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setReviewRating(star)} className="w-10 h-10 transition-transform hover:scale-110">
                    <svg className={`w-full h-full ${star <= reviewRating ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`} viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your experience (optional)..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                rows={4}
              />
              <div className="flex gap-3">
                <button onClick={() => setShowReviewModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  Cancel
                </button>
                <button
                  onClick={submitReview}
                  disabled={reviewSubmitting || reviewRating === 0}
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}