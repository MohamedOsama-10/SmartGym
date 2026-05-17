// src/components/Modal.jsx
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({ isOpen, onClose, title, children, size = "md" }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) onClose();
  };

  const sizeClasses = {
    sm: "max-w-md w-full mx-4",
    md: "max-w-2xl w-full mx-4",
    lg: "max-w-4xl w-full mx-4",
    xl: "max-w-6xl w-full mx-4",
    full: "max-w-full mx-4",
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
    >
      <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-2xl ${sizeClasses[size]} max-h-[90vh] overflow-hidden animate-slideUp transition-colors duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 transition-colors">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white transition-colors">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)] bg-white dark:bg-gray-800 transition-colors">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}