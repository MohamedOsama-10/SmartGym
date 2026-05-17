// src/pages/coach/Bookings.jsx
import { useState, useEffect, useCallback } from "react";
import { bookingsAPI } from "../../services/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];

/** Format "HH:MM:SS.fffffff" or "HH:MM:SS" into "hh:mm AM/PM" */
const formatSessionTime = (rawTime) => {
  if (!rawTime) return "";
  const parts = rawTime.split(":");
  if (parts.length < 2) return rawTime;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

/** Normalise a backend booking object into the shape the UI expects */
const normalizeBooking = (b) => {
  // session_date is a plain date string "YYYY-MM-DD"
  // session_time is a separate time string "HH:MM:SS.fffffff"
  const date = b.session_date
    ? b.session_date.split("T")[0]
    : (b.date || "");
  const time = formatSessionTime(b.session_time || b.time || "");

  return {
    id: b.id,
    clientId: b.customer_id,
    clientName: b.customer_name || b.customer?.full_name || `Customer ${b.customer_id}`,
    clientAvatar: (b.customer_name || `C${b.customer_id}`)
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
    clientPhoto: b.customer?.avatar_url || null,
    date,
    time,
    duration: b.duration_minutes || b.duration || b.slot_duration_minutes || 60,
    status: b.status?.toLowerCase() || "pending",
    type: b.session_type || b.type || "Personal Training",
    notes: b.customer_notes || b.notes || "",
    coachNotes: b.coach_notes || "",
    clientPhone: b.customer?.phone || b.customer_phone || "",
    clientGoal: b.customer?.goal || b.customer_goal || "Fitness",
  };
};

// ─── component ───────────────────────────────────────────────────────────────

export default function CoachBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("today");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // bookingId being actioned

  // ── fetch on mount ──────────────────────────────────────────────────────────
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await bookingsAPI.getCoachBookings({ limit: 100 });
      const raw = Array.isArray(data) ? data : (data.bookings || data.items || []);
      setBookings(raw.map(normalizeBooking));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // ── derived lists ───────────────────────────────────────────────────────────
  const todayBookings = bookings.filter(
    (b) => b.date === TODAY && (b.status === "confirmed" || b.status === "pending" || b.status === "upcoming")
  );
  const upcomingBookings = bookings.filter(
    (b) => b.date > TODAY && (b.status === "confirmed" || b.status === "pending" || b.status === "upcoming")
  );
  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const completedBookings = bookings.filter(
    (b) => b.status === "completed" || b.status === "attended"
  );

  const getDisplayBookings = () => {
    switch (activeTab) {
      case "today":    return todayBookings;
      case "upcoming": return upcomingBookings;
      case "pending":  return pendingBookings;
      case "history":  return completedBookings;
      default:         return [];
    }
  };

  // ── actions ─────────────────────────────────────────────────────────────────
  const updateBookingState = (id, patch) =>
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const handleConfirmBooking = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await bookingsAPI.confirmBooking(bookingId);
      updateBookingState(bookingId, { status: "confirmed" });
    } catch (e) {
      alert("Failed to confirm booking: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBooking = async (bookingId) => {
    if (!window.confirm("Are you sure you want to reject this booking?")) return;
    setActionLoading(bookingId);
    try {
      await bookingsAPI.cancelBooking(bookingId);
      updateBookingState(bookingId, { status: "cancelled" });
    } catch (e) {
      alert("Failed to reject booking: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteSession = async (bookingId) => {
    setActionLoading(bookingId);
    try {
      await bookingsAPI.completeBooking(bookingId);
      updateBookingState(bookingId, { status: "attended" });
    } catch (e) {
      alert("Failed to complete session: " + e.message);
    } finally {
      setActionLoading(null);
    }
  };

  // ── utils ───────────────────────────────────────────────────────────────────
  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
      case "upcoming":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "completed":
      case "attended":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "cancelled":
      case "missed":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const displayStatus = (status) =>
    status === "attended" ? "Completed" : status.charAt(0).toUpperCase() + status.slice(1);

  const viewBookingDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  // ── loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading bookings…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 font-semibold mb-2">Failed to load bookings</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button
            onClick={fetchBookings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">My Bookings</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your client sessions</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {[
          { count: todayBookings.length,     label: "Today's Sessions",  from: "blue-500",   to: "blue-600",   icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          { count: upcomingBookings.length,  label: "Upcoming",          from: "green-500",  to: "green-600",  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
          { count: pendingBookings.length,   label: "Pending Approval",  from: "yellow-500", to: "yellow-600", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { count: completedBookings.length, label: "Completed",         from: "purple-500", to: "purple-600", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
        ].map(({ count, label, from, to, icon }) => (
          <div key={label} className={`bg-gradient-to-br from-${from} to-${to} rounded-2xl p-4 md:p-6 text-white shadow-lg`}>
            <div className="flex items-center justify-between mb-2">
              <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
            </div>
            <p className="text-2xl md:text-3xl font-bold mb-1">{count}</p>
            <p className="text-sm opacity-90">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-6 overflow-x-auto">
          {[
            { key: "today",    label: "Today",    count: todayBookings.length    },
            { key: "upcoming", label: "Upcoming", count: upcomingBookings.length },
            { key: "pending",  label: "Pending",  count: pendingBookings.length  },
            { key: "history",  label: "History",  count: completedBookings.length },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 px-1 border-b-2 font-semibold transition whitespace-nowrap ${
                activeTab === key
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {getDisplayBookings().length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No bookings found</p>
          </div>
        ) : (
          getDisplayBookings().map((booking) => {
            const isActioning = actionLoading === booking.id;
            return (
              <div key={booking.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg transition">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                      {booking.clientAvatar}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 dark:text-white">{booking.clientName}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{booking.type}</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {displayStatus(booking.status)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => viewBookingDetails(booking)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
                  >
                    View Details →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{booking.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{booking.time} ({booking.duration} min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Goal: {booking.clientGoal}</span>
                  </div>
                </div>

                {booking.notes && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Notes:</span> {booking.notes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {booking.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleConfirmBooking(booking.id)}
                        disabled={isActioning}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium disabled:opacity-50"
                      >
                        {isActioning ? "…" : "✓ Confirm"}
                      </button>
                      <button
                        onClick={() => handleRejectBooking(booking.id)}
                        disabled={isActioning}
                        className="px-4 py-2 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition text-sm font-medium disabled:opacity-50"
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                  {(booking.status === "confirmed" || booking.status === "upcoming") &&
                    booking.date <= TODAY && (
                      <button
                        onClick={() => handleCompleteSession(booking.id)}
                        disabled={isActioning}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium disabled:opacity-50"
                      >
                        {isActioning ? "Saving…" : "Mark as Completed"}
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-purple-600">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">Booking Details</h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition text-white"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Client Info */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Client Information</h4>
                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center text-xl font-bold">
                    {selectedBooking.clientAvatar}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{selectedBooking.clientName}</p>
                    {selectedBooking.clientPhone && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedBooking.clientPhone}</p>
                    )}
                    <p className="text-sm text-gray-600 dark:text-gray-400">Goal: {selectedBooking.clientGoal}</p>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Session Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "Date",     value: selectedBooking.date     },
                    { label: "Time",     value: selectedBooking.time     },
                    { label: "Duration", value: `${selectedBooking.duration} minutes` },
                    { label: "Type",     value: selectedBooking.type     },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Status</h4>
                <span className={`inline-block px-4 py-2 rounded-xl text-sm font-semibold ${getStatusColor(selectedBooking.status)}`}>
                  {displayStatus(selectedBooking.status)}
                </span>
              </div>

              {/* Notes */}
              {selectedBooking.notes && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Client Notes</h4>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p className="text-gray-700 dark:text-gray-300">{selectedBooking.notes}</p>
                  </div>
                </div>
              )}

              {selectedBooking.coachNotes && (
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Coach Notes</h4>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-gray-700 dark:text-gray-300">{selectedBooking.coachNotes}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                {selectedBooking.status === "pending" && (
                  <>
                    <button
                      onClick={() => {
                        handleConfirmBooking(selectedBooking.id);
                        setShowDetailsModal(false);
                      }}
                      className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition"
                    >
                      Confirm Booking
                    </button>
                    <button
                      onClick={() => {
                        handleRejectBooking(selectedBooking.id);
                        setShowDetailsModal(false);
                      }}
                      className="flex-1 px-6 py-3 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                    >
                      Reject Booking
                    </button>
                  </>
                )}
                {(selectedBooking.status === "confirmed" || selectedBooking.status === "upcoming") && (
                  <button
                    onClick={() => {
                      handleCompleteSession(selectedBooking.id);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
                  >
                    Mark as Completed
                  </button>
                )}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}