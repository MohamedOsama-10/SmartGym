// src/pages/coach/Programs.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { programsAPI } from "../../services/api";

const CATEGORY_STYLES = {
  "weight-loss":     { color: "orange", icon: "🔥", label: "Weight Loss" },
  "muscle-gain":     { color: "blue",   icon: "💪", label: "Muscle Gain" },
  "general-fitness": { color: "green",  icon: "🎯", label: "General Fitness" },
  "strength":        { color: "red",    icon: "🏋️", label: "Strength Training" },
  "endurance":       { color: "purple", icon: "🏃", label: "Endurance" },
  "flexibility":     { color: "pink",   icon: "🧘", label: "Flexibility & Yoga" },
};

const DIFFICULTY_STYLES = {
  beginner:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  intermediate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  advanced:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function Programs() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await programsAPI.listPrograms();
      setPrograms(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load programs");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    try {
      setDeletingId(id);
      await programsAPI.deleteProgram(id);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert("Failed to delete program: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading programs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training Programs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {programs.length} program{programs.length !== 1 ? "s" : ""} created
          </p>
        </div>
        <button
          onClick={() => navigate("/coach/programs/new")}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Program
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <button
            onClick={fetchPrograms}
            className="ml-auto text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!error && programs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-72 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No programs yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Create your first training program to get started.
          </p>
          <button
            onClick={() => navigate("/coach/programs/new")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Create Program
          </button>
        </div>
      )}

      {/* Program grid */}
      {programs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {programs.map((program) => {
            const cat = CATEGORY_STYLES[program.category] || CATEGORY_STYLES["general-fitness"];
            const diffClass = DIFFICULTY_STYLES[program.difficulty] || DIFFICULTY_STYLES["intermediate"];

            return (
              <div
                key={program.id}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Card header */}
                <div className={`p-5 bg-${cat.color}-50 dark:bg-${cat.color}-900/20 border-b border-${cat.color}-100 dark:border-${cat.color}-900/30`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${cat.color}-100 text-${cat.color}-700 dark:bg-${cat.color}-900/30 dark:text-${cat.color}-400`}>
                        {cat.icon} {cat.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${diffClass}`}>
                        {program.difficulty}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        program.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      }`}
                    >
                      {program.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {program.name}
                  </h3>
                  {program.description && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {program.description}
                    </p>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-700 px-1">
                  <div className="py-3 px-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{program.duration}</p>
                  </div>
                  <div className="py-3 px-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sessions/Wk</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{program.sessionsPerWeek}</p>
                  </div>
                  <div className="py-3 px-3 text-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{program.price} EGP</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 p-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => navigate(`/coach/programs/${program.id}`)}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => navigate(`/coach/programs/${program.id}/edit`)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(program.id, program.name)}
                    disabled={deletingId === program.id}
                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm rounded-lg transition disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === program.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
