// D:\gym_system\gym-project\frontend\src\pages\user\CoachDirectory.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const SESSION_TYPES = [
  { value: "pt", label: "Personal Training", icon: "🎯", duration: 60 },
  { value: "gym", label: "Gym Session", icon: "💪", duration: 60 },
  { value: "class", label: "Group Class", icon: "👥", duration: 45 },
  { value: "yoga", label: "Yoga", icon: "🧘", duration: 60 },
  { value: "cardio", label: "Cardio", icon: "🏃", duration: 45 },
];

const SPECIALTY_FILTERS = [
  { value: "all", label: "All Specialties", icon: "🏋️" },
  { value: "strength", label: "Strength", icon: "💪" },
  { value: "weight-loss", label: "Weight Loss", icon: "🔥" },
  { value: "bodybuilding", label: "Bodybuilding", icon: "🏆" },
  { value: "yoga", label: "Yoga", icon: "🧘" },
  { value: "cardio", label: "Cardio", icon: "🏃" },
  { value: "crossfit", label: "CrossFit", icon: "🏋️‍♂️" },
  { value: "pilates", label: "Pilates", icon: "🤸" },
  { value: "nutrition", label: "Nutrition", icon: "🥗" },
];

const LANGUAGE_OPTIONS = [
  { value: "all", label: "All Languages", icon: "🌍" },
  { value: "English", label: "English", icon: "🇬🇧" },
  { value: "Arabic", label: "Arabic", icon: "🇸🇦" },
  { value: "French", label: "French", icon: "🇫🇷" },
  { value: "Spanish", label: "Spanish", icon: "🇪🇸" },
  { value: "German", label: "German", icon: "🇩🇪" },
  { value: "Chinese", label: "Chinese", icon: "🇨🇳" },
];

const EXPERIENCE_RANGES = [
  { value: "all", label: "Any Experience", min: 0, max: 100 },
  { value: "0-2", label: "0-2 years", min: 0, max: 2 },
  { value: "3-5", label: "3-5 years", min: 3, max: 5 },
  { value: "6-10", label: "6-10 years", min: 6, max: 10 },
  { value: "10+", label: "10+ years", min: 10, max: 100 },
];

const PRICE_RANGES = [
  { value: "all", label: "Any Price", min: 0, max: 10000 },
  { value: "0-50", label: "$0 - $50/hr", min: 0, max: 50 },
  { value: "50-100", label: "$50 - $100/hr", min: 50, max: 100 },
  { value: "100-150", label: "$100 - $150/hr", min: 100, max: 150 },
  { value: "150+", label: "$150+/hr", min: 150, max: 10000 },
];

const RATING_OPTIONS = [
  { value: "all", label: "Any Rating", min: 0 },
  { value: "4.5", label: "4.5+ ⭐", min: 4.5 },
  { value: "4.0", label: "4.0+ ⭐", min: 4.0 },
  { value: "3.5", label: "3.5+ ⭐", min: 3.5 },
];

export default function CoachDirectory() {
  const navigate = useNavigate();
  const location = useLocation();
  const { apiRequest } = useAuth();

  // Real coaches from API
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coachesError, setCoachesError] = useState(null);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [filterLanguage, setFilterLanguage] = useState("all");
  const [filterExperience, setFilterExperience] = useState("all");
  const [filterPrice, setFilterPrice] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);

  // Search suggestions
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Booking modal states
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingStep, setBookingStep] = useState(1);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sessionType, setSessionType] = useState("pt");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Detect reschedule flow from navigation state
  useEffect(() => {
    if (location.state?.rescheduleBooking) {
      setRescheduleBooking(location.state.rescheduleBooking);
    }
  }, [location.state]);

  // Fetch real coaches from API
  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    try {
      setCoachesLoading(true);
      setCoachesError(null);

      // Single endpoint returns all coaches regardless of gym assignment
      const data = await apiRequest('/gyms/coaches');
      if (!Array.isArray(data)) {
        setCoaches([]);
        return;
      }

      const allCoaches = data.map(coach => ({
        id: coach.id,
        name: coach.name || coach.email?.split('@')[0] || `Coach #${coach.id}`,
        email: coach.email,
        avatar: (coach.name || 'C').slice(0, 2).toUpperCase(),
        avatarUrl: coach.avatar_url || null,
        specialty: coach.specialty || "General Fitness",
        yearsOfExperience: coach.experience_years || 0,
        hourlyRate: coach.hourly_rate || coach.rate || 0,
        rating: coach.rating || 4.5,
        totalReviews: coach.total_reviews || 0,
        totalClients: coach.total_clients || 0,
        maxClients: coach.max_clients || 20,
        currentClients: coach.current_clients || 0,
        isAvailable: coach.is_available !== false,
        isFeatured: coach.is_featured || false,
        bio: coach.bio || "Experienced fitness coach dedicated to helping clients reach their goals.",
        certifications: coach.certifications || [],
        specialties: coach.specialties
          ? (Array.isArray(coach.specialties) ? coach.specialties : [coach.specialties])
          : [coach.specialty || "General Fitness"],
        languages: coach.languages || ["English"],
        education: coach.education || "",
        availability: coach.availability_text || "Contact for availability",
        cvUrl: coach.cv_url || null,
      }));

      setCoaches(allCoaches);
    } catch (err) {
      console.error("Failed to fetch coaches:", err);
      setCoachesError(err.message || "Failed to load coaches");
    } finally {
      setCoachesLoading(false);
    }
  };

  // Generate search suggestions based on input
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const suggestions = new Set();

    coaches.forEach(coach => {
      // Add name suggestions
      if (coach.name.toLowerCase().includes(query)) {
        suggestions.add({ type: 'name', value: coach.name, coachId: coach.id });
      }
      // Add specialty suggestions
      coach.specialties.forEach(spec => {
        if (spec.toLowerCase().includes(query)) {
          suggestions.add({ type: 'specialty', value: spec });
        }
      });
      // Add language suggestions
      coach.languages.forEach(lang => {
        if (lang.toLowerCase().includes(query)) {
          suggestions.add({ type: 'language', value: lang });
        }
      });
    });

    setSearchSuggestions(Array.from(suggestions).slice(0, 6));
  }, [searchQuery, coaches]);

  // Fetch real availability for a coach
  const fetchAvailability = async (coachId) => {
    setSlotsLoading(true);
    setAvailabilitySlots([]);
    try {
      const slots = await apiRequest(
        `/coach/availability/coach/${coachId}?available_only=true`
      );
      // Normalize: backend uses `specific_date`, frontend expects `date`
      const normalized = (Array.isArray(slots) ? slots : []).map(slot => ({
        ...slot,
        date: slot.date || slot.specific_date, // support both field names
      })).filter(slot => slot.date); // discard slots with no date
      setAvailabilitySlots(normalized);
    } catch (err) {
      console.error("Failed to fetch availability:", err);
      setAvailabilitySlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const isCoachAvailable = (coach) =>
    coach.isAvailable && coach.currentClients < coach.maxClients;

  // Advanced filtering logic
  const filteredCoaches = useMemo(() => {
    return coaches
      .filter(coach => {
        // Text search (name, specialty, bio, education)
        const matchesSearch = searchQuery === "" || 
          coach.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.bio.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.education.toLowerCase().includes(searchQuery.toLowerCase()) ||
          coach.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
          coach.languages.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()));

        // Specialty filter
        const matchesSpecialty =
          filterSpecialty === "all" ||
          coach.specialties.some(s =>
            s.toLowerCase().includes(filterSpecialty.toLowerCase())
          );

        // Language filter
        const matchesLanguage =
          filterLanguage === "all" ||
          coach.languages.some(l => 
            l.toLowerCase() === filterLanguage.toLowerCase()
          );

        // Experience filter
        const expRange = EXPERIENCE_RANGES.find(e => e.value === filterExperience);
        const matchesExperience = !expRange || expRange.value === "all" ||
          (coach.yearsOfExperience >= expRange.min && coach.yearsOfExperience <= expRange.max);

        // Price filter
        const priceRange = PRICE_RANGES.find(p => p.value === filterPrice);
        const matchesPrice = !priceRange || priceRange.value === "all" ||
          (coach.hourlyRate >= priceRange.min && coach.hourlyRate <= priceRange.max);

        // Rating filter
        const ratingOption = RATING_OPTIONS.find(r => r.value === filterRating);
        const matchesRating = !ratingOption || ratingOption.value === "all" ||
          coach.rating >= ratingOption.min;

        // Availability filter
        const matchesAvailability = filterAvailability === "all" ||
          (filterAvailability === "available" && isCoachAvailable(coach)) ||
          (filterAvailability === "featured" && coach.isFeatured);

        return matchesSearch && matchesSpecialty && matchesLanguage && 
               matchesExperience && matchesPrice && matchesRating && matchesAvailability;
      })
      .sort((a, b) => {
        if (sortBy === "featured") return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        if (sortBy === "rating") return b.rating - a.rating;
        if (sortBy === "experience") return b.yearsOfExperience - a.yearsOfExperience;
        if (sortBy === "price-low") return a.hourlyRate - b.hourlyRate;
        if (sortBy === "price-high") return b.hourlyRate - a.hourlyRate;
        if (sortBy === "name") return a.name.localeCompare(b.name);
        return 0;
      });
  }, [coaches, searchQuery, filterSpecialty, filterLanguage, filterExperience, 
      filterPrice, filterRating, filterAvailability, sortBy]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery("");
    setFilterSpecialty("all");
    setFilterLanguage("all");
    setFilterExperience("all");
    setFilterPrice("all");
    setFilterRating("all");
    setFilterAvailability("all");
    setSortBy("featured");
  };

  // Check if any filter is active
  const hasActiveFilters = 
    searchQuery !== "" || 
    filterSpecialty !== "all" || 
    filterLanguage !== "all" ||
    filterExperience !== "all" ||
    filterPrice !== "all" ||
    filterRating !== "all" ||
    filterAvailability !== "all";

  const handleViewProfile = (coach) => {
    setSelectedCoach(coach);
    setShowProfileModal(true);
  };

  const openBookModal = (coach) => {
    if (!isCoachAvailable(coach)) return;
    setSelectedCoach(coach);
    setBookingStep(1);
    setSelectedSlot(null);
    setSessionType("pt");
    setBookingNotes("");
    setBookingSuccess(false);
    setBookingError(null);
    setShowBookModal(true);
    fetchAvailability(coach.id);
  };

  const closeBookModal = () => {
    setShowBookModal(false);
    setBookingStep(1);
    setSelectedSlot(null);
    setBookingError(null);
  };

  const selectSlot = (slot) => {
    setSelectedSlot(slot);
    setBookingStep(2);
  };

  // Submit: either new booking or reschedule
  const submitBooking = async () => {
    if (!selectedCoach || !selectedSlot) return;

    setBookingLoading(true);
    setBookingError(null);

    try {
      if (rescheduleBooking) {
        // RESCHEDULE: call the reschedule endpoint
        await apiRequest(`/bookings/${rescheduleBooking.id}/reschedule`, {
          method: 'POST',
          body: JSON.stringify({
            new_availability_slot_id: selectedSlot.id,
            new_coach_id: selectedCoach.id,
            reschedule_reason: bookingNotes || "Rescheduled by customer",
          }),
        });
      } else {
        // NEW BOOKING
        await apiRequest('/bookings/', {
          method: 'POST',
          body: JSON.stringify({
            coach_id: selectedCoach.id,
            availability_slot_id: selectedSlot.id,
            customer_notes: bookingNotes,
          }),
        });
      }

      setBookingSuccess(true);
      setTimeout(() => {
        closeBookModal();
        navigate('/user/bookings');
      }, 2000);
    } catch (err) {
      setBookingError(err.message || "Failed to process booking");
    } finally {
      setBookingLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    // timeStr might be "09:00:00" or "09:00"
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]);
    const mins = parts[1] || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12}:${mins} ${ampm}`;
  };

  // Group slots by date for better UX
  const slotsByDate = availabilitySlots.reduce((acc, slot) => {
    const d = slot.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(slot);
    return acc;
  }, {});

  // ─── Loading / Error States ───────────────────────────────────────────────

  if (coachesLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading coaches...</p>
        </div>
      </div>
    );
  }

  if (coachesError) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to Load Coaches</h2>
          <p className="text-gray-500 mb-6">{coachesError}</p>
          <button
            onClick={fetchCoaches}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reschedule Banner */}
      {rescheduleBooking && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 text-xl">📅</span>
            </div>
            <div>
              <p className="font-semibold text-blue-900 dark:text-blue-100">Rescheduling Session</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Select a new coach &amp; time slot for: <strong>{rescheduleBooking.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/user/bookings')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {rescheduleBooking ? "Select New Coach" : "Find Your Perfect Coach"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {rescheduleBooking
              ? "Choose a coach and time slot to reschedule your session"
              : `Browse ${filteredCoaches.length} expert coaches available`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </button>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
            {filteredCoaches.length} result{filteredCoaches.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Search & Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
        {/* Main Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, specialty, language, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full pl-12 pr-4 py-4 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 text-lg"
          />
          <svg className="w-6 h-6 text-gray-400 absolute left-4 top-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          
          {/* Search Suggestions Dropdown */}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              {searchSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (suggestion.type === 'name') {
                      setSearchQuery(suggestion.value);
                      const coach = coaches.find(c => c.id === suggestion.coachId);
                      if (coach) handleViewProfile(coach);
                    } else {
                      setSearchQuery(suggestion.value);
                    }
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span className="text-gray-400">
                    {suggestion.type === 'name' && '👤'}
                    {suggestion.type === 'specialty' && '💪'}
                    {suggestion.type === 'language' && '🗣️'}
                  </span>
                  <span className="text-gray-900 dark:text-white">{suggestion.value}</span>
                  <span className="text-xs text-gray-400 ml-auto capitalize">{suggestion.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_FILTERS.map(filter => (
            <button
              key={filter.value}
              onClick={() => setFilterSpecialty(filter.value)}
              className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                filterSpecialty === filter.value
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              <span>{filter.icon}</span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>

        {/* Advanced Filters Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <svg className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="featured">⭐ Featured First</option>
              <option value="rating">⭐ Highest Rated</option>
              <option value="experience">📅 Most Experienced</option>
              <option value="price-low">💰 Price: Low to High</option>
              <option value="price-high">💰 Price: High to Low</option>
              <option value="name">🔤 Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Language Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.icon} {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Experience
              </label>
              <select
                value={filterExperience}
                onChange={(e) => setFilterExperience(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {EXPERIENCE_RANGES.map(exp => (
                  <option key={exp.value} value={exp.value}>{exp.label}</option>
                ))}
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Hourly Rate
              </label>
              <select
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {PRICE_RANGES.map(price => (
                  <option key={price.value} value={price.value}>{price.label}</option>
                ))}
              </select>
            </div>

            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Minimum Rating
              </label>
              <select
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                {RATING_OPTIONS.map(rating => (
                  <option key={rating.value} value={rating.value}>{rating.label}</option>
                ))}
              </select>
            </div>

            {/* Availability Filter */}
            <div className="md:col-span-2 lg:col-span-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Availability
              </label>
              <div className="flex gap-2">
                {[
                  { value: 'all', label: 'All Coaches', icon: '👥' },
                  { value: 'available', label: 'Available Now', icon: '✅' },
                  { value: 'featured', label: 'Featured Only', icon: '⭐' },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setFilterAvailability(option.value)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      filterAvailability === option.value
                        ? "bg-green-600 text-white shadow-lg"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                    }`}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Empty state */}
      {filteredCoaches.length === 0 && (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow border border-gray-200 dark:border-gray-700">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No coaches found</h3>
          <p className="text-gray-500 mb-6">Try adjusting your search criteria or filters</p>
          <button
            onClick={clearAllFilters}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Coaches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCoaches.map(coach => {
          const available = isCoachAvailable(coach);
          return (
            <div
              key={coach.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 overflow-hidden hover:shadow-2xl transition-all duration-300 relative ${
                coach.isFeatured ? 'border-yellow-500' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {coach.isFeatured && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                    ⭐ FEATURED
                  </span>
                </div>
              )}

              <div className="p-6 bg-gradient-to-br from-blue-600 to-purple-600 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold shadow-lg overflow-hidden">
                    {coach.avatarUrl ? (
                      <img src={coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
                    ) : (
                      coach.avatar
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold mb-1 truncate">{coach.name}</h3>
                    <p className="text-sm opacity-90 mb-2 truncate">{coach.specialty}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400">★</span>
                      <span className="text-sm">{coach.rating.toFixed(1)} ({coach.totalReviews})</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
                  {coach.bio}
                </p>

                <div className={`grid gap-2 md:gap-3 mb-4 ${coach.hourlyRate > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{coach.yearsOfExperience}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Years Exp</p>
                  </div>
                  {coach.hourlyRate > 0 && (
                    <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${coach.hourlyRate}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Per Hour</p>
                    </div>
                  )}
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <p className={`text-2xl font-bold ${available ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {available ? 'Open' : 'Full'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
                  </div>
                </div>

                {/* Languages */}
                {coach.languages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">LANGUAGES</p>
                    <div className="flex flex-wrap gap-1">
                      {coach.languages.slice(0, 3).map((lang, index) => (
                        <span key={index} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">SPECIALTIES</p>
                  <div className="flex flex-wrap gap-1">
                    {coach.specialties.slice(0, 3).map((spec, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewProfile(coach)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    View Profile
                  </button>
                  <button
                    onClick={() => openBookModal(coach)}
                    disabled={!available}
                    className={`flex-1 py-2.5 rounded-xl font-medium transition shadow-lg ${
                      available
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/30"
                        : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    {available
                      ? rescheduleBooking
                        ? "Select Coach"
                        : "Book Session"
                      : "Full"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Modal */}
      {showProfileModal && selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 my-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white p-4 md:p-8 rounded-t-2xl relative">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <div className="w-32 h-32 rounded-full bg-white text-blue-900 flex items-center justify-center text-5xl font-bold shadow-2xl border-4 border-white/30 overflow-hidden">
                  {selectedCoach.avatarUrl ? (
                    <img src={selectedCoach.avatarUrl} alt={selectedCoach.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedCoach.avatar
                  )}
                </div>
                <div className="text-center md:text-left flex-1">
                  <h2 className="text-2xl md:text-4xl font-bold mb-2">{selectedCoach.name}</h2>
                  <p className="text-xl text-blue-200 mb-4">{selectedCoach.specialty}</p>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm">
                    <span className="bg-white/10 px-3 py-1 rounded-full">
                      ★ {selectedCoach.rating.toFixed(1)} ({selectedCoach.totalReviews} reviews)
                    </span>
                    <span className="bg-white/10 px-3 py-1 rounded-full">
                      {selectedCoach.yearsOfExperience} yrs experience
                    </span>
                    {selectedCoach.hourlyRate > 0 && (
                      <span className="bg-white/10 px-3 py-1 rounded-full">
                        ${selectedCoach.hourlyRate}/hr
                      </span>
                    )}
                    {selectedCoach.languages.map((lang, idx) => (
                      <span key={idx} className="bg-white/10 px-3 py-1 rounded-full">
                        🗣️ {lang}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                <div className="space-y-6">
                  {/* Availability status */}
                  <div className={`p-4 rounded-lg border-l-4 ${isCoachAvailable(selectedCoach) ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500'}`}>
                    <p className="font-bold text-gray-900 dark:text-white mb-1">Availability</p>
                    <p className={`text-sm font-semibold ${isCoachAvailable(selectedCoach) ? 'text-green-700' : 'text-red-700'}`}>
                      {isCoachAvailable(selectedCoach) ? '✅ Accepting Clients' : '❌ Fully Booked'}
                    </p>
                    {selectedCoach.availability && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{selectedCoach.availability}</p>
                    )}
                  </div>

                  {/* Languages */}
                  {selectedCoach.languages?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">Languages</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCoach.languages.map((lang, idx) => (
                          <span key={idx} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-sm rounded-full">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {selectedCoach.education && (
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-2">Education</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCoach.education}</p>
                    </div>
                  )}

                  {/* Pricing */}
                  {selectedCoach.hourlyRate > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">Hourly Rate</h4>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${selectedCoach.hourlyRate}</p>
                      <p className="text-xs text-gray-500">per session</p>
                    </div>
                  )}

                  {isCoachAvailable(selectedCoach) && (
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        openBookModal(selectedCoach);
                      }}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition shadow-xl"
                    >
                      {rescheduleBooking ? "Select for Reschedule" : "Book a Session"}
                    </button>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-8">
                  <section>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b-2 border-blue-500 inline-block">
                      Professional Summary
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{selectedCoach.bio}</p>
                  </section>

                  {selectedCoach.specialties?.length > 0 && (
                    <section>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b-2 border-purple-500 inline-block">
                        Areas of Expertise
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {selectedCoach.specialties.map((spec, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{spec}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedCoach.certifications?.length > 0 && (
                    <section>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b-2 border-yellow-500 inline-block">
                        Certifications
                      </h3>
                      <div className="space-y-3">
                        {selectedCoach.certifications.map((cert, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border-l-4 border-yellow-500">
                            <span className="text-yellow-600 mt-0.5">🏅</span>
                            <div>
                              <span className="font-medium text-gray-800 dark:text-gray-200 block">
                                {typeof cert === 'string' ? cert : cert.title}
                              </span>
                              {typeof cert === 'object' && cert.organization && (
                                <span className="text-sm text-gray-500">{cert.organization}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {selectedCoach.cvUrl && (
                    <section>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 pb-2 border-b-2 border-green-500 inline-block">
                        CV / Resume
                      </h3>
                      <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {selectedCoach.cvUrl.split("/").pop()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Coach resume / CV document</p>
                        </div>
                        <a
                          href={selectedCoach.cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View CV
                        </a>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-b-2xl flex justify-between items-center">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 font-medium transition"
              >
                ← Back
              </button>
              {isCoachAvailable(selectedCoach) && (
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    openBookModal(selectedCoach);
                  }}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition shadow-lg"
                >
                  {rescheduleBooking ? "Select for Reschedule" : "Book Now"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking / Reschedule Modal */}
      {showBookModal && selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {bookingSuccess ? (
              <div className="p-6 md:p-8 text-center">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {rescheduleBooking ? "Session Rescheduled!" : "Booking Confirmed!"}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {rescheduleBooking
                    ? `Your session has been rescheduled with ${selectedCoach.name}.`
                    : `Your session with ${selectedCoach.name} has been scheduled.`}
                </p>
                <p className="text-sm text-gray-400 mt-2">Redirecting to bookings...</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {rescheduleBooking
                        ? bookingStep === 1 ? "Select New Time Slot" : "Confirm Reschedule"
                        : bookingStep === 1 ? "Select Time Slot" : "Confirm Booking"}
                    </h2>
                    <p className="text-gray-500">with {selectedCoach.name}</p>
                    {rescheduleBooking && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Rescheduling: {rescheduleBooking.title}
                      </p>
                    )}
                  </div>
                  <button onClick={closeBookModal} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Step 1: Select Slot */}
                  {bookingStep === 1 && (
                    <div className="space-y-4">
                      {slotsLoading ? (
                        <div className="text-center py-12">
                          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                          <p className="text-gray-500">Loading available slots...</p>
                        </div>
                      ) : Object.keys(slotsByDate).length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                          <div className="text-4xl mb-3">📅</div>
                          <p className="text-gray-600 dark:text-gray-400 font-medium">No available slots</p>
                          <p className="text-sm text-gray-500 mt-1">This coach hasn't posted any availability yet.</p>
                        </div>
                      ) : (
                        Object.entries(slotsByDate).map(([date, slots]) => (
                          <div key={date}>
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                              {formatDate(date)}
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {slots.map(slot => (
                                <button
                                  key={slot.id}
                                  onClick={() => selectSlot(slot)}
                                  className="p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
                                >
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                                    {formatTime(slot.start_time)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    — {formatTime(slot.end_time)}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Step 2: Confirm */}
                  {bookingStep === 2 && (
                    <div className="space-y-6">
                      {/* Selected time summary */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Selected Time</p>
                        <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {formatDate(selectedSlot.date)} · {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}
                        </p>
                        <button
                          onClick={() => setBookingStep(1)}
                          className="text-sm text-blue-600 hover:underline mt-1"
                        >
                          Change time
                        </button>
                      </div>

                      {/* Session type (only for new bookings) */}
                      {!rescheduleBooking && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Session Type
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            {SESSION_TYPES.map(type => (
                              <button
                                key={type.value}
                                onClick={() => setSessionType(type.value)}
                                className={`p-3 rounded-xl border-2 transition ${
                                  sessionType === type.value
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                                }`}
                              >
                                <span className="text-2xl block mb-1">{type.icon}</span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{type.label}</span>
                                <span className="text-xs text-gray-500 block">{type.duration} min</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {rescheduleBooking ? "Reason for Rescheduling (Optional)" : "Notes for Coach (Optional)"}
                        </label>
                        <textarea
                          value={bookingNotes}
                          onChange={(e) => setBookingNotes(e.target.value)}
                          placeholder={
                            rescheduleBooking
                              ? "Why are you rescheduling?"
                              : "Any specific goals, injuries, or requests?"
                          }
                          className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
                          rows={3}
                        />
                      </div>

                      {/* Error */}
                      {bookingError && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                          <p className="text-red-700 dark:text-red-400 text-sm">❌ {bookingError}</p>
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setBookingStep(1)}
                          className="flex-1 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                          Back
                        </button>
                        <button
                          onClick={submitBooking}
                          disabled={bookingLoading}
                          className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {bookingLoading ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              {rescheduleBooking ? "Rescheduling..." : "Booking..."}
                            </>
                          ) : (
                            <>
                              {rescheduleBooking ? "Confirm Reschedule" : "Confirm Booking"}
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}