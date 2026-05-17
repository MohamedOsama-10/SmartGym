// src/pages/coach/ProgramDetails.jsx
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { programsAPI } from "../../services/api";

const CATEGORY_STYLES = {
  "weight-loss":     { color: "orange", icon: "🔥", label: "Weight Loss" },
  "muscle-gain":     { color: "blue",   icon: "💪", label: "Muscle Gain" },
  "general-fitness": { color: "green",  icon: "🎯", label: "General Fitness" },
  "strength":        { color: "red",    icon: "🏋️", label: "Strength Training" },
  "endurance":       { color: "purple", icon: "🏃", label: "Endurance" },
  "flexibility":     { color: "pink",   icon: "🧘", label: "Flexibility & Yoga" },
};

export default function ProgramDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeTab, setActiveTab] = useState("workouts"); // 'workouts' or 'nutrition'

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await programsAPI.getProgram(id);
        setPlan(data);
        // Default to week 1 if available
        if (data.workouts && data.workouts.length > 0) {
          setActiveWeek(data.workouts[0].week);
        }
      } catch (err) {
        setError(err.message || "Failed to load program");
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading program...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Program not found</h3>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <button
          onClick={() => navigate("/coach/programs")}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Back to Programs
        </button>
      </div>
    );
  }

  const category = CATEGORY_STYLES[plan.category] || CATEGORY_STYLES["general-fitness"];
  const currentWeek =
    plan.workouts?.find((w) => w.week === activeWeek) || plan.workouts?.[0];
  const weekNumbers = plan.workouts?.map((w) => w.week) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/coach/programs")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${category.color}-100 text-${category.color}-700 dark:bg-${category.color}-900/30 dark:text-${category.color}-400`}>
                {category.icon} {category.label}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                plan.difficulty === "beginner"    ? "bg-green-100 text-green-700" :
                plan.difficulty === "intermediate" ? "bg-yellow-100 text-yellow-700" :
                                                     "bg-red-100 text-red-700"
              }`}>
                {plan.difficulty}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{plan.name}</h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/coach/programs/${id}/edit`)}
            className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-100 dark:hover:bg-blue-900/30 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Plan
          </button>
          <button
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Assign to Trainee
          </button>
        </div>
      </div>

      {/* Plan Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{plan.duration}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Sessions/Week</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{plan.sessionsPerWeek}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">{plan.price} EGP</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
          <p className={`text-xl font-bold ${plan.isActive ? "text-green-600" : "text-gray-500"}`}>
            {plan.isActive ? "Active" : "Inactive"}
          </p>
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">About This Plan</h3>
          <p className="text-gray-600 dark:text-gray-300">{plan.description}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab("workouts")}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === "workouts"
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          Workout Schedule
          {activeTab === "workouts" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab("nutrition")}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === "nutrition"
              ? "text-blue-600 dark:text-blue-400"
              : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
          }`}
        >
          Nutrition Plan
          {activeTab === "nutrition" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"></div>
          )}
        </button>
      </div>

      {/* Workouts Tab */}
      {activeTab === "workouts" && (
        <div className="space-y-6">
          {weekNumbers.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No workout schedule added yet.</p>
            </div>
          ) : (
            <>
              {/* Week Selector */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mr-2 whitespace-nowrap">
                  Select Week:
                </span>
                {weekNumbers.map((week) => (
                  <button
                    key={week}
                    onClick={() => setActiveWeek(week)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                      activeWeek === week
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                  >
                    Week {week}
                  </button>
                ))}
              </div>

              {/* Weekly Schedule */}
              {currentWeek && (
                <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
                  {currentWeek.days?.map((day, index) => (
                    <div
                      key={index}
                      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${
                        day.focus === "Rest Day" ? "opacity-60" : ""
                      }`}
                    >
                      <div className={`p-4 ${day.focus === "Rest Day" ? "bg-gray-50 dark:bg-gray-700/50" : "bg-blue-50 dark:bg-blue-900/20"}`}>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{day.day}</p>
                        <p className="font-bold text-gray-900 dark:text-white">{day.focus}</p>
                        {day.duration && day.duration !== "0 min" && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{day.duration}</p>
                        )}
                      </div>
                      {day.exercises?.length > 0 && (
                        <div className="p-4 space-y-2">
                          {day.exercises.map((exercise, exIndex) => (
                            <div key={exIndex} className="text-sm border-b border-gray-100 dark:border-gray-700 last:border-0 pb-2 last:pb-0">
                              <p className="font-medium text-gray-900 dark:text-white">{exercise.name}</p>
                              <p className="text-gray-500 dark:text-gray-400">{exercise.sets} sets × {exercise.reps}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {day.focus === "Rest Day" && (
                        <div className="p-4 text-center text-gray-400 dark:text-gray-500">
                          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                          </svg>
                          <p className="text-sm">Recovery Day</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Nutrition Tab */}
      {activeTab === "nutrition" && (
        <div>
          {!plan.nutritionPlan ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No nutrition plan added yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Macros */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Daily Macros
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Calories</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {plan.nutritionPlan.calories} kcal
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: "100%" }}></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Protein</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {plan.nutritionPlan.protein}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: plan.nutritionPlan.protein }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Carbs</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {plan.nutritionPlan.carbs}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: plan.nutritionPlan.carbs }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Fats</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {plan.nutritionPlan.fats}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500 rounded-full"
                        style={{ width: plan.nutritionPlan.fats }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Meal Plan */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Sample Meals
                </h3>
                {plan.nutritionPlan.meals?.length > 0 ? (
                  <div className="space-y-4">
                    {plan.nutritionPlan.meals.map((meal, index) => (
                      <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <p className="font-medium text-gray-900 dark:text-white mb-2 capitalize">
                          {meal.name}
                        </p>
                        <ul className="space-y-1">
                          {meal.foods?.map((food, foodIndex) => (
                            <li key={foodIndex} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></span>
                              {food}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No meal details provided.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
