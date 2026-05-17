// src/components/chat/ChatPage.jsx
import { useLocation } from "react-router-dom";
import ChatLayout from "./ChatLayout";

export default function ChatPage({ userRole }) {
  const location = useLocation();
  const { openUserName } = location.state || {};

  const subtitle = openUserName
    ? `Opening conversation with ${openUserName}…`
    : userRole === "user"
      ? "Chat with your coaches and get personalized guidance"
      : userRole === "coach"
        ? "Communicate with your trainees and track their progress"
        : "Send and receive messages";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">Messages</h2>
          <p className="text-gray-600 dark:text-gray-400 transition-colors duration-300">{subtitle}</p>
        </div>
      </div>

      <ChatLayout userRole={userRole} />
    </div>
  );
}