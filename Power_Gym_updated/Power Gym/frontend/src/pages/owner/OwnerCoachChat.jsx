// src/pages/owner/OwnerCoachChat.jsx
import { useNavigate, useLocation } from "react-router-dom";
import ChatLayout from "../../components/chat/ChatLayout";

export default function OwnerCoachChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openUserName, coachAvatarUrl } = location.state || {};

  return (
    <div className="space-y-4">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/owner/coach-inbox")}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
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
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Coach Inboxes
        </button>

        {openUserName && (
          <div className="flex items-center gap-3">
            {coachAvatarUrl ? (
              <img
                src={coachAvatarUrl}
                alt={openUserName}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-orange-400"
                onError={(e) => (e.target.style.display = "none")}
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold ring-2 ring-orange-300">
                {openUserName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                {openUserName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Coach</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat layout — location.state carries openUserId so ChatLayout auto-opens the conversation */}
      <ChatLayout userRole="owner" />
    </div>
  );
}
