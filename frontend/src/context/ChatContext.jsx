// src/context/ChatContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { useProfile } from "./ProfileContext";

const ChatContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';

class AuthError extends Error {}
class NotFoundError extends Error {}

const chatRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  if (response.status === 401) {
    throw new AuthError('Session expired');
  }
  if (response.status === 404) {
    throw new NotFoundError(`Not found: ${endpoint}`);
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
};

export const ChatProvider = ({ children }) => {
  const { user, logout } = useAuth();
  const { profile } = useProfile();

  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState({}); // { [convId]: [...] }
  const [activeConversationId, setActiveConversationId] = useState(() => {
    const saved = sessionStorage.getItem('chat_active_conv');
    return saved ? parseInt(saved, 10) : null;
  });
  const [currentUserAvatarUrl, setCurrentUserAvatarUrl] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const pollingRef = useRef(null);
  const globalPollRef = useRef(null);
  const activeConvIdRef = useRef(null);
  const creatingConvRef = useRef(new Set()); // tracks in-flight getOrCreate calls

  // Keep ref in sync so polling callbacks can read current value without stale closure
  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // Persist active conversation to sessionStorage so it survives page refresh
  useEffect(() => {
    if (activeConversationId != null) {
      sessionStorage.setItem('chat_active_conv', String(activeConversationId));
    } else {
      sessionStorage.removeItem('chat_active_conv');
    }
  }, [activeConversationId]);

  const currentUserId = user?.id || null;
  const currentUserInitials = user?.full_name
    ? user.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // Stop all polling and log out on 401
  const handleAuthError = useCallback(() => {
    clearInterval(globalPollRef.current);
    clearInterval(pollingRef.current);
    logout();
  }, [logout]);

  // ─── Load conversations ───────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const data = await chatRequest('/chat/conversations');
      setConversations(data || []);
    } catch (err) {
      if (err instanceof AuthError) { handleAuthError(); return; }
      console.error('Failed to load conversations:', err);
    }
  }, [user, handleAuthError]);

  // ─── Load contacts ────────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    if (!user) return;
    try {
      const data = await chatRequest('/chat/contacts');
      setContacts(data || []);
    } catch (err) {
      if (err instanceof AuthError) { handleAuthError(); return; }
      console.error('Failed to load contacts:', err);
    }
  }, [user, handleAuthError]);

  // ─── Load messages for a conversation ────────────────────────────────────
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const data = await chatRequest(`/chat/conversations/${convId}/messages`);
      setMessages(prev => ({ ...prev, [convId]: data || [] }));
    } catch (err) {
      if (err instanceof AuthError) { handleAuthError(); return; }
      if (err instanceof NotFoundError) {
        // Conversation deleted or inaccessible — stop polling it
        setActiveConversationId(null);
        sessionStorage.removeItem('chat_active_conv');
        return;
      }
      console.error('Failed to load messages:', err);
    }
  }, [handleAuthError]);

  // ─── Load current user's own avatar URL ───────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (user.role === 'owner' || user.role === 'admin') {
      // prefer server URL (avatar_url) over base64 (avatar)
      setCurrentUserAvatarUrl(profile?.avatar_url || profile?.avatar || null);
      return;
    }
    if (user.role === 'coach') {
      // Use profile from ProfileContext (already loaded) — avatar_url for coaches
      setCurrentUserAvatarUrl(profile?.avatar_url || null);
      return;
    }
    if (user.role === 'user') {
      chatRequest('/users/me/profile')
        .then(data => setCurrentUserAvatarUrl(data?.avatar_url || null))
        .catch(() => {});
    }
  }, [user, profile?.avatar, profile?.avatar_url]);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadConversations();
    loadContacts();
  }, [loadConversations, loadContacts]);

  // ─── Global conversation polling (every 5 s, always on) ──────────────────
  useEffect(() => {
    if (!user) return;
    globalPollRef.current = setInterval(loadConversations, 5000);
    return () => clearInterval(globalPollRef.current);
  }, [user, loadConversations]);

  // ─── Active-conversation message polling (every 3 s) ─────────────────────
  useEffect(() => {
    if (!activeConversationId) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    loadMessages(activeConversationId);
    pollingRef.current = setInterval(() => {
      loadMessages(activeConversationId);
    }, 3000);
    return () => clearInterval(pollingRef.current);
  }, [activeConversationId, loadMessages]);

  // ─── Get / create a conversation with a contact's user ID ────────────────
  const getOrCreateConversation = useCallback(async (contactUserId) => {
    // Deduplicate concurrent calls for the same contact (prevents IntegrityError race)
    if (creatingConvRef.current.has(contactUserId)) return null;
    creatingConvRef.current.add(contactUserId);
    try {
      const data = await chatRequest(`/chat/conversations/with/${contactUserId}`, { method: 'POST' });
      await loadConversations(); // refresh list so the new conversation appears
      return data.id;
    } catch (err) {
      console.error('Failed to get/create conversation:', err);
      return null;
    } finally {
      creatingConvRef.current.delete(contactUserId);
    }
  }, [loadConversations]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getConversationsForUser = useCallback(() => conversations, [conversations]);

  const getActiveConversation = useCallback(
    () => conversations.find(c => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const getMessagesForConversation = useCallback(
    (convId) => messages[convId] || [],
    [messages]
  );

  const getMediaForConversation = useCallback((convId) => {
    const msgs = messages[convId] || [];
    return msgs
      .filter(m => m.media_url)
      .map(m => {
        const url = m.media_url.startsWith('http')
          ? m.media_url
          : `${API_BASE_URL.replace('/api/v1', '')}${m.media_url}`;
        const urlPath = url.split('?')[0];
        const ext = urlPath.split('.').pop()?.toLowerCase();
        const isCloudinaryImage = url.includes('cloudinary.com') && url.includes('/image/upload/');
        const isImg = isCloudinaryImage || ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
        return {
          id: m.id,
          url,
          type: isImg ? 'image' : 'file',
          name: urlPath.split('/').pop() || 'file',
        };
      });
  }, [messages]);

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (convId, text) => {
    const msg = await chatRequest(`/chat/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
    setMessages(prev => ({
      ...prev,
      [convId]: [...(prev[convId] || []), msg],
    }));
    setConversations(prev =>
      prev.map(c =>
        c.id === convId
          ? {
              ...c,
              lastMessage: {
                text,
                timestamp: msg.timestamp,
                senderId: currentUserId,
                isRead: true,
              },
            }
          : c
      )
    );
  }, [currentUserId]);

  const sendMedia = useCallback(async (convId, file) => {
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE_URL}/chat/conversations/${convId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const msg = await response.json();
      setMessages(prev => ({
        ...prev,
        [convId]: [...(prev[convId] || []), msg],
      }));
    } catch (err) {
      console.error('Failed to send media:', err);
    }
  }, []);

  // ─── Mark conversation read ───────────────────────────────────────────────
  const markAsRead = useCallback(async (convId) => {
    try {
      await chatRequest(`/chat/conversations/${convId}/read`, { method: 'PUT' });
      setConversations(prev =>
        prev.map(c => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  }, []);

  const deleteConversation = useCallback(async (convId) => {
    try {
      await chatRequest(`/chat/conversations/${convId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== convId));
      setMessages(prev => {
        const updated = { ...prev };
        delete updated[convId];
        return updated;
      });
      setActiveConversationId(null);
      sessionStorage.removeItem('chat_active_conv');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, []);

  const clearChat = useCallback(async (convId) => {
    try {
      await chatRequest(`/chat/conversations/${convId}/messages`, { method: 'DELETE' });
      setMessages(prev => ({ ...prev, [convId]: [] }));
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  }, []);
  const muteConversation = useCallback(() => {}, []);
  const unmuteConversation = useCallback(() => {}, []);
  const isMuted = useCallback(() => false, []);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        contacts,
        activeConversationId,
        setActiveConversationId,
        getConversationsForUser,
        getActiveConversation,
        getMessagesForConversation,
        getMediaForConversation,
        sendMessage,
        sendMedia,
        markAsRead,
        deleteConversation,
        clearChat,
        muteConversation,
        unmuteConversation,
        isMuted,
        currentUserId,
        currentUserInitials,
        currentUserAvatarUrl,
        getOrCreateConversation,
        loadConversations,
        loadContacts,
        loadMessages,
        isChatOpen,
        setIsChatOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
};