// src/components/chat/EmptyState.jsx
export default function EmptyState({ userRole }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6 transition-colors duration-300">
        <svg
          className="w-12 h-12 text-blue-600 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 transition-colors duration-300">
        {userRole === "user"
          ? "Start a conversation with your coach"
          : userRole === "coach"
          ? "Select a trainee to start chatting"
          : "Select a conversation"}
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm transition-colors duration-300">
        {userRole === "user"
          ? "Choose a coach from the list to discuss your workouts, nutrition, or schedule."
          : userRole === "coach"
          ? "Select a trainee from the list to provide guidance and support."
          : "Choose someone from the list to start a conversation, or click the compose icon to message any user."}
      </p>
    </div>
  );
}