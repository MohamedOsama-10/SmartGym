// src/pages/user/Meals.jsx
import React, { useState, useRef, useEffect } from "react";
import { mealAPI } from "../../services/mealAPI";

export default function Meals() {
  const [selectedType, setSelectedType] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [meals, setMeals] = useState([]);
  const [mealHistory, setMealHistory] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);
  const [nutritionGoals, setNutritionGoals] = useState({
    calories: 2500,
    protein: 180,
    carbs: 250,
    fats: 80,
  });

  const [nameSuggestions, setNameSuggestions] = useState([]);

  const [newMeal, setNewMeal] = useState({
    name: "",
    type: "breakfast",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    ingredients: "",
    image_url: null,
    imagePreview: null,
  });
  
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Load data on mount
  useEffect(() => {
    loadMeals();
    loadTodayLogs();
    loadGoals();
  }, [selectedType, favoritesOnly]);

  const loadMeals = async () => {
    try {
      setLoading(true);
      const data = await mealAPI.getMeals({
        type: selectedType,
        favoritesOnly,
      });
      setMeals(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayLogs = async () => {
    try {
      const data = await mealAPI.getTodayLogs();
      setDailySummary(data);
      // Update goals from response
      if (data.goal) {
        setNutritionGoals(data.goal);
      }
    } catch (err) {
      console.error("Failed to load today's logs:", err);
    }
  };

  const loadGoals = async () => {
    try {
      const data = await mealAPI.getGoals();
      setNutritionGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await mealAPI.getHistory(30); // Last 30 days
      setMealHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle history view
  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  const getProgressColor = (consumed, goal) => {
    const percentage = (consumed / goal) * 100;
    if (percentage < 50) return "bg-blue-500";
    if (percentage < 85) return "bg-green-500";
    if (percentage <= 100) return "bg-yellow-500";
    return "bg-red-500";
  };

  const typeOptions = [
    { value: "all", label: "All Meals", icon: "🍽️" },
    { value: "breakfast", label: "Breakfast", icon: "🌅" },
    { value: "lunch", label: "Lunch", icon: "☀️" },
    { value: "dinner", label: "Dinner", icon: "🌙" },
    { value: "snack", label: "Snacks", icon: "🥜" },
  ];

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      // Upload to backend
      const result = await mealAPI.uploadImage(file);
      setNewMeal(prev => ({
        ...prev,
        image_url: result.image_url,
        imagePreview: result.image_url,
      }));
    } catch (err) {
      alert('Failed to upload image: ' + err.message);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    galleryInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    setNewMeal(prev => ({
      ...prev,
      image_url: null,
      imagePreview: null,
    }));
  };

  const handleLogMeal = async (meal, servings = 1) => {
    try {
      await mealAPI.logMeal(meal.id, servings);
      await loadTodayLogs(); // Refresh daily summary
      setSelectedMeal(null); // Close modal if open
      alert("Meal logged successfully!");
    } catch (err) {
      alert("Failed to log meal: " + err.message);
    }
  };

  const handleDeleteHistory = async (entryId) => {
    try {
      await mealAPI.deleteLog(entryId);
      await loadHistory(); // Refresh history
      await loadTodayLogs(); // Refresh today's summary
    } catch (err) {
      alert("Failed to delete entry: " + err.message);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleMealInputChange = (field, value) => {
    setNewMeal(prev => ({ ...prev, [field]: value }));
  };

  const handleNameInput = (value) => {
    handleMealInputChange("name", value);
    if (value.length >= 2) {
      const filtered = meals.filter(m =>
        m.name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 6);
      setNameSuggestions(filtered);
    } else {
      setNameSuggestions([]);
    }
  };

  const handleSuggestionSelect = (meal) => {
    setNewMeal(prev => ({
      ...prev,
      name: meal.name,
      type: meal.type || prev.type,
      calories: String(meal.calories),
      protein: String(meal.protein),
      carbs: String(meal.carbs),
      fats: String(meal.fats),
      ingredients: Array.isArray(meal.ingredients)
        ? meal.ingredients.join(', ')
        : (meal.ingredients || ''),
      image_url: meal.image_url || null,
      imagePreview: meal.image_url || null,
    }));
    setNameSuggestions([]);
  };

  const handleAutoCalculateClick = () => {
    setShowComingSoonModal(true);
  };

  const handleAddCustomMeal = async () => {
    if (!newMeal.name || !newMeal.calories || !newMeal.protein || !newMeal.carbs || !newMeal.fats) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const mealData = {
        name: newMeal.name,
        type: newMeal.type,
        calories: parseInt(newMeal.calories),
        protein: parseFloat(newMeal.protein),
        carbs: parseFloat(newMeal.carbs),
        fats: parseFloat(newMeal.fats),
        ingredients: newMeal.ingredients ? newMeal.ingredients.split(',').map(i => i.trim()) : [],
        image_url: newMeal.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
      };

      const createdMeal = await mealAPI.createCustomMeal(mealData);
      
      // Reset form
      setNewMeal({
        name: "",
        type: "breakfast",
        calories: "",
        protein: "",
        carbs: "",
        fats: "",
        ingredients: "",
        image_url: null,
        imagePreview: null,
      });
      setShowAddMealModal(false);
      
      // Refresh meals list
      await loadMeals();
      
      // Optionally log it immediately
      if (confirm("Meal created! Would you like to log it now?")) {
        await handleLogMeal(createdMeal);
      }
      
    } catch (err) {
      alert("Failed to create meal: " + err.message);
    }
  };

  const handleToggleFavorite = async (mealId, e) => {
    e.stopPropagation();
    // Optimistic update — flip the star instantly
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, is_favorite: !m.is_favorite } : m
    ));
    try {
      await mealAPI.toggleFavorite(mealId);
      // Only do a full reload when "Favorites Only" filter is active
      // so the meal disappears from the list immediately after un-favouriting
      if (favoritesOnly) await loadMeals();
    } catch (err) {
      // Revert optimistic update on failure
      setMeals(prev => prev.map(m =>
        m.id === mealId ? { ...m, is_favorite: !m.is_favorite } : m
      ));
      alert("Failed to update favorite: " + err.message);
    }
  };

  // Calculate consumed from dailySummary
  const consumed = dailySummary?.totals || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  // Parse ingredients for display
  const parseIngredients = (ingredients) => {
    if (!ingredients) return [];
    if (Array.isArray(ingredients)) return ingredients;
    try {
      return JSON.parse(ingredients);
    } catch {
      return ingredients.split(',').map(i => i.trim()).filter(i => i);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Meal Planner</h2>
          <p className="text-gray-600">Track your nutrition and discover healthy meals</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 font-medium ${
              showHistory
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showHistory ? "Show Meals" : "View History"}
          </button>
          <button 
            onClick={() => setShowAddMealModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-600/30"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Custom Meal
          </button>
        </div>
      </div>

      {/* Daily Nutrition Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Today's Nutrition</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {dailySummary?.meals_logged || 0} meal{dailySummary?.meals_logged !== 1 ? "s" : ""} logged today
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl md:text-3xl font-bold text-orange-500 dark:text-orange-400">{Math.round(consumed.calories)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">of {nutritionGoals.calories} kcal</p>
          </div>
        </div>

        {/* Calorie progress bar */}
        <div className="mb-6">
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(consumed.calories, nutritionGoals.calories)}`}
              style={{ width: `${Math.min((consumed.calories / nutritionGoals.calories) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-right">
            {nutritionGoals.calories > 0 ? Math.round((consumed.calories / nutritionGoals.calories) * 100) : 0}% of daily goal
          </p>
        </div>

        {/* Macro breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Protein</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(consumed.protein)}g / {nutritionGoals.protein}g</span>
            </div>
            <div className="h-2 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((consumed.protein / nutritionGoals.protein) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">Carbs</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(consumed.carbs)}g / {nutritionGoals.carbs}g</span>
            </div>
            <div className="h-2 bg-green-100 dark:bg-green-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((consumed.carbs / nutritionGoals.carbs) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-500">Fats</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{Math.round(consumed.fats)}g / {nutritionGoals.fats}g</span>
            </div>
            <div className="h-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((consumed.fats / nutritionGoals.fats) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Error: {error}
        </div>
      )}

      {/* History View or Meals Grid */}
      {!loading && !showHistory ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedType(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedType === option.value
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={favoritesOnly}
                onChange={(e) => setFavoritesOnly(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
              />
              <span className="text-gray-700 font-medium">Favorites Only</span>
              <span className="text-yellow-500">⭐</span>
            </label>
          </div>

          {/* Meals List — compact scrollable */}
          <div className="max-h-[520px] overflow-y-auto rounded-xl pr-0.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {meals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all group"
                >
                  {/* Thumbnail */}
                  <img
                    src={meal.image_url}
                    alt={meal.name}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&h=100&fit=crop'; }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">{meal.name}</h3>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full capitalize flex-shrink-0">
                        {meal.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-orange-500 font-bold text-sm">
                        {meal.calories}<span className="text-xs font-normal text-gray-400"> kcal</span>
                      </span>
                      <span className="text-xs text-blue-600 dark:text-blue-400">P {meal.protein}g</span>
                      <span className="text-xs text-green-600 dark:text-green-400">C {meal.carbs}g</span>
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">F {meal.fats}g</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => handleToggleFavorite(meal.id, e)}
                      className={`p-1.5 rounded-lg transition ${meal.is_favorite ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}
                      title={meal.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedMeal(meal)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                      title="Details"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleLogMeal(meal)}
                      className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold"
                    >
                      Log
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {meals.length === 0 && !loading && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🍽️</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No meals found</h3>
              <p className="text-gray-500">Try adjusting your filters or add a custom meal</p>
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Meal History</h3>
            <span className="text-sm text-gray-500">{mealHistory.length} total meals logged</span>
          </div>

          {mealHistory.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📝</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No meals logged yet</h3>
              <p className="text-gray-500">Start logging meals to track your nutrition</p>
            </div>
          ) : (
            mealHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <img
                  src={entry.meal?.image_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop"}
                  alt={entry.meal?.name || "Meal"}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-semibold text-gray-900">{entry.meal?.name || "Unknown Meal"}</h5>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full capitalize">
                      {entry.meal?.type || "meal"}
                    </span>
                    {entry.servings > 1 && (
                      <span className="text-sm text-gray-600">x{entry.servings}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                    <span>{Math.round(entry.total_calories || 0)} cal</span>
                    <span>•</span>
                    <span>{Math.round(entry.total_protein || 0)}g protein</span>
                    <span>•</span>
                    <span className="text-gray-400">{formatTimeAgo(entry.logged_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteHistory(entry.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                  title="Remove from history"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================== MODALS ==================== */}

      {/* Meal Detail Modal */}
      {selectedMeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="relative h-64">
              <img
                src={selectedMeal.image_url}
                alt={selectedMeal.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedMeal(null)}
                className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition"
              >
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-4 left-4">
                <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium text-gray-700 capitalize">
                  {selectedMeal.type}
                </span>
              </div>
            </div>
            
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{selectedMeal.name}</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">{selectedMeal.calories}</p>
                  <p className="text-sm text-gray-600">calories</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{selectedMeal.protein}g</p>
                  <p className="text-sm text-gray-600">protein</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{selectedMeal.carbs}g</p>
                  <p className="text-sm text-gray-600">carbs</p>
                </div>
                <div className="bg-yellow-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{selectedMeal.fats}g</p>
                  <p className="text-sm text-gray-600">fats</p>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2">Ingredients</h4>
                <div className="flex flex-wrap gap-2">
                  {parseIngredients(selectedMeal.ingredients).map((ingredient, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                      {ingredient}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedMeal(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
                >
                  Close
                </button>
                <button
                  onClick={() => handleLogMeal(selectedMeal)}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Log This Meal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Meal Modal */}
      {showAddMealModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add Custom Meal</h3>
              <button
                onClick={() => setShowAddMealModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meal Image</label>
                {newMeal.imagePreview ? (
                  <div className="relative">
                    <img
                      src={newMeal.imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover rounded-xl"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleCameraClick}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center gap-2"
                    >
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600">Take Photo</span>
                    </button>
                    <button
                      onClick={handleGalleryClick}
                      className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center gap-2"
                    >
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600">From Gallery</span>
                    </button>
                  </div>
                )}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* Meal Name with autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name *</label>
                <input
                  type="text"
                  value={newMeal.name}
                  onChange={(e) => handleNameInput(e.target.value)}
                  onBlur={() => setTimeout(() => setNameSuggestions([]), 150)}
                  placeholder="e.g., Grilled Chicken Salad"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                {nameSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <p className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 border-b border-gray-100">
                      Previously added meals — click to auto-fill
                    </p>
                    {nameSuggestions.map((meal) => (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => handleSuggestionSelect(meal)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition text-left"
                      >
                        <img
                          src={meal.image_url}
                          alt={meal.name}
                          className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=50&h=50&fit=crop'; }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{meal.name}</p>
                          <p className="text-xs text-gray-500">{meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fats}g</p>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize flex-shrink-0">
                          {meal.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Meal Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Type</label>
                <select
                  value={newMeal.type}
                  onChange={(e) => handleMealInputChange("type", e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {/* Nutrition Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories *</label>
                  <input
                    type="number"
                    value={newMeal.calories}
                    onChange={(e) => handleMealInputChange("calories", e.target.value)}
                    placeholder="kcal"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMeal.protein}
                    onChange={(e) => handleMealInputChange("protein", e.target.value)}
                    placeholder="grams"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMeal.carbs}
                    onChange={(e) => handleMealInputChange("carbs", e.target.value)}
                    placeholder="grams"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fats (g) *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMeal.fats}
                    onChange={(e) => handleMealInputChange("fats", e.target.value)}
                    placeholder="grams"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              {/* Auto-calculate button */}
              <button
                onClick={handleAutoCalculateClick}
                className="w-full py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-calculate with AI
              </button>

              {/* Ingredients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
                <textarea
                  value={newMeal.ingredients}
                  onChange={(e) => handleMealInputChange("ingredients", e.target.value)}
                  placeholder="Enter ingredients separated by commas (e.g., chicken, lettuce, tomato)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowAddMealModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustomMeal}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
              >
                Create Meal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Coming Soon!</h3>
            <p className="text-gray-600 mb-6">
              AI-powered nutrition calculation is under development. You'll be able to upload a photo and get automatic nutrition facts!
            </p>
            <button
              onClick={() => setShowComingSoonModal(false)}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}