// src/pages/owner/OwnerCoachInbox.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/v1";

function authFetch(endpoint, options = {}) {
  const token =
    localStorage.getItem("access_token") || localStorage.getItem("token");
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

// ── Avatar helper ─────────────────────────────────────────────────────────────
function Avatar({ url, name, size = "w-10 h-10", text = "text-sm" }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name}
        className={`${size} rounded-full object-cover flex-shrink-0`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold ${text} flex-shrink-0`}
    >
      {initials}
    </div>
  );
}

// ── Time formatter ────────────────────────────────────────────────────────────
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0)
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isCoach, coachName, participantName }) {
  const label = isCoach ? coachName : participantName;
  const time = formatTime(msg.timestamp);

  return (
    <div className={`flex gap-2 mb-3 ${isCoach ? "justify-end" : "justify-start"}`}>
      {!isCoach && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
          {(label || "?")[0].toUpperCase()}
        </div>
      )}
      <div className={`max-w-[70%] ${isCoach ? "items-end" : "items-start"} flex flex-col`}>
        <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 px-1">{label}</span>
        {msg.media_url ? (
          <img
            src={msg.media_url}
            alt="media"
            className="rounded-xl max-w-full max-h-60 object-cover"
          />
        ) : (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              isCoach
                ? "bg-orange-500 text-white rounded-br-sm"
                : "bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm"
            }`}
          >
            {msg.text}
          </div>
        )}
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-1">{time}</span>
      </div>
      {isCoach && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
          {(coachName || "?")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OwnerCoachInbox() {
  const navigate = useNavigate();

  // Step 1: pick a coach
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [coachSearch, setCoachSearch] = useState("");
  const [loadingCoaches, setLoadingCoaches] = useState(true);

  // Step 2: coach's conversations
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(false);

  // Step 3: messages in selected conversation
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  // Load coaches from contacts (filter role=coach)
  useEffect(() => {
    authFetch("/chat/contacts")
      .then((data) => {
        setCoaches((data || []).filter((c) => c.role === "coach"));
        setLoadingCoaches(false);
      })
      .catch((err) => {
        if (err.message.includes("401")) { navigate("/login"); return; }
        setLoadingCoaches(false);
      });
  }, [navigate]);

  // Load coach's conversations when a coach is selected
  useEffect(() => {
    if (!selectedCoach) return;
    setLoadingConvs(true);
    setConversations([]);
    setSelectedConv(null);
    setMessages([]);

    authFetch(`/chat/coaches/${selectedCoach.id}/conversations`)
      .then((data) => {
        setConversations(data || []);
        setLoadingConvs(false);
      })
      .catch(() => setLoadingConvs(false));
  }, [selectedCoach]);

  // Load messages for selected conversation + poll every 5s
  const fetchMessages = useCallback(() => {
    if (!selectedCoach || !selectedConv) return;
    authFetch(`/chat/conversations/${selectedConv.id}/messages`)
      .then((data) => setMessages(data || []))
      .catch(() => {});
  }, [selectedCoach, selectedConv]);

  useEffect(() => {
    if (!selectedConv) { setMessages([]); return; }
    setLoadingMsgs(true);
    authFetch(`/chat/conversations/${selectedConv.id}/messages`)
      .then((data) => { setMessages(data || []); setLoadingMsgs(false); })
      .catch(() => setLoadingMsgs(false));

    pollRef.current = setInterval(fetchMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [selectedConv, selectedCoach, fetchMessages]);

  // Scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredCoaches = coaches.filter((c) =>
    (c.name || c.full_name || "").toLowerCase().includes(coachSearch.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {selectedCoach && (
          <button
            onClick={() => { setSelectedCoach(null); setSelectedConv(null); setMessages([]); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Coaches
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-2xl">📬</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
              {selectedCoach ? `${selectedCoach.name || selectedCoach.full_name}'s Inbox` : "Coach Inboxes"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedCoach ? "Read-only view of coach conversations" : "Select a coach to view their messages"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Step 1: Coach picker ── */}
      {!selectedCoach && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="relative mb-4 flex-shrink-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search coaches…"
              value={coachSearch}
              onChange={(e) => setCoachSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
            />
          </div>

          {loadingCoaches ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
            </div>
          ) : filteredCoaches.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-5xl mb-3">🏋️</div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No coaches found</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
              {filteredCoaches.map((coach) => (
                <button
                  key={coach.id}
                  onClick={() => setSelectedCoach(coach)}
                  className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden text-left"
                >
                  <div className="h-1.5 bg-gradient-to-r from-orange-400 to-amber-400" />
                  <div className="p-4 flex items-center gap-3">
                    <Avatar url={coach.avatar_url} name={coach.name || coach.full_name} size="w-12 h-12" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{coach.name || coach.full_name}</p>
                      {coach.specialty && <p className="text-xs text-orange-500 truncate">{coach.specialty}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">Tap to view inbox →</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2 & 3: Conversations + Messages ── */}
      {selectedCoach && (
        <div className="flex-1 flex overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">

          {/* Left: conversation list */}
          <div className="w-72 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <p className="font-semibold text-gray-800 dark:text-white text-sm">Conversations</p>
              <p className="text-xs text-gray-400 mt-0.5">{conversations.length} total</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConvs ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-6 text-center">
                  <div className="text-3xl mb-2">💬</div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConv(conv)}
                    className={`w-full p-3 flex items-center gap-3 text-left border-b border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selectedConv?.id === conv.id
                        ? "bg-orange-50 dark:bg-orange-900/20 border-l-4 border-l-orange-500"
                        : ""
                    }`}
                  >
                    <Avatar
                      url={conv.participant.avatar_url}
                      name={conv.participant.name}
                      size="w-10 h-10"
                      text="text-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                          {conv.participant.name}
                        </p>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                          {formatTime(conv.lastMessage?.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {conv.lastMessage?.text || "No messages yet"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{conv.participant.role}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right: message viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="text-5xl mb-3">👈</div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">Select a conversation</p>
                <p className="text-sm text-gray-400 mt-1">Choose from the list to read the messages</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <Avatar
                    url={selectedConv.participant.avatar_url}
                    name={selectedConv.participant.name}
                    size="w-9 h-9"
                    text="text-xs"
                  />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{selectedConv.participant.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{selectedConv.participant.role}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">Read-only</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-4xl mb-3">💬</div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">No messages in this conversation</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isCoach={msg.senderId === selectedCoach.id}
                          coachName={selectedCoach.name || selectedCoach.full_name}
                          participantName={selectedConv.participant.name}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Read-only footer */}
                <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                  <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    You are viewing this conversation in read-only mode
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
