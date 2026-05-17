// src/pages/coach/Users.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useChat } from "../../context/ChatContext";
import {
  fetchMyTrainees,
  fetchTraineeDetails,
  fetchNutritionGoals,
  updateNutritionGoals,
  fetchMealHistory,
  fetchTraineePrograms,
  createTraineeProgram,
  updateTraineeProgram,
  deleteTraineeProgram,
} from "../../services/coachAPI";

// ─── display helpers ──────────────────────────────────────────────────────────

const calculateProgress = (current, goal) =>
  goal ? Math.min((current / goal) * 100, 100) : 0;

const formatTimeAgo = (date) => {
  const diffMs  = Date.now() - new Date(date);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffHr  < 24)  return `${diffHr}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay <   7) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString();
};

// ─── normalizers ─────────────────────────────────────────────────────────────

const normalizeTrainee = (customer) => {
  const name = customer.name || customer.full_name || customer.fullName || customer.email?.split("@")[0] || "Unknown";
  const goals = customer.nutrition_goals;
  return {
    id:                 customer.id,
    userId:             customer.userId ?? customer.user_id ?? null,
    name,
    email:              customer.email || "",
    phone:              customer.phone || "",
    weight:             customer.weight ?? null,
    height:             customer.height ?? null,
    age:                customer.age    ?? null,
    goal:               customer.goal   || "General Fitness",
    gender:             customer.gender || "",
    joinedDate:         customer.joined_date || "",
    avatar:             name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2),
    avatarUrl:          customer.avatar_url || customer.avatarUrl || null,
    nutritionGoals:     goals
      ? { calories: goals.calories ?? 0, protein: goals.protein ?? 0,
          carbs: goals.carbs ?? 0, fats: goals.fats ?? 0, notes: goals.notes || "" }
      : { calories: null, protein: null, carbs: null, fats: null, notes: "" },
    mealHistory:        [],
    todayNutrition:     { calories: 0, protein: 0, carbs: 0, fats: 0 },
    subscriptionStatus: customer.subscription_status || "none",
    subscriptionEnd:    customer.subscription_end    || "",
    plan:               customer.plan_name           || "",
  };
};

const normalizeMealLog = (entry, idx) => ({
  id:       entry.id || idx,
  loggedAt: entry.logged_at || entry.created_at,
  servings: entry.servings  || 1,
  meal: {
    id:       entry.meal?.id       || entry.meal_id,
    name:     entry.meal?.name     || entry.meal_name  || "Meal",
    type:     entry.meal?.meal_type || entry.meal_type  || "other",
    calories: entry.meal?.calories || entry.calories   || 0,
    protein:  entry.meal?.protein  || entry.protein    || 0,
    carbs:    entry.meal?.carbs    || entry.carbs       || 0,
    fats:     entry.meal?.fats     || entry.fats        || 0,
    image:    entry.meal?.image_url || "",
  },
});

// ─── form defaults ────────────────────────────────────────────────────────────

const EMPTY_NUTRITION_FORM = { calories: "", protein: "", carbs: "", fats: "", notes: "" };

const DAYS_OF_WEEK = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const toEmbedUrl = (url) => {
  if (!url) return url;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url;
};

const makeDefaultWeek = (weekNum) => ({
  week: weekNum,
  days: DAYS_OF_WEEK.map((day) => ({
    day,
    focus: ["Saturday","Sunday"].includes(day) ? "Rest Day" : "",
    duration: "45 min",
    exercises: [],
  })),
});

// ─── component ───────────────────────────────────────────────────────────────

export default function Users() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getOrCreateConversation, setActiveConversationId } = useChat();
  const restoredRef = useRef(false); // prevent double-restore
  const [messagingTrainee, setMessagingTrainee] = useState(null);

  const [trainees,        setTrainees]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);

  const [selectedTrainee, setSelectedTrainee] = useState(null);
  const [detailLoading,   setDetailLoading]   = useState(false);

  const [activeTab,       setActiveTab]       = useState("overview");
  const [searchQuery,     setSearchQuery]     = useState("");
  const [filterStatus,    setFilterStatus]    = useState("all");

  const [showNutritionModal, setShowNutritionModal] = useState(false);
  const [saving,             setSaving]             = useState(false);
  const [nutritionForm, setNutritionForm] = useState(EMPTY_NUTRITION_FORM);

  // Program state
  const [traineePrograms,   setTraineePrograms]   = useState([]);
  const [programLoading,    setProgramLoading]    = useState(false);
  const [selectedProgram,   setSelectedProgram]   = useState(null); // program being viewed/edited
  const [editingProgram,    setEditingProgram]    = useState(false);
  const [selectedWeek,      setSelectedWeek]      = useState(0);
  const [collapsedDays,     setCollapsedDays]     = useState({});
  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [videoModal,        setVideoModal]        = useState(null); // { url, title }
  const [programForm,       setProgramForm]       = useState({
    name: "", description: "", category: "general-fitness",
    difficulty: "intermediate", duration_weeks: 4, sessions_per_week: 5,
    workouts: [makeDefaultWeek(1)],
  });

  // ── load trainee list ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const raw = await fetchMyTrainees();
        console.log("✅ Trainees loaded:", raw);
        if (!cancelled) {
          const list = raw.map(normalizeTrainee);
          setTrainees(list);
          // Background-load stats for all trainee cards
          list.forEach((t) => enrichTraineeSilent(t));
          // Restore selected trainee from URL on refresh
          const paramId = searchParams.get("t");
          if (paramId && !restoredRef.current) {
            restoredRef.current = true;
            const found = list.find((t) => String(t.id) === String(paramId));
            if (found) {
              const paramTab = searchParams.get("tab") || "overview";
              setActiveTab(paramTab);
              setSelectedTrainee(found);
              loadTraineeDetail(found);
              loadTraineePrograms(found.id);
            }
          }
        }
      } catch (e) {
        console.error("❌ Failed to load trainees:", e);
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── silently enrich a single trainee (no detailLoading spinner) ────────────
  const enrichTraineeSilent = useCallback(async (trainee) => {
    try {
      const [goalsResult, mealsResult] = await Promise.allSettled([
        fetchNutritionGoals(trainee.id),
        fetchMealHistory(trainee.id),
      ]);
      const g = goalsResult.status === "fulfilled" && goalsResult.value ? goalsResult.value : null;
      const FITNESS_GOALS = ["weight-loss", "muscle-gain", "maintenance", "endurance", "flexibility", "general fitness"];
      const nutritionGoals = g
        ? { calories: g.calories ?? null, protein: g.protein ?? null, carbs: g.carbs ?? null, fats: g.fats ?? null,
            notes: g.notes && !FITNESS_GOALS.includes(g.notes.toLowerCase().trim()) ? g.notes : "" }
        : trainee.nutritionGoals;
      const rawMeals = mealsResult.status === "fulfilled" ? mealsResult.value : null;
      const mealHistory = Array.isArray(rawMeals) ? rawMeals.map(normalizeMealLog)
        : Array.isArray(rawMeals?.items) ? rawMeals.items.map(normalizeMealLog)
        : Array.isArray(rawMeals?.logs)  ? rawMeals.logs.map(normalizeMealLog)
        : [];
      const todayStr = new Date().toDateString();
      const todayNutrition = mealHistory
        .filter((e) => new Date(e.loggedAt).toDateString() === todayStr)
        .reduce((acc, e) => ({
          calories: acc.calories + e.meal.calories * e.servings,
          protein:  acc.protein  + e.meal.protein  * e.servings,
          carbs:    acc.carbs    + e.meal.carbs     * e.servings,
          fats:     acc.fats     + e.meal.fats      * e.servings,
        }), { calories: 0, protein: 0, carbs: 0, fats: 0 });
      const enriched = { ...trainee, nutritionGoals, mealHistory, todayNutrition, detailLoaded: true };
      setTrainees((prev) => prev.map((t) => (t.id === trainee.id ? enriched : t)));
    } catch (e) {
      // silent — don't break the list
    }
  }, []);

  // ── load detail when trainee selected ──────────────────────────────────────
  const loadTraineeDetail = useCallback(async (trainee) => {
    setDetailLoading(true);
    try {
      const [detailsResult, goalsResult, mealsResult] = await Promise.allSettled([
        fetchTraineeDetails(trainee.id),
        fetchNutritionGoals(trainee.id),
        fetchMealHistory(trainee.id),
      ]);

      if (detailsResult.status  === "rejected") console.warn("⚠️ Trainee details failed:",  detailsResult.reason);
      if (goalsResult.status    === "rejected") console.warn("⚠️ Nutrition goals failed:", goalsResult.reason);
      if (mealsResult.status    === "rejected") console.warn("⚠️ Meal history failed:",    mealsResult.reason);

      if (detailsResult.status === "fulfilled" && detailsResult.value) {
        const d = detailsResult.value;
        let age = d.age ?? trainee.age;
        if (!age && (d.date_of_birth || d.dateOfBirth)) {
          const dob = new Date(d.date_of_birth || d.dateOfBirth);
          const diff = Date.now() - dob.getTime();
          age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
          if (isNaN(age) || age <= 0) age = null;
        }
        trainee = {
          ...trainee,
          weight: d.weight ?? d.current_weight ?? d.body_weight ?? trainee.weight,
          height: d.height ?? d.body_height    ?? trainee.height,
          age:    age      ?? null,
          phone:  d.phone  ?? trainee.phone,
          gender: d.gender ?? trainee.gender,
          name:   d.full_name || d.name || trainee.name,
          dateOfBirth: d.date_of_birth || d.dateOfBirth || trainee.dateOfBirth,
          userId: d.userId ?? d.user_id ?? trainee.userId,
        };
      }

      let nutritionGoals = trainee.nutritionGoals;
      if (goalsResult.status === "fulfilled" && goalsResult.value) {
        const g = goalsResult.value;
        const FITNESS_GOALS = ["weight-loss", "muscle-gain", "maintenance", "endurance", "flexibility", "general fitness"];
        const rawNotes = g.notes || "";
        const notes = FITNESS_GOALS.includes(rawNotes.toLowerCase().trim()) ? "" : rawNotes;
        nutritionGoals = { calories: g.calories ?? null, protein: g.protein ?? null, carbs: g.carbs ?? null, fats: g.fats ?? null, notes };
      }

      const rawMeals = mealsResult.status === "fulfilled" ? mealsResult.value : null;
      const mealHistory = Array.isArray(rawMeals)
        ? rawMeals.map(normalizeMealLog)
        : Array.isArray(rawMeals?.items) ? rawMeals.items.map(normalizeMealLog)
        : Array.isArray(rawMeals?.logs)  ? rawMeals.logs.map(normalizeMealLog)
        : [];

      const todayStr = new Date().toDateString();
      const todayNutrition = mealHistory
        .filter((e) => new Date(e.loggedAt).toDateString() === todayStr)
        .reduce(
          (acc, e) => ({
            calories: acc.calories + e.meal.calories * e.servings,
            protein:  acc.protein  + e.meal.protein  * e.servings,
            carbs:    acc.carbs    + e.meal.carbs     * e.servings,
            fats:     acc.fats     + e.meal.fats      * e.servings,
          }),
          { calories: 0, protein: 0, carbs: 0, fats: 0 }
        );

      const enriched = { ...trainee, nutritionGoals, mealHistory, todayNutrition, detailLoaded: true };
      setSelectedTrainee(enriched);
      setTrainees((prev) => prev.map((t) => (t.id === trainee.id ? enriched : t)));
    } catch (e) {
      console.error("❌ loadTraineeDetail error:", e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadTraineePrograms = useCallback(async (traineeId) => {
    setProgramLoading(true);
    try {
      const programs = await fetchTraineePrograms(traineeId);
      const list = Array.isArray(programs) ? programs : [];
      setTraineePrograms(list);
      setSelectedProgram(null); // user must click a card to open
      setSelectedWeek(0);
    } catch (e) {
      console.warn("⚠️ Failed to load trainee programs:", e.message);
      setTraineePrograms([]);
      setSelectedProgram(null);
    } finally {
      setProgramLoading(false);
    }
  }, []);

  // ── message handler ───────────────────────────────────────────────────────────

  const handleMessageTrainee = useCallback(async (trainee) => {
    if (!trainee.userId) return;
    setMessagingTrainee(trainee.id);
    try {
      const convId = await getOrCreateConversation(trainee.userId);
      if (convId) {
        setActiveConversationId(convId);
        navigate('/coach/chat');
      }
    } finally {
      setMessagingTrainee(null);
    }
  }, [getOrCreateConversation, navigate]);

  // ── handlers ─────────────────────────────────────────────────────────────────

  const handleViewTrainee = useCallback((trainee) => {
    setActiveTab("overview");
    setSelectedTrainee(trainee);
    setTraineePrograms([]);
    setSelectedProgram(null);
    setEditingProgram(false);
    setShowCreateProgram(false);
    setSearchParams({ t: trainee.id });
    loadTraineeDetail(trainee);
    loadTraineePrograms(trainee.id);
  }, [loadTraineeDetail, loadTraineePrograms, setSearchParams]);

  const handleBack = () => {
    setSelectedTrainee(null);
    setSearchParams({});
  };

  const openNutritionModal = () => {
    if (!selectedTrainee) return;
    const g = selectedTrainee.nutritionGoals;
    setNutritionForm({
      calories: g.calories ?? "",
      protein:  g.protein  ?? "",
      carbs:    g.carbs    ?? "",
      fats:     g.fats     ?? "",
      notes:    g.notes    || "",
    });
    setShowNutritionModal(true);
  };

  const handleUpdateNutrition = async () => {
    if (!selectedTrainee) return;
    setSaving(true);
    try {
      await updateNutritionGoals(selectedTrainee.id, nutritionForm);
      const updated = {
        ...selectedTrainee,
        nutritionGoals: {
          calories: nutritionForm.calories !== "" ? Number(nutritionForm.calories) : null,
          protein:  nutritionForm.protein  !== "" ? Number(nutritionForm.protein)  : null,
          carbs:    nutritionForm.carbs    !== "" ? Number(nutritionForm.carbs)    : null,
          fats:     nutritionForm.fats     !== "" ? Number(nutritionForm.fats)     : null,
          notes:    nutritionForm.notes,
        },
      };
      setSelectedTrainee(updated);
      setTrainees((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setShowNutritionModal(false);
    } catch (e) {
      alert("Failed to update nutrition goals: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── program handlers ─────────────────────────────────────────────────────────

  const handleCreateProgram = async () => {
    if (!selectedTrainee || !programForm.name.trim()) {
      alert("Please enter a program name"); return;
    }
    setSaving(true);
    try {
      const created = await createTraineeProgram(selectedTrainee.id, {
        name: programForm.name,
        description: programForm.description,
        category: programForm.category,
        difficulty: programForm.difficulty,
        duration_weeks: programForm.workouts.length,
        sessions_per_week: programForm.sessions_per_week,
        workouts: programForm.workouts,
        is_active: true,
      });
      setTraineePrograms((prev) => [created, ...prev]);
      setSelectedProgram(created);
      setSelectedWeek(0);
      setShowCreateProgram(false);
      setProgramForm({ name: "", description: "", category: "general-fitness", difficulty: "intermediate", duration_weeks: 4, sessions_per_week: 5, workouts: [makeDefaultWeek(1)] });
    } catch (e) {
      alert("Failed to create program: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProgram = async () => {
    if (!selectedProgram) return;
    setSaving(true);
    try {
      const updated = await updateTraineeProgram(selectedProgram.id, {
        name: selectedProgram.name,
        description: selectedProgram.description,
        category: selectedProgram.category,
        difficulty: selectedProgram.difficulty,
        duration_weeks: selectedProgram.workouts.length,
        sessions_per_week: selectedProgram.sessionsPerWeek,
        workouts: selectedProgram.workouts,
      });
      setSelectedProgram(updated);
      setTraineePrograms((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingProgram(false);
    } catch (e) {
      alert("Failed to save program: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProgram = async (programId) => {
    if (!window.confirm("Delete this program? This cannot be undone.")) return;
    try {
      await deleteTraineeProgram(programId);
      const remaining = traineePrograms.filter((p) => p.id !== programId);
      setTraineePrograms(remaining);
      setSelectedProgram(remaining[0] || null);
      setSelectedWeek(0);
    } catch (e) {
      alert("Failed to delete program: " + e.message);
    }
  };

  // Update a day's exercises in the currently selected program
  const updateProgramDay = (weekIdx, dayIdx, field, value) => {
    setSelectedProgram((prev) => {
      if (!prev) return prev;
      const workouts = prev.workouts.map((w, wi) => {
        if (wi !== weekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, di) => di === dayIdx ? { ...d, [field]: value } : d),
        };
      });
      return { ...prev, workouts };
    });
  };

  const addExerciseToProgramDay = (weekIdx, dayIdx) => {
    setSelectedProgram((prev) => {
      if (!prev) return prev;
      const workouts = prev.workouts.map((w, wi) => {
        if (wi !== weekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, di) => {
            if (di !== dayIdx) return d;
            return { ...d, exercises: [...(d.exercises || []), { name: "", sets: 3, reps: "10", weight: "", rest: "", notes: "", video_url: "" }] };
          }),
        };
      });
      return { ...prev, workouts };
    });
  };

  const updateExerciseInProgramDay = (weekIdx, dayIdx, exIdx, field, value) => {
    setSelectedProgram((prev) => {
      if (!prev) return prev;
      const workouts = prev.workouts.map((w, wi) => {
        if (wi !== weekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, di) => {
            if (di !== dayIdx) return d;
            const exercises = d.exercises.map((ex, ei) =>
              ei === exIdx ? { ...ex, [field]: value } : ex
            );
            return { ...d, exercises };
          }),
        };
      });
      return { ...prev, workouts };
    });
  };

  const removeExerciseFromProgramDay = (weekIdx, dayIdx, exIdx) => {
    setSelectedProgram((prev) => {
      if (!prev) return prev;
      const workouts = prev.workouts.map((w, wi) => {
        if (wi !== weekIdx) return w;
        return {
          ...w,
          days: w.days.map((d, di) => {
            if (di !== dayIdx) return d;
            return { ...d, exercises: d.exercises.filter((_, i) => i !== exIdx) };
          }),
        };
      });
      return { ...prev, workouts };
    });
  };

  const addWeekToProgram = () => {
    setSelectedProgram((prev) => {
      if (!prev) return prev;
      const nextWeek = (prev.workouts?.length || 0) + 1;
      return { ...prev, workouts: [...(prev.workouts || []), makeDefaultWeek(nextWeek)] };
    });
  };

  // ── filtered list ─────────────────────────────────────────────────────────

  const filteredTrainees = trainees.filter((t) => {
    const q = searchQuery.toLowerCase();
    const matchSearch = t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || t.subscriptionStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  // ── loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading trainees…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 font-semibold mb-2">Failed to load trainees</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {!selectedTrainee ? (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Trainees</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {trainees.length} trainee{trainees.length !== 1 ? "s" : ""} · Monitor meals, nutrition &amp; workouts
              </p>
            </div>
          </div>

          {/* Search + Filter bar */}
          <div className="flex gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {filteredTrainees.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
              <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {searchQuery ? `No trainees match "${searchQuery}"` : "No trainees found"}
              </p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                {searchQuery ? "Try a different search term" : "Trainees appear here once they book a session with you."}
              </p>
            </div>
          ) : (
        /* ── Trainee Grid ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrainees.map((trainee) => {
            const dataLoaded = trainee.detailLoaded === true;
            const todayMeals = dataLoaded
              ? trainee.mealHistory.filter(
                  (m) => new Date(m.loggedAt).toDateString() === new Date().toDateString()
                ).length
              : null;
            const calGoal = trainee.nutritionGoals.calories;

            return (
              <div
                key={trainee.id}
                onClick={() => handleViewTrainee(trainee)}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {trainee.avatarUrl ? (
                        <img src={trainee.avatarUrl} alt={trainee.name} className="w-14 h-14 rounded-full object-cover shadow-lg" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold shadow-lg">
                          {trainee.avatar}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{trainee.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{trainee.goal}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      trainee.subscriptionStatus === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                    }`}>
                      {trainee.subscriptionStatus === "active" ? "Active" : trainee.subscriptionStatus}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {trainee.plan ? "Active" : "—"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Plan</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        {todayMeals !== null ? todayMeals : "—"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Meals Today</p>
                    </div>
                  </div>

                  {/* Today calorie progress */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">TODAY'S CALORIES</p>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 dark:text-gray-400">Calories</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {dataLoaded ? trainee.todayNutrition.calories : "—"} / {calGoal !== null && calGoal !== undefined ? calGoal : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: dataLoaded ? `${calculateProgress(trainee.todayNutrition.calories, calGoal)}%` : "0%" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
          )}
        </>
      ) : (
        /* ── Trainee Detail ── */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Trainees
            </button>
            <div className="flex gap-2">
              {selectedTrainee.userId && (
                <button
                  onClick={() => handleMessageTrainee(selectedTrainee)}
                  disabled={messagingTrainee === selectedTrainee.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
                >
                  {messagingTrainee === selectedTrainee.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  )}
                  Message
                </button>
              )}
              <button onClick={openNutritionModal} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Update Nutrition Goals
              </button>
            </div>
          </div>

          {detailLoading && (
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Loading details…
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Banner */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-4">
                {selectedTrainee.avatarUrl ? (
                  <img src={selectedTrainee.avatarUrl} alt={selectedTrainee.name} className="w-20 h-20 rounded-full object-cover border-2 border-white/40" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold">
                    {selectedTrainee.avatar}
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold">{selectedTrainee.name}</h2>
                  <p className="text-blue-100">{selectedTrainee.email}</p>
                  <p className="text-sm text-blue-100 mt-1">Goal: {selectedTrainee.goal}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <div className="flex overflow-x-auto">
                {["overview", "meals", "program", "profile"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); if (selectedTrainee) setSearchParams({ t: selectedTrainee.id, tab }); }}
                    className={`px-6 py-4 font-medium whitespace-nowrap transition-all ${
                      activeTab === tab
                        ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">

              {/* ── OVERVIEW ── */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Overview</h3>

                  {/* Physical stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Weight", value: selectedTrainee.weight != null ? `${selectedTrainee.weight} kg` : "—", icon: "⚖️" },
                      { label: "Height", value: selectedTrainee.height != null ? `${selectedTrainee.height} cm` : "—", icon: "📏" },
                      { label: "Age",    value: selectedTrainee.age    != null ? `${selectedTrainee.age} yrs`   : "—", icon: "🎂" },
                      { label: "Goal",   value: selectedTrainee.goal || "—",                                         icon: "🎯" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                        <p className="text-lg mb-1">{stat.icon}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">{stat.label}</p>
                        <p className="font-bold text-gray-900 dark:text-white mt-0.5 truncate">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Nutrition Goals — goals + today progress side by side */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Nutrition Goals</h4>
                      <div className="flex items-center gap-3">
                        {!selectedTrainee.detailLoaded && <span className="text-xs text-gray-400">Loading…</span>}
                        <button
                          onClick={() => setShowNutritionModal(true)}
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                        >
                          Edit →
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      {!selectedTrainee.detailLoaded ? (
                        <div className="space-y-3">
                          {["Calories","Protein","Carbs","Fats"].map((label) => (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                                <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                              </div>
                              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse w-1/3" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : Object.values(selectedTrainee.nutritionGoals).every((v) => v === null || v === "") ? (
                        <p className="text-sm text-gray-400 text-center py-4">No nutrition goals set yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {[
                            { key: "calories", label: "Calories", bar: "bg-orange-500", unit: ""  },
                            { key: "protein",  label: "Protein",  bar: "bg-blue-500",   unit: "g" },
                            { key: "carbs",    label: "Carbs",    bar: "bg-green-500",  unit: "g" },
                            { key: "fats",     label: "Fats",     bar: "bg-yellow-400", unit: "g" },
                          ].map(({ key, label, bar, unit }) => {
                            const goal  = selectedTrainee.nutritionGoals[key];
                            const eaten = Math.round(selectedTrainee.todayNutrition[key] || 0);
                            const pct   = calculateProgress(eaten, goal);
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-gray-500 dark:text-gray-400">{label}</span>
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {eaten}{unit}
                                    {goal != null ? <span className="text-gray-400 font-normal"> / {goal}{unit}</span> : ""}
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className={`h-full ${bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                          {selectedTrainee.nutritionGoals.notes && (
                            <p className="text-xs text-gray-400 italic pt-1">"{selectedTrainee.nutritionGoals.notes}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Training Program Summary */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                      <h4 className="font-bold text-gray-900 dark:text-white">Training Program</h4>
                      <button onClick={() => setActiveTab("program")} className="text-xs text-orange-600 hover:text-orange-700 font-medium">
                        {traineePrograms.length > 0 ? "Manage →" : "Create →"}
                      </button>
                    </div>

                    {programLoading ? (
                      <div className="px-5 py-6 flex items-center gap-2 text-gray-400 text-sm">
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
                        Loading…
                      </div>
                    ) : traineePrograms.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <p className="text-sm text-gray-400 dark:text-gray-500">No program assigned yet.</p>
                      </div>
                    ) : (
                      <div className="p-4 flex flex-wrap gap-2">
                        {traineePrograms.map((prog) => {
                          const totalEx = (prog.workouts || []).reduce((s, w) =>
                            s + (w.days || []).reduce((ds, d) => ds + (d.exercises?.length || 0), 0), 0);
                          return (
                            <button
                              key={prog.id}
                              onClick={() => { setActiveTab("program"); setSelectedProgram(prog); setSelectedWeek(0); setEditingProgram(false); setShowCreateProgram(false); }}
                              className="w-36 h-36 text-left p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-orange-400 dark:hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between group"
                            >
                              <div>
                                <p className="font-semibold text-xs leading-tight line-clamp-2 text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                                  {prog.name}
                                </p>
                                <span className="inline-block mt-1 text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1 py-0.5 rounded capitalize leading-none">
                                  {prog.difficulty || "intermediate"}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1">
                                  {prog.workouts?.length || 0} wks · {totalEx} ex
                                </p>
                                {prog.workouts?.length > 0 && (
                                  <div className="flex gap-px">
                                    {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((full) => {
                                      const dayData = prog.workouts[0].days?.find((x) => x.day === full);
                                      const active = dayData && !dayData.focus?.toLowerCase().includes("rest") && (dayData.exercises?.length > 0 || dayData.focus);
                                      return <div key={full} className={`flex-1 h-1 rounded-full ${active ? "bg-orange-400" : "bg-gray-200 dark:bg-gray-600"}`} />;
                                    })}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── MEALS ── */}
              {activeTab === "meals" && (
                <div className="space-y-5">

                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Nutrition & Meals</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                        {selectedTrainee.mealHistory.length > 0 && ` · ${selectedTrainee.mealHistory.length} meals logged`}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowNutritionModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Set Goals
                    </button>
                  </div>

                  {/* 4 Macro stat boxes */}
                  {(() => {
                    const macros = [
                      { key: "calories", label: "Calories", unit: "kcal", barColor: "bg-orange-500", boxBg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-100 dark:border-orange-800/30", text: "text-orange-600 dark:text-orange-400", icon: "🔥" },
                      { key: "protein",  label: "Protein",  unit: "g",    barColor: "bg-blue-500",   boxBg: "bg-blue-50 dark:bg-blue-900/20",     border: "border-blue-100 dark:border-blue-800/30",     text: "text-blue-600 dark:text-blue-400",   icon: "💪" },
                      { key: "carbs",    label: "Carbs",    unit: "g",    barColor: "bg-green-500",  boxBg: "bg-green-50 dark:bg-green-900/20",   border: "border-green-100 dark:border-green-800/30",   text: "text-green-600 dark:text-green-400", icon: "🌾" },
                      { key: "fats",     label: "Fats",     unit: "g",    barColor: "bg-yellow-400", boxBg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-100 dark:border-yellow-800/30", text: "text-yellow-600 dark:text-yellow-500", icon: "🫒" },
                    ];
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {macros.map(({ key, label, unit, barColor, boxBg, border, text, icon }) => {
                          const eaten  = Math.round(selectedTrainee.todayNutrition[key]);
                          const goal   = selectedTrainee.nutritionGoals[key];
                          const pct    = goal ? Math.min((eaten / goal) * 100, 100) : 0;
                          const isOver = goal && eaten > goal;
                          return (
                            <div key={key} className={`${boxBg} rounded-2xl p-4 border ${border}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-lg">{icon}</span>
                                {goal ? (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isOver ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" : `${boxBg} ${text}`
                                  }`}>
                                    {Math.round(pct)}%
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500">no goal</span>
                                )}
                              </div>
                              <p className={`text-2xl font-black ${text}`}>{eaten}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {label}{goal ? ` / ${goal}${unit}` : ` ${unit}`}
                              </p>
                              {goal && (
                                <div className="mt-2.5 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : barColor}`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Coach notes */}
                  {selectedTrainee.nutritionGoals.notes && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-2xl p-4 flex items-start gap-3">
                      <span className="text-xl shrink-0">📋</span>
                      <div>
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wide">Nutrition Notes</p>
                        <p className="text-sm text-amber-900 dark:text-amber-300 leading-relaxed">{selectedTrainee.nutritionGoals.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Meal history */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-900 dark:text-white">Meal History</h4>
                      {selectedTrainee.mealHistory.length > 0 && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">{selectedTrainee.mealHistory.length} entries</span>
                      )}
                    </div>
                    {selectedTrainee.mealHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 gap-3">
                        <div className="w-14 h-14 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center text-2xl">🍽️</div>
                        <div className="text-center">
                          <p className="font-semibold text-gray-500 dark:text-gray-400">No meals logged yet</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">This trainee hasn't logged any meals</p>
                        </div>
                      </div>
                    ) : (
                      /* Scrollable grouped history */
                      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="max-h-[480px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                          {(() => {
                            const groups = {};
                            selectedTrainee.mealHistory.forEach((entry) => {
                              const d   = new Date(entry.loggedAt);
                              const tod = new Date();
                              const yes = new Date(tod); yes.setDate(tod.getDate() - 1);
                              let lbl;
                              if (d.toDateString() === tod.toDateString()) lbl = "Today";
                              else if (d.toDateString() === yes.toDateString()) lbl = "Yesterday";
                              else lbl = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                              if (!groups[lbl]) groups[lbl] = { lbl, entries: [], totalCal: 0 };
                              groups[lbl].entries.push(entry);
                              groups[lbl].totalCal += Math.round(entry.meal.calories * entry.servings);
                            });
                            const mealEmoji = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎", other: "🍽️" };
                            return Object.values(groups).map(({ lbl, entries, totalCal }) => (
                              <div key={lbl}>
                                {/* Sticky date header */}
                                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{lbl}</p>
                                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                    {totalCal} kcal
                                  </span>
                                </div>
                                {/* Compact meal rows */}
                                {entries.map((entry) => {
                                  const cal  = Math.round(entry.meal.calories * entry.servings);
                                  const pro  = Math.round(entry.meal.protein  * entry.servings);
                                  const carb = Math.round(entry.meal.carbs    * entry.servings);
                                  const fat  = Math.round(entry.meal.fats     * entry.servings);
                                  const emoji = mealEmoji[entry.meal.type?.toLowerCase()] || "🍽️";
                                  return (
                                    <div key={entry.id}
                                      className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                      {/* Icon */}
                                      {entry.meal.image ? (
                                        <img src={entry.meal.image} alt={entry.meal.name}
                                          className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                      ) : (
                                        <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-base shrink-0">
                                          {emoji}
                                        </div>
                                      )}
                                      {/* Name */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{entry.meal.name}</p>
                                          {entry.servings > 1 && (
                                            <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full shrink-0">×{entry.servings}</span>
                                          )}
                                        </div>
                                        {/* Inline macro pills */}
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{cal} kcal</span>
                                          <span className="text-[11px] text-gray-400 dark:text-gray-500">P {pro}g · C {carb}g · F {fat}g</span>
                                        </div>
                                      </div>
                                      {/* Time */}
                                      <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{formatTimeAgo(entry.loggedAt)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PROGRAM ── */}
              {activeTab === "program" && (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Training Program</h3>

                  {programLoading && (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Loading programs…
                    </div>
                  )}

                  {/* Create Program Form */}
                  {showCreateProgram && (
                    <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6 space-y-4">
                      <h4 className="font-bold text-gray-900 dark:text-white">Create New Program</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Program Name *</label>
                          <input
                            type="text"
                            value={programForm.name}
                            onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                            placeholder="e.g. 4-Week Strength Builder"
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                          <textarea
                            value={programForm.description}
                            onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                            rows={2}
                            placeholder="Program overview…"
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                          <select
                            value={programForm.category}
                            onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          >
                            {["general-fitness","weight-loss","muscle-gain","strength","endurance","flexibility"].map((c) => (
                              <option key={c} value={c}>{c.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
                          <select
                            value={programForm.difficulty}
                            onChange={(e) => setProgramForm({ ...programForm, difficulty: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (weeks)</label>
                          <input
                            type="number" min={1} max={52}
                            value={programForm.workouts.length}
                            onChange={(e) => {
                              const n = Math.max(1, parseInt(e.target.value) || 1);
                              const cur = programForm.workouts;
                              const updated = n > cur.length
                                ? [...cur, ...Array.from({ length: n - cur.length }, (_, i) => makeDefaultWeek(cur.length + i + 1))]
                                : cur.slice(0, n);
                              setProgramForm({ ...programForm, workouts: updated });
                            }}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions / week</label>
                          <input
                            type="number" min={1} max={7}
                            value={programForm.sessions_per_week}
                            onChange={(e) => setProgramForm({ ...programForm, sessions_per_week: parseInt(e.target.value) || 5 })}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setShowCreateProgram(false)}
                          className="flex-1 py-2 border rounded-lg dark:border-gray-500 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600"
                        >Cancel</button>
                        <button
                          onClick={handleCreateProgram}
                          disabled={saving}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? "Creating…" : "Create Program"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Program List */}
                  {!programLoading && (
                    <div className="space-y-2">
                      {traineePrograms.map((prog) => {
                        const isActive = selectedProgram?.id === prog.id && !showCreateProgram;
                        const totalEx  = (prog.workouts || []).reduce((s, w) =>
                          s + (w.days || []).reduce((ds, d) => ds + (d.exercises?.length || 0), 0), 0);
                        const diffColor = {
                          beginner:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                          intermediate: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          advanced:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                        }[prog.difficulty?.toLowerCase()] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
                        return (
                          <button
                            key={prog.id}
                            onClick={() => { setSelectedProgram(prog); setSelectedWeek(0); setEditingProgram(false); setShowCreateProgram(false); }}
                            className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-4 ${
                              isActive
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm"
                            }`}
                          >
                            {/* Left icon */}
                            <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center bg-gradient-to-br ${isActive ? "from-blue-500 to-purple-600" : "from-blue-600 to-purple-600"}`}>
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>

                            {/* Middle: name + meta */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm truncate ${isActive ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white"}`}>
                                {prog.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${diffColor}`}>
                                  {prog.difficulty || "intermediate"}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                                  {prog.category?.replace(/-/g, " ") || "general"}
                                </span>
                              </div>
                              {prog.workouts?.length > 0 && (
                                <div className="flex gap-px mt-2">
                                  {["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].map((full) => {
                                    const dayData = prog.workouts[0].days?.find((x) => x.day === full);
                                    const act = dayData && !dayData.focus?.toLowerCase().includes("rest") && (dayData.exercises?.length > 0 || dayData.focus);
                                    return <div key={full} className={`flex-1 h-1.5 rounded-full ${act ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-600"}`} />;
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Right: stats + chevron */}
                            <div className="shrink-0 text-right">
                              <p className={`text-sm font-bold ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                                {prog.workouts?.length || 0} <span className="font-normal text-gray-400 text-xs">wks</span>
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{totalEx} exercises</p>
                              <svg className={`w-4 h-4 mt-1 ml-auto ${isActive ? "text-blue-500" : "text-gray-300 dark:text-gray-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        );
                      })}

                      {/* + New Program row */}
                      <button
                        onClick={() => { setShowCreateProgram(true); setSelectedProgram(null); setEditingProgram(false); }}
                        className={`w-full px-4 py-3.5 rounded-xl border-2 border-dashed transition-all flex items-center gap-4 ${
                          showCreateProgram
                            ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500"
                        }`}
                      >
                        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-xl font-light ${showCreateProgram ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-400"}`}>+</div>
                        <span className={`font-semibold text-sm ${showCreateProgram ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
                          New Program
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Selected Program View */}
                  {selectedProgram && !showCreateProgram && (
                    <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">

                      {/* ── Program Header ── */}
                      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Accent bar */}
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 to-purple-600" />
                        <div className="p-5 flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">{selectedProgram.name}</h4>
                            {selectedProgram.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedProgram.description}</p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-3">
                              <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full capitalize">
                                {selectedProgram.category?.replace(/-/g, " ") || "general"}
                              </span>
                              <span className="px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full capitalize">
                                {selectedProgram.difficulty || "intermediate"}
                              </span>
                              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                                {selectedProgram.workouts?.length || 0} weeks
                              </span>
                              <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                                {selectedProgram.sessionsPerWeek || "—"} sessions/wk
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {editingProgram ? (
                              <>
                                <button onClick={handleSaveProgram} disabled={saving}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition">
                                  {saving ? "Saving…" : "Save changes"}
                                </button>
                                <button onClick={() => { setEditingProgram(false); loadTraineePrograms(selectedTrainee.id); }}
                                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm transition">
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => setEditingProgram(true)}
                                  className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-sm font-medium transition">
                                  Edit
                                </button>
                                <button onClick={() => handleDeleteProgram(selectedProgram.id)}
                                  className="px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl text-sm transition">
                                  Delete
                                </button>
                                <button onClick={() => { setSelectedProgram(null); setEditingProgram(false); }}
                                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── Quick Stats ── */}
                      {(() => {
                        const totalEx = (selectedProgram.workouts || []).reduce((s, w) =>
                          s + (w.days || []).reduce((ds, d) => ds + (d.exercises?.length || 0), 0), 0);
                        const activeDays = (selectedProgram.workouts?.[0]?.days || []).filter(d =>
                          !d.focus?.toLowerCase().includes("rest")).length;
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                              { label: "Weeks",       value: selectedProgram.workouts?.length || 0,         color: "blue"   },
                              { label: "Sessions/wk", value: selectedProgram.sessionsPerWeek || "—",        color: "purple" },
                              { label: "Active days", value: activeDays,                                    color: "green"  },
                              { label: "Exercises",   value: totalEx,                                       color: "orange" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-2xl p-4 text-center border border-${color}-100 dark:border-${color}-800/30`}>
                                <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}

                      {/* ── Week Tabs ── */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {(selectedProgram.workouts || []).map((week, wi) => (
                          <button key={wi} onClick={() => { setSelectedWeek(wi); setCollapsedDays({}); }}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                              selectedWeek === wi
                                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                            }`}>
                            Week {week.week || wi + 1}
                          </button>
                        ))}
                        {editingProgram && (
                          <button onClick={addWeekToProgram}
                            className="px-5 py-2 rounded-xl text-sm font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition border border-dashed border-green-300 dark:border-green-700">
                            + Add Week
                          </button>
                        )}
                      </div>

                      {/* ── Weekly Activity Strip ── */}
                      {selectedProgram.workouts?.[selectedWeek] && (() => {
                        const days = selectedProgram.workouts[selectedWeek].days;
                        const activeCount = days.filter(d =>
                          !(d.focus?.toLowerCase().includes("rest") || (!d.focus && !d.exercises?.length))
                        ).length;
                        return (
                          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Weekly Schedule</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{activeCount} active · {days.length - activeCount} rest</p>
                            </div>
                            <div className="flex gap-2">
                              {days.map((day, di) => {
                                const isRest = !!day.focus?.toLowerCase().includes("rest");
                                const exCount = day.exercises?.length || 0;
                                return (
                                  <button key={di}
                                    onClick={() => setCollapsedDays(prev => ({ ...prev, [di]: !prev[di] }))}
                                    className="flex-1 flex flex-col items-center gap-1.5 group"
                                    title={day.focus || (isRest ? "Rest Day" : "Training Day")}
                                  >
                                    <div className={`w-full h-2 rounded-full transition-all ${
                                      isRest
                                        ? "bg-gray-200 dark:bg-gray-600"
                                        : "bg-gradient-to-r from-blue-500 to-purple-600"
                                    }`} />
                                    <span className={`text-[10px] font-semibold transition-colors ${
                                      isRest ? "text-gray-400 dark:text-gray-500" : "text-blue-600 dark:text-blue-400"
                                    }`}>{day.day.slice(0, 3)}</span>
                                    {!isRest && exCount > 0 && (
                                      <span className="text-[9px] text-gray-400 dark:text-gray-500">{exCount}ex</span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Days ── */}
                      {selectedProgram.workouts?.[selectedWeek] && (
                        <div className="space-y-2">
                          {/* Expand / Collapse all */}
                          {!editingProgram && (
                            <div className="flex justify-end gap-3 pb-1">
                              <button
                                onClick={() => setCollapsedDays(
                                  Object.fromEntries(selectedProgram.workouts[selectedWeek].days.map((_, i) => [i, true]))
                                )}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                                Collapse all
                              </button>
                              <span className="text-gray-200 dark:text-gray-700">|</span>
                              <button
                                onClick={() => setCollapsedDays({})}
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                                Expand all
                              </button>
                            </div>
                          )}

                          {selectedProgram.workouts[selectedWeek].days.map((day, di) => {
                            const isRest = !!day.focus?.toLowerCase().includes("rest");
                            const exCount = day.exercises?.length || 0;
                            const isCollapsed = collapsedDays[di] ?? false;
                            return (
                              <div key={di} className={`rounded-2xl border overflow-hidden transition-all ${
                                isRest
                                  ? "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40"
                                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
                              }`}>
                                {/* Day Header — clickable to collapse */}
                                <button
                                  type="button"
                                  onClick={() => !isRest && !editingProgram && setCollapsedDays(prev => ({ ...prev, [di]: !prev[di] }))}
                                  className={`w-full px-4 py-3.5 flex items-center gap-3 text-left ${
                                    !isRest
                                      ? "border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
                                      : ""
                                  } ${isCollapsed ? "border-b-0" : ""}`}
                                >
                                  {/* Day icon */}
                                  <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                                    isRest
                                      ? "bg-gray-100 dark:bg-gray-700"
                                      : "bg-gradient-to-br from-blue-500 to-purple-600"
                                  }`}>
                                    {isRest ? (
                                      <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                      </svg>
                                    ) : (
                                      <span className="text-xs font-bold text-white leading-none">{day.day.slice(0, 3)}</span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm text-gray-900 dark:text-white">{day.day}</p>
                                      {isRest && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-full font-medium">Rest</span>
                                      )}
                                    </div>
                                    {editingProgram ? (
                                      !isRest && <input type="text" value={day.focus || ""}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => updateProgramDay(selectedWeek, di, "focus", e.target.value)}
                                        placeholder="e.g. Chest & Triceps"
                                        className="mt-1 w-full px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    ) : (
                                      <p className={`text-xs font-medium mt-0.5 ${isRest ? "text-gray-400 dark:text-gray-500" : "text-blue-600 dark:text-blue-400"}`}>
                                        {isRest ? "Rest & Recovery" : (day.focus || "Training Day")}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Rest ↔ Training toggle (edit mode only) */}
                                    {editingProgram && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateProgramDay(
                                            selectedWeek, di, "focus",
                                            isRest ? "" : "Rest Day"
                                          );
                                        }}
                                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all border ${
                                          isRest
                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-100"
                                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-200"
                                        }`}
                                      >
                                        {isRest ? "➕ Training" : "🌙 Rest"}
                                      </button>
                                    )}
                                    {!isRest && (
                                      <>
                                        {editingProgram ? (
                                          <input type="text" value={day.duration || ""}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => updateProgramDay(selectedWeek, di, "duration", e.target.value)}
                                            placeholder="45 min"
                                            className="w-20 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-center dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                        ) : (
                                          <>
                                            {day.duration && (
                                              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2.5 py-1 rounded-lg font-medium">{day.duration}</span>
                                            )}
                                            <span className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg font-semibold">
                                              {exCount} {exCount === 1 ? "ex" : "exs"}
                                            </span>
                                          </>
                                        )}
                                        {/* Collapse chevron */}
                                        {!editingProgram && (
                                          <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </button>

                                {/* Exercises — hidden when collapsed */}
                                {!isRest && !isCollapsed && (
                                  <div className="px-4 py-3 space-y-2">
                                    {exCount === 0 && !editingProgram && (
                                      <div className="flex flex-col items-center justify-center py-6 gap-2">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                          <svg className="w-5 h-5 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                          </svg>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-gray-500">No exercises added</p>
                                      </div>
                                    )}
                                    {(day.exercises || []).map((ex, ei) => (
                                      <div key={ei}>
                                        {editingProgram ? (
                                          <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl space-y-2 border border-gray-200 dark:border-gray-600">
                                            <div className="flex items-center gap-2">
                                              <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">{ei + 1}</span>
                                              <input type="text" value={ex.name || ""}
                                                onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "name", e.target.value)}
                                                placeholder="Exercise name"
                                                className="flex-1 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              <button onClick={() => removeExerciseFromProgramDay(selectedWeek, di, ei)}
                                                className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                              </button>
                                            </div>
                                            <div className="flex gap-2 flex-wrap pl-8">
                                              <input type="number" value={ex.sets || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "sets", parseInt(e.target.value) || 0)}
                                                placeholder="Sets" className="w-14 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              <span className="text-gray-400 text-xs self-center font-bold">×</span>
                                              <input type="text" value={ex.reps || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "reps", e.target.value)}
                                                placeholder="Reps" className="w-16 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              <input type="text" value={ex.weight || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "weight", e.target.value)}
                                                placeholder="Weight (e.g. 20kg)" className="w-28 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              <input type="text" value={ex.rest || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "rest", e.target.value)}
                                                placeholder="Rest (e.g. 60s)" className="w-24 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                            <div className="flex gap-2 pl-8">
                                              <input type="text" value={ex.notes || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "notes", e.target.value)}
                                                placeholder="Notes (optional)" className="flex-1 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                              <input type="text" value={ex.video_url || ""} onChange={(e) => updateExerciseInProgramDay(selectedWeek, di, ei, "video_url", e.target.value)}
                                                placeholder="Video URL" className="flex-1 px-2 py-1 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs flex items-center justify-center font-bold shrink-0">{ei + 1}</span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ex.name}</p>
                                              {ex.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{ex.notes}</p>}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                                              {ex.sets && ex.reps && (
                                                <span className="text-xs font-bold bg-blue-600 text-white px-2.5 py-1 rounded-lg whitespace-nowrap">
                                                  {ex.sets} × {ex.reps}
                                                </span>
                                              )}
                                              {ex.weight && (
                                                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-lg whitespace-nowrap">{ex.weight}</span>
                                              )}
                                              {ex.rest && (
                                                <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-1 rounded-lg whitespace-nowrap">{ex.rest}</span>
                                              )}
                                              {ex.video_url && (
                                                <button onClick={() => setVideoModal({ url: toEmbedUrl(ex.video_url), title: ex.name })}
                                                  className="flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 transition font-medium">
                                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                  Video
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {editingProgram && (
                                      <button onClick={() => addExerciseToProgramDay(selectedWeek, di)}
                                        className="mt-1 w-full py-2.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-dashed border-blue-300 dark:border-blue-700 transition font-semibold">
                                        + Add Exercise
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── PROFILE ── */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">User Profile</h3>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        ["Full Name",        selectedTrainee.name],
                        ["Email",            selectedTrainee.email],
                        ["Phone",            selectedTrainee.phone  || "—"],
                        ["Gender",           selectedTrainee.gender ? selectedTrainee.gender.charAt(0).toUpperCase() + selectedTrainee.gender.slice(1) : "—"],
                        ["Date of Birth",    selectedTrainee.dateOfBirth ? new Date(selectedTrainee.dateOfBirth).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" }) : "—"],
                        ["Age",              selectedTrainee.age    != null ? `${selectedTrainee.age} years` : "—"],
                        ["Height",           selectedTrainee.height != null ? `${selectedTrainee.height} cm` : "—"],
                        ["Weight",           selectedTrainee.weight != null ? `${selectedTrainee.weight} kg` : "—"],
                        ["Fitness Goal",     selectedTrainee.goal  || "—"],
                        ["Plan",             selectedTrainee.plan  || "—"],
                        ["Subscription End", selectedTrainee.subscriptionEnd || "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
                          <p className="font-semibold text-gray-900 dark:text-white">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}


            </div>
          </div>
        </div>
      )}

      {/* ── Nutrition Modal ── */}
      {showNutritionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full mx-4 p-4 md:p-6">
            <h3 className="text-xl font-bold mb-6 text-gray-900 dark:text-white">Update Nutrition Goals</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              {[
                { key: "calories", label: "Calories",    placeholder: "e.g. 2000" },
                { key: "protein",  label: "Protein (g)", placeholder: "e.g. 150"  },
                { key: "carbs",    label: "Carbs (g)",   placeholder: "e.g. 200"  },
                { key: "fats",     label: "Fats (g)",    placeholder: "e.g. 65"   },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
                  <input
                    type="number"
                    value={nutritionForm[key]}
                    onChange={(e) => setNutritionForm({ ...nutritionForm, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={nutritionForm.notes}
                onChange={(e) => setNutritionForm({ ...nutritionForm, notes: e.target.value })}
                rows={3}
                placeholder="Optional advice for the trainee…"
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowNutritionModal(false)} className="flex-1 py-2 border rounded-lg dark:border-gray-600 dark:text-white">Cancel</button>
              <button onClick={handleUpdateNutrition} disabled={saving} className="flex-1 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {saving ? "Saving…" : "Update Goals"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Video Modal ── */}
      {videoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
             onClick={() => setVideoModal(null)}>
          <div className="w-full max-w-3xl bg-black rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
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