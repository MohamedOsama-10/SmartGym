// src/components/chat/ChatWindow.jsx
import { useState, useRef, useEffect } from "react";
import { useChat } from "../../context/ChatContext";
import ChatMenu from "./ChatMenu";
import FilePicker from "./FilePicker";

import { API_CONFIG } from "../../services/httpClient";
const API_ORIGIN = API_CONFIG.ORIGIN;

function ParticipantAvatar({ avatarUrl, initials, size = "w-10 h-10", textSize = "text-sm", gradient = "from-blue-500 to-purple-600" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = !imgFailed && avatarUrl
    ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') ? avatarUrl : `${API_ORIGIN}${avatarUrl}`)
    : null;
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={`${size} rounded-full object-cover`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold ${textSize}`}>
      {initials}
    </div>
  );
}

export default function ChatWindow({ conversation, onBack }) {
  const { getMessagesForConversation, sendMessage, currentUserId, currentUserAvatarUrl, currentUserInitials, addOptimisticMessage, removeOptimisticMessage } = useChat();
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [sendError, setSendError] = useState("");
  const messagesEndRef = useRef(null);
  const messages = getMessagesForConversation(conversation.id);
  const emojiPickerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage("");
    setShowEmojiPicker(false);
    setSendError("");
    // Optimistic update — show the message immediately without waiting for the server
    const tempId = `temp-${Date.now()}`;
    addOptimisticMessage(conversation.id, { id: tempId, text, senderId: currentUserId, timestamp: new Date().toISOString(), media_url: null, isRead: false });
    try {
      await sendMessage(conversation.id, text, tempId);
    } catch (err) {
      removeOptimisticMessage(conversation.id, tempId);
      setNewMessage(text); // restore so user can retry
      setSendError(err.message || "Failed to send. Try again.");
    }
  };

  const formatMessageTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatMessageDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    }
  };

  // Common emojis
  const emojis = ["😀", "😂", "🥰", "😎", "💪", "🔥", "❤️", "👍", "🎉", "🤔", "😴", "🍎", "🏋️", "🎯", "✅"];

  const handleEmojiClick = (emoji) => {
    setNewMessage((prev) => prev + emoji);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center gap-3 transition-colors duration-300">
        {/* Back arrow — mobile only */}
        <button
          onClick={onBack}
          className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="relative">
          <ParticipantAvatar
            avatarUrl={conversation.participant.avatar_url}
            initials={conversation.participant.avatar}
          />
          {conversation.participant.status === "online" && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full transition-colors duration-300"></div>
          )}
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white transition-colors duration-300">
            {conversation.participant.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">
            {conversation.participant.status === "online"
              ? "Online"
              : "Offline"}
          </p>
        </div>

        {/* Chat Menu (Three Dots) */}
        <ChatMenu conversation={conversation} onClose={onBack} />

        {/* Close button — desktop only */}
        <button
          onClick={onBack}
          title="Close chat"
          className="hidden md:flex p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300"
        >
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date Separator */}
            <div className="flex items-center justify-center my-4">
              <div className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full text-xs text-gray-600 dark:text-gray-300 font-medium transition-colors duration-300">
                {formatMessageDate(dateMessages[0].timestamp)}
              </div>
            </div>

            {dateMessages.map((message, index) => {
              const isMe = message.senderId === currentUserId;
              const showAvatar =
                index === 0 ||
                dateMessages[index - 1].senderId !== message.senderId;

              return (
                <div
                  key={message.id}
                  className={`flex gap-3 mb-4 ${
                    isMe ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar (only show on first message of group) */}
                  <div className="flex-shrink-0 w-8">
                    {showAvatar && !isMe && (
                      <ParticipantAvatar
                        avatarUrl={conversation.participant.avatar_url}
                        initials={conversation.participant.avatar}
                        size="w-8 h-8"
                        textSize="text-xs"
                      />
                    )}
                    {showAvatar && isMe && (
                      <ParticipantAvatar
                        avatarUrl={currentUserAvatarUrl}
                        initials={currentUserInitials}
                        size="w-8 h-8"
                        textSize="text-xs"
                        gradient="from-green-500 to-teal-600"
                      />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[70%] ${
                      isMe ? "items-end" : "items-start"
                    } flex flex-col`}
                  >
                    <div
                      className={`rounded-2xl overflow-hidden ${
                        message.media_url ? "p-0" : "px-4 py-2.5"
                      } ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-md"
                          : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-bl-md shadow-sm transition-colors duration-300"
                      }`}
                    >
                      {/* Real image/file from backend */}
                      {message.media_url && (() => {
                        const mediaSrc = message.media_url.startsWith('http')
                          ? message.media_url
                          : `${API_ORIGIN}${message.media_url}`;
                        // Get extension from URL path (before any query params)
                        const urlPath = message.media_url.split('?')[0];
                        const ext = urlPath.split('.').pop()?.toLowerCase();
                        // Also detect Cloudinary image URLs by path pattern
                        const isCloudinaryImage = message.media_url.includes('cloudinary.com') && 
                          message.media_url.includes('/image/upload/');
                        const isCloudinaryVideo = message.media_url.includes('cloudinary.com') && 
                          message.media_url.includes('/video/upload/');
                        const isImg = isCloudinaryImage || ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);
                        const isVid = isCloudinaryVideo || ['mp4','webm','ogg','mov'].includes(ext);
                        if (isImg) return (
                          <a href={mediaSrc} target="_blank" rel="noreferrer">
                            <img src={mediaSrc} alt="Shared" className="max-w-full max-h-64 object-cover" />
                          </a>
                        );
                        if (isVid) return (
                          <video src={mediaSrc} controls className="max-w-full max-h-64" />
                        );
                        return (
                          <a href={mediaSrc} target="_blank" rel="noreferrer"
                            className={`flex items-center gap-2 px-4 py-3 ${isMe ? "text-white" : "text-blue-600"}`}>
                            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm font-medium truncate">{message.media_url.split('/').pop()}</span>
                          </a>
                        );
                      })()}
                      {/* Text content */}
                      {message.text && (
                        <p className={`text-sm leading-relaxed ${message.media_url ? "px-4 py-2" : ""}`}>
                          {message.text}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1 transition-colors duration-300">
                      {formatMessageTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 transition-colors duration-300">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-20 left-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10 transition-colors duration-300"
          >
            <div className="grid grid-cols-8 gap-2">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-1 transition-colors duration-300"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* File Picker Modal */}
        {showFilePicker && (
          <FilePicker
            conversationId={conversation.id}
            onClose={() => setShowFilePicker(false)}
          />
        )}

        {sendError && (
          <p className="text-xs text-red-500 mb-2 text-center">{sendError}</p>
        )}

        <form onSubmit={handleSend} className="flex items-center gap-3">
          {/* Attachment Button */}
          <button
            type="button"
            onClick={() => setShowFilePicker(true)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 rounded-full transition-colors duration-300 ${
              showEmojiPicker
                ? "text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-full text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-300"
          />

          <button
            type="submit"
            disabled={!newMessage.trim()}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              newMessage.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/30"
                : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}