import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
const POLL_INTERVAL = 30000; // 30 seconds

// ── localStorage helpers (user-scoped to prevent cross-user leakage) ──────

const storageKey = (userId) => `gym_notifications_${userId || "guest"}`;

const loadLocal = (userId) => {
  try {
    const s = localStorage.getItem(storageKey(userId));
    if (s) return JSON.parse(s);
  } catch (_) {}
  return [];
};

const saveLocal = (list, userId) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch (_) {}
};

// ── Relative time ─────────────────────────────────────────────────────────

const formatRelativeTime = (ts) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
};

const apiToLocal = (n) => ({
  id: `api_${n.id}`,          // prefixed to avoid collision with timestamp ids
  _apiId: n.id,
  _source: "api",
  type: n.type || "system",
  title: n.title,
  message: n.message,
  link: n.link || null,
  read: n.is_read,
  timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(),
  time: n.created_at ? formatRelativeTime(new Date(n.created_at).getTime()) : "Just now",
});

// ── Provider ──────────────────────────────────────────────────────────────

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [localNotifs, setLocalNotifs] = useState(() => loadLocal(userId));
  const [apiNotifs, setApiNotifs] = useState([]);
  const [isSoundEnabled, setIsSoundEnabled] = useState(false);
  const pollRef = useRef(null);

  // When user changes (login/logout/switch), reload local notifs for that user
  useEffect(() => {
    setLocalNotifs(loadLocal(userId));
    setApiNotifs([]);
  }, [userId]);

  // Persist local notifs to localStorage (user-scoped)
  useEffect(() => {
    saveLocal(localNotifs, userId);
  }, [localNotifs, userId]);

  // Refresh relative timestamps every minute
  useEffect(() => {
    const t = setInterval(() => {
      setLocalNotifs(prev =>
        prev.map(n => ({ ...n, time: formatRelativeTime(n.timestamp) }))
      );
      setApiNotifs(prev =>
        prev.map(n => ({ ...n, time: formatRelativeTime(n.timestamp) }))
      );
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // ── API polling ───────────────────────────────────────────────────────

  const fetchApiNotifs = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setApiNotifs(data.map(apiToLocal));
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchApiNotifs();
    pollRef.current = setInterval(fetchApiNotifs, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchApiNotifs]);

  // ── Merged list (API first so cross-user ones appear at top) ──────────

  const notifications = [
    ...apiNotifs,
    ...localNotifs,
  ].sort((a, b) => b.timestamp - a.timestamp);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── Actions ───────────────────────────────────────────────────────────

  const markAsRead = useCallback(async (id) => {
    if (typeof id === "string" && id.startsWith("api_")) {
      const apiId = parseInt(id.replace("api_", ""));
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          await fetch(`${API_BASE}/notifications/${apiId}/read`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (_) {}
      }
      setApiNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      setLocalNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        await fetch(`${API_BASE}/notifications/read-all`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (_) {}
    }
    setApiNotifs(prev => prev.map(n => ({ ...n, read: true })));
    setLocalNotifs(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const deleteNotification = useCallback(async (id) => {
    if (typeof id === "string" && id.startsWith("api_")) {
      const apiId = parseInt(id.replace("api_", ""));
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          await fetch(`${API_BASE}/notifications/${apiId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (_) {}
      }
      setApiNotifs(prev => prev.filter(n => n.id !== id));
    } else {
      setLocalNotifs(prev => prev.filter(n => n.id !== id));
    }
  }, []);

  const clearAll = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (token) {
      try {
        await fetch(`${API_BASE}/notifications/`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (_) {}
    }
    setApiNotifs([]);
    setLocalNotifs([]);
  }, []);

  // Local-only add (for chat bridge + admin self-notifications)
  const addNotification = useCallback((notification) => {
    const now = Date.now();
    setLocalNotifs(prev => [
      {
        id: now,
        type: "system",
        ...notification,
        _source: "local",
        read: false,
        timestamp: now,
        time: "Just now",
      },
      ...prev,
    ]);
  }, []);

  // Remove all notifications of type "message" (called when user opens chat)
  const removeMessageNotifications = useCallback(() => {
    setLocalNotifs(prev => prev.filter(n => n.type !== "message"));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAll,
        addNotification,
        removeMessageNotifications,
        refetchNotifications: fetchApiNotifs,
        isSoundEnabled,
        setIsSoundEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
