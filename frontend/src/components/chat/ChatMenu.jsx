// src/components/chat/ChatMenu.jsx
import { useState, useRef, useEffect } from "react";
import { useChat } from "../../context/ChatContext";

// Fix #9: Mute stored in localStorage per conversation so it actually persists.
// ChatContext stubs (muteConversation/unmuteConversation/isMuted) are bypassed here
// since they're no-ops. This is self-contained and works without a backend.
const MUTE_KEY = "chat_muted_convs";
function getMutedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(MUTE_KEY) || "[]")); }
  catch { return new Set(); }
}
function saveMutedSet(set) {
  localStorage.setItem(MUTE_KEY, JSON.stringify([...set]));
}

export default function ChatMenu({ conversation, onClose }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [muted, setMuted] = useState(() => getMutedSet().has(conversation.id));
  const menuRef = useRef(null);
  const {
    deleteConversation,
    clearChat,
    getMediaForConversation,
  } = useChat();

  const media = getMediaForConversation(conversation.id);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this chat? This action cannot be undone.")) {
      deleteConversation(conversation.id);
      onClose();
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    if (window.confirm("Clear all messages in this chat?")) {
      clearChat(conversation.id);
    }
    setIsOpen(false);
  };

  const handleMuteToggle = () => {
    const set = getMutedSet();
    if (muted) {
      set.delete(conversation.id);
    } else {
      set.add(conversation.id);
    }
    saveMutedSet(set);
    setMuted(!muted);
    setIsOpen(false);
  };

  if (showMedia) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between transition-colors duration-300">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
              Media & Files
            </h3>
            <button
              onClick={() => setShowMedia(false)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300"
            >
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-[60vh] bg-white dark:bg-gray-800 transition-colors duration-300">
            {media.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 transition-colors duration-300">
                <p>No media or files shared yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {media.map((item) => (
                  <div key={item.id} className="group relative">
                    {item.type === "image" ? (
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 transition-colors duration-300">
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square rounded-lg bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-4 transition-colors duration-300">
                        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs text-gray-600 dark:text-gray-300 text-center truncate w-full transition-colors duration-300">
                          {item.name}
                        </p>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button className="p-2 bg-white rounded-full text-gray-800 hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50 transition-colors duration-300">
          <button
            onClick={() => { setShowMedia(true); setIsOpen(false); }}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Media & Files
          </button>

          <button
            onClick={handleMuteToggle}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {muted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              )}
            </svg>
            {muted ? "Unmute Notifications" : "Mute Notifications"}
            {muted && <span className="ml-auto text-xs text-blue-500 font-medium">Muted</span>}
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700 my-2 transition-colors duration-300"></div>

          <button
            onClick={handleClear}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear Chat
          </button>

          <button
            onClick={handleDelete}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-300 text-red-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Chat
          </button>
        </div>
      )}
    </div>
  );
}
