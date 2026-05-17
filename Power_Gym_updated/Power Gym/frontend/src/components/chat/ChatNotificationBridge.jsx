// src/components/chat/ChatNotificationBridge.jsx
// Sits inside BOTH NotificationProvider and ChatProvider.
// Watches for new unread messages and pushes them to the notification bell.
// Also clears message notifications when the user opens the chat.
import { useEffect, useRef } from "react";
import { useChat } from "../../context/ChatContext";
import { useNotifications } from "../../context/NotificationContext";

const STORAGE_KEY = 'chat_prev_unread';

export default function ChatNotificationBridge() {
  const { conversations, activeConversationId, isChatOpen } = useChat();
  const { addNotification, removeMessageNotifications } = useNotifications();

  const storedSnapshot = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  const prevUnread = useRef(storedSnapshot);
  const initialized = useRef(Object.keys(storedSnapshot).length > 0);

  // ── Clear message notifications as soon as the chat page is opened ────────
  useEffect(() => {
    if (isChatOpen) {
      removeMessageNotifications();
    }
  }, [isChatOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Also clear when a specific conversation becomes active ────────────────
  useEffect(() => {
    if (activeConversationId) {
      removeMessageNotifications();
    }
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watch for new incoming messages and push to bell ─────────────────────
  useEffect(() => {
    if (conversations.length === 0) return;

    if (!initialized.current) {
      const snapshot = {};
      conversations.forEach(c => { snapshot[c.id] = c.unreadCount; });
      prevUnread.current = snapshot;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      initialized.current = true;
      return;
    }

    conversations.forEach(c => {
      const prev = prevUnread.current[c.id] ?? 0;
      const notViewingThis = !isChatOpen || c.id !== activeConversationId;

      if (c.unreadCount > prev && notViewingThis) {
        addNotification({
          type: "message",
          title: `New message from ${c.participant?.name || "your contact"}`,
          message: c.lastMessage?.text || "You have a new message",
        });
      }

      prevUnread.current[c.id] = c.unreadCount;
    });

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prevUnread.current));
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}