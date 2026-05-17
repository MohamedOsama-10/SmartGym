// src/components/chat/FilePicker.jsx
import { useState, useRef, useEffect } from "react";
import { useChat } from "../../context/ChatContext";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB — matches backend limit

export default function FilePicker({ conversationId, onClose }) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const { sendMedia } = useChat();

  // Fix #5: Revoke blob URL if component unmounts while preview is open
  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSizeError("");

    // Fix #11: Client-side size check before creating blob URL
    if (file.size > MAX_FILE_SIZE) {
      setSizeError("File is too large. Maximum size is 5 MB.");
      e.target.value = "";
      return;
    }

    // Fix #4: Images only — backend only accepts image/jpeg, image/png, image/webp, image/gif
    // Documents don't need a blob URL
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview({ type: "image", url, file, name: file.name });
    } else {
      // Document — no preview URL needed
      setPreview({
        type: "file",
        url: null,
        file,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      });
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      await sendMedia(conversationId, preview.file);
      if (preview?.url) URL.revokeObjectURL(preview.url);
      setPreview(null);
      onClose();
    } catch (e) {
      console.error('Send failed:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
    onClose();
  };

  // Preview Modal
  if (preview) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transition-colors duration-300">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">
              Send {preview.type === "image" ? "Photo" : "File"}
            </h3>
          </div>

          <div className="p-4 bg-white dark:bg-gray-800 transition-colors duration-300">
            {preview.type === "image" && (
              <img
                src={preview.url}
                alt="Preview"
                className="w-full max-h-96 object-contain rounded-lg"
              />
            )}
            {preview.type === "file" && (
              <div className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors duration-300">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center transition-colors duration-300">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate transition-colors duration-300">
                    {preview.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 transition-colors duration-300">{preview.size}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3 transition-colors duration-300">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={uploading}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-300 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between transition-colors duration-300">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white transition-colors duration-300">Send File</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors duration-300">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Size error */}
        {sizeError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{sizeError}</p>
          </div>
        )}

        <div className="p-4 space-y-3 bg-white dark:bg-gray-800 transition-colors duration-300">
          {/* Camera Option — images only (no video, backend doesn't support it) */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center transition-colors duration-300">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Camera</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">Take a photo</p>
            </div>
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Gallery Option — images only */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center transition-colors duration-300">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Gallery</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">Choose a photo</p>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Document Option */}
          <button
            onClick={() => documentInputRef.current?.click()}
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-300 text-gray-700 dark:text-gray-200 rounded-xl"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center transition-colors duration-300">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium">Document</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 transition-colors duration-300">PDF, Word, Excel, etc.</p>
            </div>
          </button>
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
}
