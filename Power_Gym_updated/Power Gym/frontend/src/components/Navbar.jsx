// src/components/Navbar.jsx
import React from 'react';
import { Moon, Sun, Bell, User } from 'lucide-react'; // أضف User icon
import { useNavigate } from 'react-router-dom'; // للتنقل

export default function Navbar({ darkMode, setDarkMode }) {
  const navigate = useNavigate(); // للتنقل
  const [notifications, setNotifications] = React.useState([]);
  const [showNotifications, setShowNotifications] = React.useState(false);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-4">
        
        {/* Your logo/title here */}
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Fitness App
        </h1>

        {/* Right side buttons */}
        <div className="flex items-center gap-4">
          
          {/* PROFILE ICON - Fully Clickable */}
          <div className="relative group">
            <button
              onClick={() => navigate('/user/profile')} // ينقل إلى Profile page
              className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 
                         hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="View Profile"
            >
              <User className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            {/* Hover tooltip */}
            <div className="absolute top-full right-0 mt-2 px-3 py-1 bg-gray-900 text-white text-xs 
                           rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                           pointer-events-none whitespace-nowrap">
              View Profile
            </div>
          </div>

          {/* NOTIFICATION BUTTON - Fully Clickable */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 
                         hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Notifications"
            >
              <div className="relative">
                <Bell className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                {/* Notification badge */}
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs 
                                 flex items-center justify-center rounded-full font-bold">
                    {notifications.length}
                  </span>
                )}
              </div>
            </button>

            {/* Notification dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg 
                            border border-gray-200 dark:border-gray-700 z-50">
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Notifications</h3>
                  {notifications.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No new notifications</p>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div key={notif.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <p className="text-sm text-gray-800 dark:text-gray-200">{notif.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* DARK MODE BUTTON - Fully Clickable */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 
                       hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <Sun className="w-6 h-6 text-yellow-500" />
            ) : (
              <Moon className="w-6 h-6 text-gray-600" />
            )}
          </button>

        </div>
      </div>
    </header>
  );
}