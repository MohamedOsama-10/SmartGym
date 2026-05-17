// src/components/chat/ChatLayout.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useChat } from "../../context/ChatContext";
import { apiRequest } from "../../services/httpClient";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import EmptyState from "./EmptyState";

export default function ChatLayout({ userRole }) {
  const location = useLocation();
  const autoOpenHandled = useRef(false);

  const {
    conversations: allConversations,
    activeConversationId,
    setActiveConversationId,
    setIsChatOpen,
    loadMessages,
    loadConversations,
  } = useChat();

  // On mobile: hide list if a conversation was restored from sessionStorage
  const [isMobileListVisible, setIsMobileListVisible] = useState(!activeConversationId);

  // Stable refs so effects don't need to re-register when callbacks change identity
  const loadConversationsRef = useRef(loadConversations);
  const loadMessagesRef = useRef(loadMessages);
  const setActiveConversationIdRef = useRef(setActiveConversationId);
  useEffect(() => { loadConversationsRef.current = loadConversations; }, [loadConversations]);
  useEffect(() => { loadMessagesRef.current = loadMessages; }, [loadMessages]);
  useEffect(() => { setActiveConversationIdRef.current = setActiveConversationId; }, [setActiveConversationId]);

  // ── Auto-open conversation when navigated from chat search ───────────────
  useEffect(() => {
    const { openUserId } = location.state || {};
    if (!openUserId || autoOpenHandled.current) return;
    // Wait for conversations to finish loading before trying to open
    if (allConversations.length > 0) {
      const findOrCreateConversation = async () => {
        autoOpenHandled.current = true;
        try {
          const existing = allConversations.find(c =>
            c.other_user_id === openUserId ||
            c.coach_user_id === openUserId ||
            c.customer_user_id === openUserId
          );
          if (existing) {
            setActiveConversationIdRef.current(existing.id);
            setIsMobileListVisible(false);
            return;
          }
          const newConv = await apiRequest(`/chat/conversations/with/${openUserId}`, { method: 'POST' });
          await loadConversationsRef.current();
          setActiveConversationIdRef.current(newConv.id);
          setIsMobileListVisible(false);
        } catch (err) {
          console.error('Failed to open conversation:', err);
        }
      };
      findOrCreateConversation();
    }
  }, [location.state, allConversations]);

  // Tell the bridge the chat page is mounted so it suppresses notifications for the active conversation
  useEffect(() => {
    setIsChatOpen(true);
    return () => setIsChatOpen(false);
  }, [setIsChatOpen]);

  // When switching conversations, load messages immediately (don't wait for next poll tick)
  useEffect(() => {
    if (!activeConversationId) return;
    loadMessagesRef.current(activeConversationId);
    const found = allConversations.find(c => c.id === activeConversationId);
    if (!found) loadConversationsRef.current();
  }, [activeConversationId, allConversations]);

  const activeConversation = allConversations.find(c => c.id === activeConversationId) || null;

  const handleSelectConversation = useCallback((conversationId) => {
    setActiveConversationId(conversationId);
    setIsMobileListVisible(false);
  }, [setActiveConversationId]);

  const handleBackToList = useCallback(() => {
    setIsMobileListVisible(true);
    setActiveConversationId(null);
  }, [setActiveConversationId]);

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-300">
      {/* Conversation List - Left Side */}
      <div
        className={`${
          isMobileListVisible ? "flex" : "hidden"
        } md:flex w-full md:w-80 lg:w-96 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-colors duration-300`}
      >
        <ConversationList
          conversations={allConversations}
          activeId={activeConversationId}
          onSelect={handleSelectConversation}
          userRole={userRole}
        />
      </div>

      {/* Chat Window - Right Side */}
      <div
        className={`${
          !isMobileListVisible ? "flex" : "hidden"
        } md:flex flex-1 flex-col bg-white dark:bg-gray-900 transition-colors duration-300`}
      >
        {activeConversation ? (
          <ChatWindow
            key={activeConversation.id}
            conversation={activeConversation}
            onBack={handleBackToList}
          />
        ) : (
          <EmptyState userRole={userRole} />
        )}
      </div>
    </div>
  );
}
