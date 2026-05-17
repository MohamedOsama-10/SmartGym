// src/pages/coach/NewProgram.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { programsAPI } from "../../services/api";

const CATEGORIES = [
  { value: "weight-loss",     label: "Weight Loss",       icon: "🔥" },
  { value: "muscle-gain",     label: "Muscle Gain",       icon: "💪" },
  { value: "general-fitness", label: "General Fitness",   icon: "🎯" },
  { value: "strength",        label: "Strength Training", icon: "🏋️" },
  { value: "endurance",       label: "Endurance",         icon: "🏃" },
  { value: "flexibility",     label: "Flexibility & Yoga",icon: "🧘" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function WeekEditor({ week, weekIndex, onChange, onRemove }) {
  const updateDay = (dayIndex, field, value) => {
    const updated = { ...week };
    updated.days = [...updated.days];
    updated.days[dayIndex] = { ...updated.days[dayIndex], [field]: value };
    onChange(updated);
  };

  const addExercise = (dayIndex) => {
    const updated = { ...week };
    updated.days = [...updated.days];
    const day = { ...updated.days[dayIndex] };
    day.exercises = [...(day.exercises || []), { name: "", sets: 3, reps: "10" }];
    updated.days[dayIndex] = day;
    onChange(updated);
  };

  const updateExercise = (dayIndex, exIndex, field, value) => {
    const updated = { ...week };
    updated.days = [...updated.days];
    const day = { ...updated.days[dayIndex] };
    day.exercises = [...day.exercises];
    day.exercises[exIndex] = { ...day.exercises[exIndex], [field]: value };
    updated.days[dayIndex] = day;
    onChange(updated);
  };

  const removeExercise = (dayIndex, exIndex) => {
    const updated = { ...week };
    updated.days = [...updated.days];
    const day = { ...updated.days[dayIndex] };
    day.exercises = day.exercises.filter((_, i) => i !== exIndex);
    updated.days[dayIndex] = day;
    onChange(updated);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900 dark:text-white">Week {week.week}</h4>
        {weekIndex > 0 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Remove Week
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
        {week.days.map((day, dayIndex) => (
          <div key={dayIndex} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{day.day}</p>
            <input
              type="text"
              placeholder="Focus (e.g. Full Body)"
              value={day.focus}
              onChange={(e) => updateDay(dayIndex, "focus", e.target.value)}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <input
              type="text"
              placeholder="Duration (e.g. 45 min)"
              value={day.duration}
              onChange={(e) => updateDay(dayIndex, "duration", e.target.value)}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <div className="space-y-1 mb-2">
              {day.exercises?.map((ex, exIndex) => (
                <div key={exIndex} className="flex gap-1 items-center">
                  <input
                    type="text"
                    placeholder="Exercise"
                    value={ex.name}
                    onChange={(e) => updateExercise(dayIndex, exIndex, "name", e.target.value)}
                    className="flex-1 text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-w-0"
                  />
                  <input
                    type="number"
                    placeholder="Sets"
                    value={ex.sets}
                    min="1"
                    onChange={(e) => updateExercise(dayIndex, exIndex, "sets", parseInt(e.target.value) || 1)}
                    className="w-10 text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Reps"
                    value={ex.reps}
                    onChange={(e) => updateExercise(dayIndex, exIndex, "reps", e.target.value)}
                    className="w-10 text-xs border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(dayIndex, exIndex)}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => addExercise(dayIndex)}
              className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add exercise
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function makeDefaultWeek(weekNum) {
  return {
    week: weekNum,
    days: DAYS.map((day) => ({
      day,
      focus: day === "Sunday" || day === "Thursday" ? "Rest Day" : "",
      duration: "45 min",
      exercises: [],
    })),
  };
}

export default function NewProgram() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "general-fitness",
    difficulty: "intermediate",
    duration_weeks: 4,
    sessions_per_week: 3,
    price: 0,
    is_active: true,
  });

  const [workouts, setWorkouts] = useState([makeDefaultWeek(1)]);

  const [nutrition, setNutrition] = useState({
    calories: 2000,
    protein: "30%",
    carbs: "40%",
    fats: "30%",
    meals: [],
  });

  const [showNutrition, setShowNutrition] = useState(false);

  const addWeek = () => {
    setWorkouts((prev) => [...prev, makeDefaultWeek(prev.length + 1)]);
  };

  const removeWeek = (index) => {
    setWorkouts((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((w, i) => ({ ...w, week: i + 1 }));
    });
  };

  const updateWeek = (index, updated) => {
    setWorkouts((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const addMeal = () => {
    setNutrition((prev) => ({
      ...prev,
      meals: [...prev.meals, { name: "", foods: [""] }],
    }));
  };

  const updateMeal = (mealIndex, field, value) => {
    setNutrition((prev) => {
      const meals = [...prev.meals];
      meals[mealIndex] = { ...meals[mealIndex], [field]: value };
      return { ...prev, meals };
    });
  };

  const updateMealFood = (mealIndex, foodIndex, value) => {
    setNutrition((prev) => {
      const meals = [...prev.meals];
      const foods = [...meals[mealIndex].foods];
      foods[foodIndex] = value;
      meals[mealIndex] = { ...meals[mealIndex], foods };
      return { ...prev, meals };
    });
  };

  const addFood = (mealIndex) => {
    setNutrition((prev) => {
      const meals = [...prev.meals];
      meals[mealIndex] = {
        ...meals[mealIndex],
        foods: [...meals[mealIndex].foods, ""],
      };
      return { ...prev, meals };
    });
  };

  const removeFood = (mealIndex, foodIndex) => {
    setNutrition((prev) => {
      const meals = [...prev.meals];
      meals[mealIndex] = {
        ...meals[mealIndex],
        foods: meals[mealIndex].foods.filter((_, i) => i !== foodIndex),
      };
      return { ...prev, meals };
    });
  };

  const removeMeal = (mealIndex) => {
    setNutrition((prev) => ({
      ...prev,
      meals: prev.meals.filter((_, i) => i !== mealIndex),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Program name is required.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...form,
        duration_weeks: parseInt(form.duration_weeks) || 4,
        sessions_per_week: parseInt(form.sessions_per_week) || 3,
        price: parseFloat(form.price) || 0,
        workouts,
        nutritionPlan: showNutrition ? nutrition : null,
      };
      const created = await programsAPI.createProgram(payload);
      navigate(`/coach/programs/${created.id}`);
    } catch (err) {
      setError(err.message || "Failed to create program");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/coach/programs")}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        >
          <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Training Program</h1>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
        <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Program Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Program Name *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Weight Loss Pro"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Describe the program goals and approach..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (weeks)</label>
            <input
              type="number"
              min="1"
              max="52"
              value={form.duration_weeks}
              onChange={(e) => setForm({ ...form, duration_weeks: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sessions per Week</label>
            <input
              type="number"
              min="1"
              max="7"
              value={form.sessions_per_week}
              onChange={(e) => setForm({ ...form, sessions_per_week: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price (EGP)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
          </div>
        </div>
      </div>

      {/* Workout Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Workout Schedule</h2>
          <button
            type="button"
            onClick={addWeek}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
          >
            + Add Week
          </button>
        </div>
        <div className="space-y-4">
          {workouts.map((week, index) => (
            <WeekEditor
              key={index}
              week={week}
              weekIndex={index}
              onChange={(updated) => updateWeek(index, updated)}
              onRemove={() => removeWeek(index)}
            />
          ))}
        </div>
      </div>

      {/* Nutrition Plan (optional) */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-lg">Nutrition Plan</h2>
          <label className="relative inline-flex items-center cursor-pointer gap-2">
            <input
              type="checkbox"
              checked={showNutrition}
              onChange={(e) => setShowNutrition(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Include nutrition plan</span>
          </label>
        </div>

        {showNutrition && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Calories / day</label>
                <input
                  type="number"
                  value={nutrition.calories}
                  onChange={(e) => setNutrition({ ...nutrition, calories: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Protein %</label>
                <input
                  type="text"
                  value={nutrition.protein}
                  onChange={(e) => setNutrition({ ...nutrition, protein: e.target.value })}
                  placeholder="30%"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Carbs %</label>
                <input
                  type="text"
                  value={nutrition.carbs}
                  onChange={(e) => setNutrition({ ...nutrition, carbs: e.target.value })}
                  placeholder="40%"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fats %</label>
                <input
                  type="text"
                  value={nutrition.fats}
                  onChange={(e) => setNutrition({ ...nutrition, fats: e.target.value })}
                  placeholder="30%"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              {nutrition.meals.map((meal, mealIndex) => (
                <div key={mealIndex} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Meal name (e.g. Breakfast)"
                      value={meal.name}
                      onChange={(e) => updateMeal(mealIndex, "name", e.target.value)}
                      className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeMeal(mealIndex)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="space-y-1 ml-2">
                    {meal.foods.map((food, foodIndex) => (
                      <div key={foodIndex} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Food item"
                          value={food}
                          onChange={(e) => updateMealFood(mealIndex, foodIndex, e.target.value)}
                          className="flex-1 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeFood(mealIndex, foodIndex)}
                          className="text-red-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addFood(mealIndex)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-1"
                    >
                      + Add food
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addMeal}
                className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:underline"
              >
                + Add meal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-3 pb-8">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            "Create Program"
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate("/coach/programs")}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
