// src/pages/Notifications.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";

const NOTIFICATION_TYPES = {
  message: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    color: "blue",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    textColor: "text-blue-600 dark:text-blue-400",
    label: "Messages"
  },
  system: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: "gray",
    bgColor: "bg-gray-100 dark:bg-gray-700",
    textColor: "text-gray-600 dark:text-gray-400",
    label: "System"
  },
  edit: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: "yellow",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    textColor: "text-yellow-600 dark:text-yellow-400",
    label: "Edits"
  },
  success: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: "green",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-600 dark:text-green-400",
    label: "Success"
  },
  alert: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    color: "red",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    textColor: "text-red-600 dark:text-red-400",
    label: "Alerts"
  },
  subscription: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
    color: "purple",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    textColor: "text-purple-600 dark:text-purple-400",
    label: "Subscriptions"
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll,
    isSoundEnabled,
    setIsSoundEnabled
  } = useNotifications();
  
  const [filter, setFilter] = useState("all");
  const [selectedNotifications, setSelectedNotifications] = useState([]);

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const toggleSelection = (id) => {
    setSelectedNotifications(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkRead = () => {
    selectedNotifications.forEach(id => markAsRead(id));
    setSelectedNotifications([]);
  };

  const handleBulkDelete = () => {
    selectedNotifications.forEach(id => deleteNotification(id));
    setSelectedNotifications([]);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} minutes ago`;
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    return date.toLocaleDateString();
  };

  const getNotificationStyle = (type) => {
    return NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.system;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Notifications</h1>
          <p className="text-gray-600 dark:text-gray-400">
            You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsSoundEnabled(!isSoundEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              isSoundEnabled ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-600"
            }`}
            title={isSoundEnabled ? "Sound on" : "Sound off"}
          >
            {isSoundEnabled ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-200 transition"
            >
              Mark all as read
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg font-medium hover:bg-red-200 transition"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All", count: notifications.length },
          { id: "unread", label: "Unread", count: unreadCount },
          ...Object.entries(NOTIFICATION_TYPES).map(([key, value]) => ({
            id: key,
            label: value.label,
            count: notifications.filter(n => n.type === key && !n.read).length
          }))
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filter === tab.id
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                filter === tab.id ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="flex gap-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl animate-fadeIn">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {selectedNotifications.length} selected
          </span>
          <button
            onClick={handleBulkRead}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Mark as read
          </button>
          <button
            onClick={handleBulkDelete}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Delete
          </button>
          <button
            onClick={() => setSelectedNotifications([])}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline ml-auto"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No notifications</h3>
            <p className="text-gray-500 dark:text-gray-400">You're all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => {
            const style = getNotificationStyle(notification.type);
            const isSelected = selectedNotifications.includes(notification.id);
            
            return (
              <div
                key={notification.id}
                className={`group bg-white dark:bg-gray-800 rounded-xl border transition-all ${
                  !notification.read
                    ? "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10"
                    : "border-gray-200 dark:border-gray-700"
                } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
              >
                <div className="p-4 flex items-start gap-4">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(notification.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${style.bgColor} ${style.textColor} flex items-center justify-center`}>
                    {style.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className={`font-semibold text-gray-900 dark:text-white ${!notification.read ? "font-bold" : ""}`}>
                          {notification.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                          {notification.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-sm text-gray-400">
                            {formatTime(notification.timestamp)}
                          </span>
                          {notification.link && (
                            <button
                              onClick={() => navigate(notification.link)}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {notification.actionText || "View"} →
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-col items-end gap-2">
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Mark as read"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}