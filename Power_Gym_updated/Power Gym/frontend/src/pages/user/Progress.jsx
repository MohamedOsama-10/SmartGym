// src/pages/user/Progress.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_WORKOUTS_PER_WEEK = 5;

// Circular ring progress (SVG)
function RingProgress({ value, max, color, size = 80, strokeWidth = 8 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const offset = circ - pct * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

// Thin progress bar
function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function Progress() {
  const { apiRequest, user } = useAuth();
  const [filter, setFilter] = useState('week');
  const [progressData, setProgressData] = useState([]);
  const [newEntry, setNewEntry] = useState({ date: '', weight: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [apiWorkouts, setApiWorkouts] = useState([]);
  const [apiMeals, setApiMeals] = useState([]);
  // Real nutrition goals from API (fallback to sensible defaults)
  const [nutritionGoals, setNutritionGoals] = useState({ calories: 2200, protein: 150, carbs: 250, fats: 65 });
  const [weightGoal, setWeightGoal] = useState(null);
  const [profileWeight, setProfileWeight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch API data — allSettled so one failure doesn't blank both charts
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const [workoutResult, mealResult, goalResult, profileResult] = await Promise.allSettled([
        apiRequest('/workouts/my-workouts/history?days=30'),
        apiRequest('/meals/logs/history?days=30'),
        apiRequest('/meals/goals'),
        apiRequest('/users/me/profile'),
      ]);
      if (workoutResult.status === 'fulfilled') {
        setApiWorkouts((workoutResult.value?.history || []).filter(w => w.completed));
      } else {
        console.warn('Workout history unavailable:', workoutResult.reason?.message);
      }
      if (mealResult.status === 'fulfilled') {
        setApiMeals(mealResult.value || []);
      } else {
        console.warn('Meal history unavailable:', mealResult.reason?.message);
        setError('Could not load meal history.');
      }
      if (goalResult.status === 'fulfilled' && goalResult.value) {
        const g = goalResult.value;
        setNutritionGoals({
          calories: g.calories || 2200,
          protein: g.protein || 150,
          carbs: g.carbs || 250,
          fats: g.fats || 65,
        });
      }
      if (profileResult.status === 'fulfilled' && profileResult.value) {
        const p = profileResult.value;
        if (p.weight_goal) setWeightGoal(p.weight_goal);
        if (p.weight) setProfileWeight(p.weight);
      }
      setLoading(false);
    };
    fetchData();
  }, []);


  // Helper: YYYY-MM-DD in LOCAL timezone.
  // Backend sends naive UTC datetime strings (no Z/offset). Appending 'Z' forces UTC
  // parsing so that getFullYear/getMonth/getDate return the correct LOCAL date.
  const localDate = (val) => {
    let d;
    if (val) {
      const s = typeof val === 'string' ? val : String(val);
      // Only append Z if no timezone info present
      d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
    } else {
      d = new Date();
    }
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  };

  // Date cutoff by filter
  const getCutoff = (daysBack = null) => {
    const days = daysBack ?? (filter === 'week' ? 7 : filter === 'month' ? 30 : 365);
    return new Date(Date.now() - days * 86400000);
  };

  // Workouts goal scaled to filter period
  // week → 5/week, month → 5×4=20/month, all → null (don't show goal)
  const workoutsGoal = useMemo(() => {
    if (filter === 'week') return DEFAULT_WORKOUTS_PER_WEEK;
    if (filter === 'month') return DEFAULT_WORKOUTS_PER_WEEK * 4;
    return null;
  }, [filter]);

  // Merge API workouts + localStorage training-program completions
  const allCompleted = useMemo(() => {
    let localEntries = [];
    try {
      const stored = JSON.parse(localStorage.getItem(`completedWorkoutDays_${user?.id || 'guest'}`) || "{}");
      localEntries = Object.values(stored)
        .filter(v => v.completedAt)
        .map(v => ({ completedAt: v.completedAt, completed: true, workoutName: "Training Program" }));
    } catch {}
    // De-duplicate by date+source: API entries take precedence
    return [...apiWorkouts, ...localEntries];
  }, [apiWorkouts]);

  // Group workouts by date
  const workoutsByDate = useMemo(() => {
    const cutoff = getCutoff();
    const map = {};
    allCompleted.filter(w => w.completedAt && new Date(w.completedAt) >= cutoff).forEach(w => {
      const d = localDate(w.completedAt);
      map[d] = (map[d] || 0) + 1;
    });
    return map;
  }, [filter, allCompleted]);

  // Group meals by date — calories
  const caloriesByDate = useMemo(() => {
    const cutoff = getCutoff();
    const map = {};
    apiMeals.filter(m => m.logged_at && new Date(m.logged_at) >= cutoff).forEach(m => {
      const d = localDate(m.logged_at);
      map[d] = (map[d] || 0) + (m.total_calories || 0);
    });
    return map;
  }, [filter, apiMeals]);

  // Filtered weight entries
  const filteredWeightData = useMemo(() => {
    const cutoff = getCutoff();
    return progressData
      .filter(e => new Date(e.date) >= cutoff)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [filter, progressData]);

  // Chart dates (last 7 or 14) — local timezone
  const chartDates = useMemo(() => {
    const count = filter === 'week' ? 7 : 14;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (count - 1 - i));
      return localDate(d);
    });
  }, [filter]);

  // 4-week heatmap dates — local timezone
  const heatmapDates = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (27 - i));
      return localDate(d);
    }), []);

  // Align heatmap rows so day labels (S M T W T F S) match actual calendar days
  // Pad the first partial week with nulls
  const heatmapRows = useMemo(() => {
    // Use noon to avoid any DST/timezone edge case when parsing the date string
    const firstDayOfWeek = new Date(heatmapDates[0] + 'T12:00:00').getDay(); // 0=Sun … 6=Sat
    const padded = [...Array(firstDayOfWeek).fill(null), ...heatmapDates];
    const rowCount = Math.ceil(padded.length / 7);
    return Array.from({ length: rowCount }, (_, w) => padded.slice(w * 7, w * 7 + 7));
  }, [heatmapDates]);

  // All-time workouts by date (for heatmap) — both API + localStorage
  const allWorkoutsByDate = useMemo(() => {
    const map = {};
    allCompleted.forEach(w => {
      if (w.completedAt) {
        const d = localDate(w.completedAt);
        map[d] = (map[d] || 0) + 1;
      }
    });
    return map;
  }, [allCompleted]);

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (allWorkoutsByDate[localDate(d)]) count++;
      else if (i > 0) break;
    }
    return count;
  }, [allWorkoutsByDate]);

  // Today's nutrition totals — local date
  const today = localDate();
  const todayNutrition = useMemo(() => {
    const todayMeals = apiMeals.filter(m => m.logged_at && localDate(m.logged_at) === today);
    return {
      calories: Math.round(todayMeals.reduce((s, m) => s + (m.total_calories || 0), 0)),
      protein: Math.round(todayMeals.reduce((s, m) => s + (m.total_protein || 0), 0)),
      carbs: Math.round(todayMeals.reduce((s, m) => s + (m.total_carbs || 0), 0)),
      fats: Math.round(todayMeals.reduce((s, m) => s + (m.total_fats || 0), 0)),
    };
  }, [apiMeals, today]);

  // All-time sorted weight entries (not filtered) — for "current weight" display
  const allTimeSortedWeight = useMemo(() =>
    [...progressData].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [progressData]
  );

  // Stats
  const stats = useMemo(() => {
    // Current weight = latest all-time entry, fallback to profile weight from DB
    const allTimeLatest = allTimeSortedWeight.length > 0 ? allTimeSortedWeight[allTimeSortedWeight.length - 1].weight : null;
    const latestWeight = allTimeLatest ?? profileWeight ?? 0;
    // Previous = second-to-last in filtered view (for trend comparison within period)
    const prevWeight = filteredWeightData.length > 1 ? filteredWeightData[filteredWeightData.length - 2].weight : null;
    const totalWorkouts = Object.values(workoutsByDate).reduce((s, c) => s + c, 0);
    return { weight: latestWeight, prevWeight, workouts: totalWorkouts, calories: todayNutrition.calories };
  }, [filteredWeightData, workoutsByDate, todayNutrition, allTimeSortedWeight, profileWeight]);

  const effectiveWeightGoal = weightGoal || 70;
  // Support both weight-gain (target > current) and weight-loss (target < current) goals
  const isGainGoal = stats.weight > 0 && effectiveWeightGoal > stats.weight;
  const weightGoalReached = stats.weight > 0 && (
    isGainGoal ? stats.weight >= effectiveWeightGoal : stats.weight <= effectiveWeightGoal
  );
  const weightToGo = stats.weight > 0
    ? Math.abs(effectiveWeightGoal - stats.weight).toFixed(1)
    : null;
  const weightRingPct = stats.weight > 0
    ? (isGainGoal
        ? Math.min(100, (stats.weight / effectiveWeightGoal) * 100)
        : Math.min(100, (effectiveWeightGoal / stats.weight) * 100))
    : 0;

  const handleAddEntry = async () => {
    if (!newEntry.date || !newEntry.weight) { alert("Please fill all fields"); return; }
    const w = parseFloat(newEntry.weight);
    setProgressData(prev => [...prev, { date: newEntry.date, weight: w }]);
    setProfileWeight(w); // update current weight display immediately
    setNewEntry({ date: '', weight: '' });
    setShowAddForm(false);
    // Sync new weight to profile so it reflects on the Profile page
    try {
      await apiRequest('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ weight: w }),
      });
    } catch (e) {
      console.warn('Could not sync weight to profile:', e.message);
    }
  };

  const exportData = () => {
    const csv = 'Date,Weight,Workouts,Calories\n' +
      filteredWeightData.map(e =>
        `${e.date},${e.weight},${workoutsByDate[e.date] || 0},${Math.round(caloriesByDate[e.date] || 0)}`
      ).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'progress.csv'
    });
    a.click();
  };

  const maxWorkouts = Math.max(1, ...chartDates.map(d => workoutsByDate[d] || 0));
  const maxCalories = Math.max(1, ...chartDates.map(d => caloriesByDate[d] || 0));

  const heatColor = (count) => {
    if (!count) return 'bg-gray-100 dark:bg-gray-700';
    if (count === 1) return 'bg-green-200 dark:bg-green-900';
    if (count === 2) return 'bg-green-400 dark:bg-green-700';
    return 'bg-green-600 dark:bg-green-500';
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Progress Tracking</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Monitor your fitness journey</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['week', 'month', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-blue-600 text-white shadow' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}>
              {f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
          <button onClick={() => setShowAddForm(v => !v)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
            + Add Weight
          </button>
          <button onClick={exportData}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition">
            Export CSV
          </button>
        </div>
      </div>

      {/* Add Weight Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Record Weight</h3>
          <div className="flex gap-3 flex-wrap">
            <input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="number" value={newEntry.weight} onChange={e => setNewEntry(p => ({ ...p, weight: e.target.value }))}
              placeholder="Weight (kg)" className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleAddEntry} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
            <button onClick={() => setShowAddForm(false)} className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm">Cancel</button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Workout completions & calories are loaded automatically from your activity.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Weight */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Weight</p>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1 truncate">
                {stats.weight > 0 ? `${stats.weight} kg` : '—'}
              </p>
              {stats.prevWeight && (
                <p className={`text-xs mt-1 font-medium ${stats.weight <= stats.prevWeight ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.weight <= stats.prevWeight ? '▼' : '▲'} {Math.abs(stats.weight - stats.prevWeight).toFixed(1)} kg vs prev
                </p>
              )}
            </div>
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <RingProgress value={weightRingPct} max={100} color={stats.weight > 0 && stats.weight <= effectiveWeightGoal ? '#10b981' : '#3b82f6'} />
              <span className="absolute text-xs font-bold text-blue-600">⚖️</span>
            </div>
          </div>
          <ProgressBar value={weightRingPct} max={100} color={weightGoalReached ? '#10b981' : '#3b82f6'} />
          <div className="text-xs text-gray-400 mt-2 leading-relaxed">
            {weightGoal
              ? <span>Target: <span className="font-semibold text-gray-600 dark:text-gray-300">{effectiveWeightGoal} kg</span></span>
              : <span>Target: <span className="italic">{effectiveWeightGoal} kg</span> <span className="text-gray-300 dark:text-gray-500">(set in Profile)</span></span>}
            {stats.weight > 0 && (
              <span className={`block font-medium ${weightGoalReached ? 'text-green-500' : 'text-orange-500'}`}>
                {weightGoalReached
                  ? 'Goal reached ✓'
                  : `${weightToGo} kg to ${isGainGoal ? 'gain' : 'lose'}`}
              </span>
            )}
          </div>
        </div>

        {/* Workouts */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide truncate">
                Workouts {filter === 'week' ? 'This Week' : filter === 'month' ? 'This Month' : '(All Time)'}
              </p>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">
                {loading ? <span className="text-lg text-gray-400">Loading…</span> : stats.workouts}
              </p>
              {streak > 0 && (
                <p className="text-xs mt-1 font-medium text-orange-500">🔥 {streak} day streak</p>
              )}
            </div>
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <RingProgress
                value={workoutsGoal ? stats.workouts : 0}
                max={workoutsGoal || 1}
                color="#10b981"
              />
              <span className="absolute text-xs font-bold text-green-600">💪</span>
            </div>
          </div>
          <ProgressBar value={workoutsGoal ? stats.workouts : 0} max={workoutsGoal || 1} color="#10b981" />
          {workoutsGoal ? (
            <div className="text-xs text-gray-400 mt-2 leading-relaxed">
              <span>Goal: {workoutsGoal} {filter === 'week' ? 'this week' : 'this month'}</span>
              <span className={`block font-medium ${stats.workouts >= workoutsGoal ? 'text-green-500' : ''}`}>
                {stats.workouts >= workoutsGoal
                  ? 'Achieved ✓'
                  : `${workoutsGoal - stats.workouts} more to go`}
              </span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">All-time total completed workouts</p>
          )}
        </div>

        {/* Calories */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Today's Calories</p>
              <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">
                {loading ? <span className="text-lg text-gray-400">Loading…</span> : todayNutrition.calories.toLocaleString()}
              </p>
              {!loading && todayNutrition.protein > 0 && (
                <p className="text-xs mt-1 text-gray-400">P: {todayNutrition.protein}g · C: {todayNutrition.carbs}g · F: {todayNutrition.fats}g</p>
              )}
            </div>
            <div className="relative flex-shrink-0 flex items-center justify-center">
              <RingProgress value={todayNutrition.calories} max={nutritionGoals.calories} color="#f97316" />
              <span className="absolute text-xs font-bold text-orange-500">🔥</span>
            </div>
          </div>
          <ProgressBar value={todayNutrition.calories} max={nutritionGoals.calories} color="#f97316" />
          <div className="text-xs text-gray-400 mt-2 leading-relaxed">
            <span>Goal: {nutritionGoals.calories.toLocaleString()} kcal/day</span>
            <span className={`block font-medium ${todayNutrition.calories >= nutritionGoals.calories ? 'text-green-500' : ''}`}>
              {todayNutrition.calories >= nutritionGoals.calories
                ? 'On track ✓'
                : `${(nutritionGoals.calories - todayNutrition.calories).toLocaleString()} remaining`}
            </span>
          </div>
        </div>
      </div>

      {/* Activity Heatmap + Nutrition */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Workout Heatmap */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Activity — Last 4 Weeks</h3>
            <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
              <span className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700 inline-block"></span>None
              <span className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-800 inline-block ml-1"></span>1
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block ml-1"></span>2+
            </div>
          </div>
          {/* Day labels — aligned with calendar (Sun=0 … Sat=6) */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayLabels.map((l, i) => (
              <div key={i} className="text-center text-xs text-gray-400">{l}</div>
            ))}
          </div>
          {/* Week rows — first partial week padded with empty cells */}
          {heatmapRows.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
              {week.map((date, di) => {
                if (date === null) {
                  // Empty padding cell
                  return <div key={di} className="h-7 rounded-md" />;
                }
                const cnt = allWorkoutsByDate[date] || 0;
                const isToday = date === today;
                return (
                  <div key={di} title={`${date}: ${cnt} workout${cnt !== 1 ? 's' : ''}`}
                    className={`h-7 rounded-md ${heatColor(cnt)} ${isToday ? 'ring-2 ring-blue-500' : ''} transition-all cursor-default`}>
                  </div>
                );
              })}
            </div>
          ))}
          <p className="text-xs text-gray-400 mt-3 text-center">
            {Object.values(allWorkoutsByDate).reduce((s, c) => s + c, 0)} workouts completed total
          </p>
        </div>

        {/* Today's Nutrition */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Today's Nutrition</h3>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : todayNutrition.calories === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <span className="text-4xl mb-2">🥗</span>
              <p className="text-sm">No meals logged today</p>
            </div>
          ) : (
            <div className="space-y-5">
              {[
                { label: 'Calories', value: todayNutrition.calories, max: nutritionGoals.calories, unit: 'kcal', color: '#f97316' },
                { label: 'Protein', value: todayNutrition.protein, max: nutritionGoals.protein, unit: 'g', color: '#3b82f6' },
                { label: 'Carbs', value: todayNutrition.carbs, max: nutritionGoals.carbs, unit: 'g', color: '#f59e0b' },
                { label: 'Fats', value: todayNutrition.fats, max: nutritionGoals.fats, unit: 'g', color: '#8b5cf6' },
              ].map(({ label, value, max, unit, color }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
                    <span className="text-sm font-bold" style={{ color }}>{value} <span className="font-normal text-gray-400">{unit}</span></span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{Math.round((value / max) * 100)}% of {max}{unit === 'kcal' ? ' kcal' : `g`} goal</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Workouts Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-5">Workouts per Day</h3>
          {loading ? (
            <div className="flex items-end gap-1 h-32">
              {chartDates.map((_, i) => (
                <div key={i} className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t animate-pulse" style={{ height: `${Math.random() * 80 + 20}%` }} />
              ))}
            </div>
          ) : chartDates.every(d => !workoutsByDate[d]) ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <span className="text-3xl mb-2">📭</span>
              <p className="text-sm">No completed workouts in this period</p>
            </div>
          ) : (
            <>
              <div className="flex gap-1 h-32 mb-2">
                {chartDates.map((date, i) => {
                  const count = workoutsByDate[date] || 0;
                  const isToday = date === today;
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center" title={`${date}: ${count} workout${count !== 1 ? 's' : ''}`}>
                      <div className="w-full rounded-t-md transition-all duration-500"
                        style={{
                          height: `${(count / maxWorkouts) * 100}%`,
                          minHeight: count > 0 ? '4px' : '0',
                          background: isToday ? 'linear-gradient(to top, #2563eb, #60a5fa)' : 'linear-gradient(to top, #10b981, #6ee7b7)',
                        }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                {chartDates.map((date, i) => {
                  const isFirstOfMonth = date.slice(-2) === '01';
                  const monthLabel = isFirstOfMonth
                    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })
                    : date.slice(-2);
                  return (
                    <div key={i} className="flex-1 text-center">
                      <span className={`text-xs ${date === today ? 'text-blue-500 font-bold' : isFirstOfMonth ? 'text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                        {monthLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Calories Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h3 className="font-semibold text-gray-900 dark:text-white">Calories per Day</h3>
            <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
              <div className="w-4 h-0.5 bg-red-400 border-dashed border-t-2 border-red-400"></div>
              <span>goal ({nutritionGoals.calories})</span>
            </div>
          </div>
          {loading ? (
            <div className="flex items-end gap-1 h-32">
              {chartDates.map((_, i) => (
                <div key={i} className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-t animate-pulse" style={{ height: `${Math.random() * 80 + 20}%` }} />
              ))}
            </div>
          ) : chartDates.every(d => !caloriesByDate[d]) ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <span className="text-3xl mb-2">🍽️</span>
              <p className="text-sm">No meals logged in this period</p>
            </div>
          ) : (
            <>
              <div className="relative flex gap-1 h-32 mb-2">
                {/* Goal line */}
                <div className="absolute inset-x-0 border-t-2 border-dashed border-red-400 opacity-60"
                  style={{ bottom: `${(nutritionGoals.calories / Math.max(maxCalories, nutritionGoals.calories)) * 100}%` }} />
                {chartDates.map((date, i) => {
                  const cal = Math.round(caloriesByDate[date] || 0);
                  const isToday = date === today;
                  const heightPct = (cal / Math.max(maxCalories, nutritionGoals.calories)) * 100;
                  return (
                    <div key={i} className="flex-1 h-full flex flex-col justify-end items-center" title={`${date}: ${cal} kcal`}>
                      <div className="w-full rounded-t-md transition-all duration-500"
                        style={{
                          height: `${heightPct}%`,
                          minHeight: cal > 0 ? '4px' : '0',
                          background: isToday
                            ? 'linear-gradient(to top, #ea580c, #fb923c)'
                            : cal >= nutritionGoals.calories
                              ? 'linear-gradient(to top, #f97316, #fbbf24)'
                              : 'linear-gradient(to top, #94a3b8, #cbd5e1)',
                        }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                {chartDates.map((date, i) => {
                  const isFirstOfMonth = date.slice(-2) === '01';
                  const monthLabel = isFirstOfMonth
                    ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })
                    : date.slice(-2);
                  return (
                    <div key={i} className="flex-1 text-center">
                      <span className={`text-xs ${date === today ? 'text-orange-500 font-bold' : isFirstOfMonth ? 'text-indigo-400 font-semibold' : 'text-gray-400'}`}>
                        {monthLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Weight Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Weight Log</h3>
        {filteredWeightData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">⚖️</p>
            <p className="text-sm">No weight entries yet. Click <strong>+ Add Weight</strong> to start tracking.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Date</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Weight</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Workouts</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Calories</th>
                  <th className="pb-3 text-xs font-semibold text-gray-400 uppercase">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredWeightData.map((entry, index) => {
                  const prev = index > 0 ? filteredWeightData[index - 1].weight : null;
                  const diff = prev !== null ? entry.weight - prev : null;
                  return (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="py-3 text-gray-700 dark:text-gray-300 font-medium">{entry.date}</td>
                      <td className="py-3 font-bold text-gray-900 dark:text-white">{entry.weight} kg</td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{workoutsByDate[entry.date] || 0}</td>
                      <td className="py-3 text-gray-600 dark:text-gray-400">{Math.round(caloriesByDate[entry.date] || 0)}</td>
                      <td className="py-3">
                        {diff === null ? <span className="text-gray-400">—</span>
                          : diff === 0 ? <span className="text-gray-400">→</span>
                          : diff < 0
                            ? <span className="text-green-500 font-medium">▼ {Math.abs(diff).toFixed(1)}</span>
                            : <span className="text-red-500 font-medium">▲ {diff.toFixed(1)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
