// src/pages/user/Workouts.jsx
import React, { useState, useEffect } from "react";
import { workoutAPI } from "../../services/workoutAPI";
import { useAuth } from "../../context/AuthContext";

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const toEmbedUrl = (url) => {
  if (!url) return url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
};

const getDayKey = (programId, weekIdx, dayName) =>
  `prog_${programId}_w${weekIdx}_${dayName}`;

const getDateLabel = (isoStr) => {
  const date = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
};

const formatTime = (isoStr) =>
  new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });


export default function Workouts() {
  const { user } = useAuth();
  const WK_KEY = `completedWorkoutDays_${user?.id || 'guest'}`;

  const [programs, setPrograms]         = useState([]);
  const [selected, setSelected]         = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [expandedDay, setExpandedDay]   = useState(null);
  const [videoModal, setVideoModal]     = useState(null);
  const [activeView, setActiveView]     = useState("schedule"); // "schedule" | "history"

  const [completedDays, setCompletedDays] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`completedWorkoutDays_${user?.id || 'guest'}`) || "{}"); }
    catch { return {}; }
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workoutAPI.getMyProgram();
      const list = Array.isArray(data) ? data : [];
      setPrograms(list);
      // Don't auto-open — user taps a card to open
    } catch {
      setError("Could not load your training program.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDayComplete = (programId, weekIdx, dayName) => {
    const key = getDayKey(programId, weekIdx, dayName);
    setCompletedDays((prev) => {
      let updated;
      if (prev[key]) {
        updated = { ...prev };
        delete updated[key];
      } else {
        updated = {
          ...prev,
          [key]: { completedAt: new Date().toISOString(), programId, weekIdx, dayName },
        };
      }
      localStorage.setItem(WK_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // ── history data ─────────────────────────────────────────────────────────────
  const historyEntries = Object.entries(completedDays)
    .map(([key, val]) => ({ key, ...val, program: programs.find((p) => p.id === val.programId) }))
    .filter((e) => e.program)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const thisWeekCount = historyEntries.filter((e) => new Date(e.completedAt) >= startOfWeek).length;

  // Group history by date label
  const groupedHistory = (() => {
    const map = {};
    historyEntries.forEach((e) => {
      const label = getDateLabel(e.completedAt);
      if (!map[label]) map[label] = [];
      map[label].push(e);
    });
    return Object.entries(map).map(([label, entries]) => ({ label, entries }));
  })();

  // ── loading / empty ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (programs.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Training Program Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Your coach hasn't assigned a training program yet. Check back soon.
          </p>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    );
  }

  const week = selected?.workouts?.[selectedWeek] ?? null;

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Training</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Follow the schedule your coach built for you.
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex gap-2 shrink-0">
          <div className="text-center bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 px-4 py-2.5 rounded-2xl">
            <p className="text-xl font-black text-orange-500">{thisWeekCount}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">This week</p>
          </div>
          <div className="text-center bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 px-4 py-2.5 rounded-2xl">
            <p className="text-xl font-black text-green-600">{historyEntries.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Total done</p>
          </div>
        </div>
      </div>

      {/* ── View toggle ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {[
          { key: "schedule", label: "Schedule" },
          { key: "history",  label: `History ${historyEntries.length > 0 ? `(${historyEntries.length})` : ""}` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeView === key
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* SCHEDULE VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === "schedule" && (
        <>
          {/* ── Program cards grid ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {programs.map((p, idx) => {
              const isOpen = selected?.id === p.id;
              const allDays = (p.workouts || []).flatMap((_, wi) =>
                DAYS_OF_WEEK.map((day) => getDayKey(p.id, wi, day))
              );
              const doneDays = allDays.filter((k) => completedDays[k]).length;
              const pct = allDays.length ? Math.round((doneDays / allDays.length) * 100) : 0;
              const accentColors = [
                { bg: "from-orange-500 to-red-500",    light: "bg-orange-50 dark:bg-orange-900/20",   border: "border-orange-400 dark:border-orange-500",  text: "text-orange-600 dark:text-orange-400",  bar: "bg-orange-500" },
                { bg: "from-blue-500 to-indigo-600",   light: "bg-blue-50 dark:bg-blue-900/20",       border: "border-blue-400 dark:border-blue-500",      text: "text-blue-600 dark:text-blue-400",     bar: "bg-blue-500"   },
                { bg: "from-purple-500 to-pink-600",   light: "bg-purple-50 dark:bg-purple-900/20",   border: "border-purple-400 dark:border-purple-500",  text: "text-purple-600 dark:text-purple-400", bar: "bg-purple-500" },
                { bg: "from-emerald-500 to-teal-600",  light: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-400 dark:border-emerald-500",text: "text-emerald-600 dark:text-emerald-400",bar: "bg-emerald-500"},
              ];
              const accent = accentColors[idx % accentColors.length];

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    if (isOpen) {
                      // tap again → collapse
                      setSelected(null);
                    } else {
                      setSelected(p);
                      setSelectedWeek(0);
                      setExpandedDay(null);
                    }
                  }}
                  className={`group relative rounded-2xl p-3.5 flex flex-col gap-2.5 text-left transition-all duration-200 border-2 overflow-hidden
                    ${isOpen
                      ? `${accent.border} ${accent.light} shadow-md`
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                    }`}
                >
                  {/* Decorative blob */}
                  <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br ${accent.bg} opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none`} />

                  {/* Icon row */}
                  <div className="flex items-center justify-between relative z-10">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base bg-gradient-to-br ${accent.bg} shadow-sm shrink-0`}>
                      💪
                    </div>
                    {/* Open/close chevron */}
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180 " + accent.text : "text-gray-400"}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Name + meta */}
                  <div className="relative z-10">
                    <p className={`font-bold text-sm leading-tight mb-0.5 ${isOpen ? accent.text : "text-gray-900 dark:text-white"}`}>
                      {p.name}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 capitalize">
                      {p.workouts?.length || 0}wk · {p.sessionsPerWeek || 3}/wk
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="relative z-10">
                    <div className="flex justify-between text-[9px] text-gray-400 mb-1">
                      <span>Progress</span>
                      <span className={`font-bold ${pct === 100 ? "text-green-500" : isOpen ? accent.text : ""}`}>{pct}%</span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct === 100 ? "bg-green-500" : accent.bar} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Selected program details ─────────────────────────────────────── */}
          {selected && (
            <>
              {/* Slim info bar for selected program */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl px-5 py-4 text-white flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-orange-200 uppercase tracking-wide font-semibold mb-0.5">Active Program</p>
                  <h3 className="text-lg font-black truncate">{selected.name}</h3>
                  {selected.description && (
                    <p className="text-orange-100 text-xs mt-0.5 leading-relaxed line-clamp-1">{selected.description}</p>
                  )}
                </div>
                {(() => {
                  const allDays = (selected.workouts || []).flatMap((_, wi) =>
                    DAYS_OF_WEEK.map((day) => getDayKey(selected.id, wi, day))
                  );
                  const done = allDays.filter((k) => completedDays[k]).length;
                  const pct  = allDays.length ? Math.round((done / allDays.length) * 100) : 0;
                  return (
                    <div className="text-center shrink-0 bg-white/15 rounded-xl px-4 py-2">
                      <p className="text-2xl font-black leading-none">{pct}%</p>
                      <p className="text-[10px] text-orange-200 mt-0.5 font-medium">done</p>
                    </div>
                  );
                })()}
              </div>

          {/* Week tabs */}
          {selected.workouts?.length > 0 && (
            <div className="flex overflow-x-auto gap-2">
              {selected.workouts.map((w, i) => {
                const weekDone = DAYS_OF_WEEK.filter((day) => completedDays[getDayKey(selected.id, i, day)]).length;
                const weekActive = (w.days || []).filter(
                  (d) => !(d.focus?.toLowerCase().includes("rest") || (!d.focus && !d.exercises?.length))
                ).length;
                return (
                  <button
                    key={i}
                    onClick={() => { setSelectedWeek(i); setExpandedDay(null); }}
                    className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                      selectedWeek === i
                        ? "bg-orange-600 text-white shadow-md"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300"
                    }`}
                  >
                    Week {w.week ?? i + 1}
                    {weekDone > 0 && (
                      <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        selectedWeek === i ? "bg-white/30 text-white" : "bg-green-100 text-green-600"
                      }`}>
                        {weekDone}/{weekActive}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Day cards */}
          {week ? (
            <div className="space-y-3">
              {DAYS_OF_WEEK.map((day) => {
                const dayData = week.days?.find((d) => d.day === day);
                const isRest  = !dayData
                  || dayData.focus?.toLowerCase().includes("rest")
                  || (!dayData.focus && (!dayData.exercises || dayData.exercises.length === 0));
                const exCount = dayData?.exercises?.length || 0;
                const isOpen  = expandedDay === day;
                const key     = getDayKey(selected.id, selectedWeek, day);
                const isDone  = !!completedDays[key];

                return (
                  <div
                    key={day}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isDone
                        ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10 shadow-sm"
                        : isRest
                        ? "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 opacity-60"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:border-orange-200 dark:hover:border-orange-700/50"
                    }`}
                  >
                    {/* Day header */}
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                      onClick={() => !isRest && setExpandedDay(isOpen ? null : day)}
                      disabled={isRest}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                          isDone
                            ? "bg-green-500 text-white"
                            : isRest
                            ? "bg-gray-100 dark:bg-gray-700 text-gray-400"
                            : "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                        }`}>
                          {isDone ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : isRest ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                          ) : (
                            <span className="text-xs font-black">{day.slice(0, 2)}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{day}</p>
                          {isRest ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500">Rest & Recovery</p>
                          ) : isDone ? (
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ Completed · {dayData?.focus || "Workout"}
                            </p>
                          ) : (
                            <p className="text-xs text-orange-600 dark:text-orange-400">
                              {dayData?.focus || "Workout"}
                              {dayData?.duration ? ` · ${dayData.duration}` : ""}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isRest && (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {exCount} exercise{exCount !== 1 ? "s" : ""}
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </button>

                    {/* Completion status bar (collapsed done days) */}
                    {!isOpen && isDone && !isRest && (
                      <div className="px-5 pb-3.5 flex items-center justify-between border-t border-green-100 dark:border-green-800/30 pt-2.5">
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Completed {formatTime(completedDays[key].completedAt)}
                        </span>
                        <button
                          onClick={() => toggleDayComplete(selected.id, selectedWeek, day)}
                          className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          Undo
                        </button>
                      </div>
                    )}

                    {/* Exercises (expanded) */}
                    {isOpen && !isRest && (
                      <div className="border-t border-gray-100 dark:border-gray-700">
                        {exCount === 0 ? (
                          <p className="px-5 py-6 text-sm text-gray-400 text-center italic">
                            No exercises listed for this day yet.
                          </p>
                        ) : (
                          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                            {dayData.exercises.map((ex, idx) => (
                              <div key={idx} className="px-5 py-3.5 flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <span className="w-7 h-7 rounded-full bg-orange-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{ex.name}</p>
                                    {ex.notes && (
                                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{ex.notes}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 shrink-0 items-center justify-end">
                                  {ex.sets && ex.reps && (
                                    <span className="text-xs font-bold bg-orange-600 text-white px-2.5 py-1 rounded-lg whitespace-nowrap">
                                      {ex.sets} × {ex.reps}
                                    </span>
                                  )}
                                  {ex.weight && (
                                    <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg">
                                      {ex.weight}
                                    </span>
                                  )}
                                  {ex.rest && (
                                    <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg">
                                      {ex.rest}
                                    </span>
                                  )}
                                  {ex.video_url && (
                                    <button
                                      onClick={() => setVideoModal({ url: toEmbedUrl(ex.video_url), title: ex.name })}
                                      className="flex items-center gap-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1 rounded-lg hover:bg-red-100 transition font-medium"
                                    >
                                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M8 5v14l11-7z"/>
                                      </svg>
                                      Video
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Mark as Done / Undo button */}
                        <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                          {isDone && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Completed at {formatTime(completedDays[key].completedAt)}
                            </span>
                          )}
                          <button
                            onClick={() => toggleDayComplete(selected.id, selectedWeek, day)}
                            className={`ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                              isDone
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                                : "bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
                            }`}
                          >
                            {isDone ? (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Completed — Undo
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Mark as Done
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No schedule for this week yet.</p>
            </div>
          )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* HISTORY VIEW */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeView === "history" && (
        <div className="space-y-5">

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/30 rounded-2xl p-4 text-center">
              <p className="text-2xl md:text-3xl font-black text-orange-500">{thisWeekCount}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wide font-medium">This Week</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 rounded-2xl p-4 text-center">
              <p className="text-2xl md:text-3xl font-black text-green-600">{historyEntries.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 uppercase tracking-wide font-medium">Total Done</p>
            </div>
          </div>

          {historyEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 gap-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-gray-900 dark:text-white">No workouts completed yet</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  Mark your first workout as done to see your history here.
                </p>
              </div>
              <button
                onClick={() => setActiveView("schedule")}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition"
              >
                Go to Schedule
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedHistory.map(({ label, entries }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                    <span className="text-xs text-gray-400 dark:text-gray-500">{entries.length} workout{entries.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {entries.map((e) => {
                      const dayData = e.program?.workouts?.[e.weekIdx]?.days?.find(
                        (d) => d.day === e.dayName
                      );
                      const exCount  = dayData?.exercises?.length || 0;
                      const focus    = dayData?.focus || "";
                      const duration = dayData?.duration || "";
                      return (
                        <div
                          key={e.key}
                          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden hover:border-green-200 dark:hover:border-green-700/50 transition-colors"
                        >
                          <div className="p-4 flex items-start gap-4">
                            {/* Green check badge */}
                            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              {/* Day + time row */}
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-gray-900 dark:text-white">{e.dayName}</p>
                                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatTime(e.completedAt)}</span>
                              </div>
                              {/* Program name */}
                              <p className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-0.5">
                                {e.program?.name}
                                <span className="text-gray-400 dark:text-gray-500 font-normal"> · Week {e.weekIdx + 1}</span>
                              </p>
                              {/* Focus label */}
                              {focus && (
                                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mt-1">{focus}</p>
                              )}
                              {/* Summary badges */}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {exCount > 0 && (
                                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2.5 py-1 rounded-lg font-medium">
                                    {exCount} exercise{exCount !== 1 ? "s" : ""}
                                  </span>
                                )}
                                {duration && (
                                  <span className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-lg font-medium">
                                    {duration}
                                  </span>
                                )}
                                {exCount > 0 && dayData?.exercises?.slice(0, 3).map((ex, i) => (
                                  <span key={i} className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                    {ex.name}
                                  </span>
                                ))}
                                {exCount > 3 && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">+{exCount - 3} more</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {/* Footer row */}
                          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                            <button
                              onClick={() => toggleDayComplete(e.programId, e.weekIdx, e.dayName)}
                              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            >
                              Remove from history
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Video Modal ──────────────────────────────────────────────────────── */}
      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-5 py-3 bg-gray-900 border-b border-gray-800">
              <h3 className="text-white font-medium truncate">{videoModal.title}</h3>
              <button onClick={() => setVideoModal(null)} className="text-white hover:bg-gray-800 p-1.5 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="aspect-video">
              <iframe src={videoModal.url} title={videoModal.title} className="w-full h-full" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
