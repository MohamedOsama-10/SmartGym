// src/components/chat/ConversationList.jsx
import { useState } from "react";
import { useChat } from "../../context/ChatContext";
import { API_CONFIG } from "../../services/httpClient";

const API_ORIGIN = API_CONFIG.ORIGIN;

function ParticipantAvatar({ avatarUrl, initials, size = "w-12 h-12", textSize = "text-sm" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = !imgFailed && avatarUrl
    ? (avatarUrl.startsWith('http') || avatarUrl.startsWith('data:') ? avatarUrl : `${API_ORIGIN}${avatarUrl}`)
    : null;
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={`${size} rounded-full object-cover flex-shrink-0`}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold ${textSize} flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  userRole,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showContacts, setShowContacts] = useState(false);
  const [starting, setStarting] = useState(null); // contactId being opened

  const { markAsRead, currentUserId, contacts, getOrCreateConversation } = useChat();

  const filteredConversations = conversations.filter((conv) =>
    conv.participant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Contacts that don't yet have an active conversation
  const existingContactIds = new Set(conversations.map(c => c.participant.id));
  const newContacts = contacts.filter(c => !existingContactIds.has(c.id));

  const handleSelect = (conv) => {
    if (conv.unreadCount > 0) {
      markAsRead(conv.id);
    }
    onSelect(conv.id);
  };

  const handleContactClick = async (contact) => {
    setStarting(contact.id);
    try {
      const convId = await getOrCreateConversation(contact.id);
      if (convId) {
        setShowContacts(false);
        onSelect(convId);
      }
    } finally {
      setStarting(null);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-800 transition-colors duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white transition-colors duration-300">
            {showContacts
              ? "New Chat"
              : userRole === "user" ? "My Coaches" : userRole === "coach" ? "My Trainees" : "Messages"}
          </h2>
          {/* Toggle between conversations and new-chat contacts */}
          <button
            onClick={() => setShowContacts(v => !v)}
            title={showContacts ? "Back to conversations" : "Start new chat"}
            className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors duration-200"
          >
            {showContacts ? (
              // X / back icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Compose / new-chat icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            )}
          </button>
        </div>

        {!showContacts && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-600 transition-all duration-300"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800 transition-colors duration-300">

        {/* ── NEW CHAT: contacts list ── */}
        {showContacts && (
          <>
            {newContacts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">No contacts found.</p>
                <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                  {userRole === "user"
                    ? "You need an assigned coach or a booking first."
                    : userRole === "coach"
                    ? "You need assigned trainees or bookings first."
                    : "No users found in the system."}
                </p>
              </div>
            ) : (
              newContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleContactClick(contact)}
                  disabled={starting === contact.id}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border-b border-gray-100 dark:border-gray-700"
                >
                  <ParticipantAvatar avatarUrl={contact.avatar_url} initials={contact.avatar || "?"} />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">
                      {contact.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {contact.specialty || contact.role}
                    </p>
                  </div>
                  {starting === contact.id ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))
            )}
          </>
        )}

        {/* ── CONVERSATIONS list ── */}
        {!showContacts && (
          <>
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-sm">No conversations yet.</p>
                {newContacts.length > 0 && (
                  <button
                    onClick={() => setShowContacts(true)}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    Start a new chat
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelect(conv)}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border-b border-gray-100 dark:border-gray-700 ${
                    activeId === conv.id ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-600" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <ParticipantAvatar avatarUrl={conv.participant.avatar_url} initials={conv.participant.avatar} />
                    {conv.participant.status === "online" && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {conv.participant.name}
                      </h3>
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {conv.lastMessage?.timestamp ? formatTime(conv.lastMessage.timestamp) : ""}
                      </span>
                    </div>
                    <p className={`text-sm truncate ${
                      conv.unreadCount > 0
                        ? "font-semibold text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400"
                    }`}>
                      {conv.lastMessage?.senderId === currentUserId ? "You: " : ""}
                      {conv.lastMessage?.text || "No messages yet"}
                    </p>
                    {userRole === "user" && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {conv.participant.specialty}
                      </p>
                    )}
                    {userRole === "coach" && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {conv.participant.plan}
                      </p>
                    )}
                  </div>

                  {/* Unread Badge */}
                  {conv.unreadCount > 0 && (
                    <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-medium">
                        {conv.unreadCount}
                      </span>
                    </div>
                  )}
                </button>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
