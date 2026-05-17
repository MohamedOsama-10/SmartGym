// src/pages/coach/CoachProfile.jsx
import { useState, useRef, useEffect } from "react";
import { profileAPI } from "../../services/api";

// ─── helpers ─────────────────────────────────────────────────────────────────

const normalizeProfile = (raw) => ({
  name:              raw.name         || raw.full_name   || "",
  email:             raw.email        || "",
  phone:             raw.phone        || "",
  bio:               raw.bio          || "",
  specialties:       Array.isArray(raw.specialties)
                       ? raw.specialties
                       : raw.specialty
                         ? [raw.specialty]
                         : [],
  yearsOfExperience: raw.experience_years || raw.yearsOfExperience || 0,
  rating:            raw.rating       || 0,
  totalClients:      raw.total_clients || raw.current_clients || 0,
  successStories:    raw.success_stories  || 0,
  hourlyRate:        raw.hourly_rate  || raw.rate || 0,
  isAvailable:       raw.is_available ?? true,
  photo:             null,
  photoPreview:      raw.avatar_url   || null,
  certifications:    (raw.certifications || []).map((c) => ({
    id:            c.id,
    name:          c.name || c.certification_name || "",
    issuer:        c.issuer || c.issuing_organization || "",
    dateObtained:  c.date_obtained || c.dateObtained || "",
    expiryDate:    c.expiry_date   || c.expiryDate   || "",
    credentialId:  c.credential_id || c.credentialId || "",
    verified:      c.verified ?? false,
  })),
  education: (raw.education || []).map((e) => ({
    id:              e.id,
    degree:          e.degree || "",
    institution:     e.institution || "",
    graduationYear:  e.graduation_year || e.years || "",
    fieldOfStudy:    e.field_of_study  || e.fieldOfStudy || "",
  })),
  experience: (raw.experience || []).map((ex) => ({
    id:          ex.id,
    position:    ex.title    || ex.position    || "",
    company:     ex.company  || "",
    startDate:   ex.start_date || ex.startDate || "",
    endDate:     ex.end_date   || ex.endDate   || (ex.current ? "Present" : ""),
    description: ex.description || "",
    current:     ex.current ?? false,
  })),
  cv:          null,
  cvFileName:  raw.cv_url ? raw.cv_url.split("/").pop() : null,
  cvUrl:       raw.cv_url || null,
  socialMedia: {
    instagram: raw.instagram || "",
    facebook:  raw.facebook  || "",
    youtube:   raw.youtube   || "",
    linkedin:  raw.linkedin  || "",
  },
});

// ─── component ───────────────────────────────────────────────────────────────

export default function CoachProfile() {
  const cvInputRef    = useRef(null);
  const photoInputRef = useRef(null);

  const [profile,    setProfile]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);
  const [saveMsg,    setSaveMsg]    = useState(null);

  const [activeTab,  setActiveTab]  = useState("overview");
  const [isEditing,  setIsEditing]  = useState(false);
  const [editDraft,  setEditDraft]  = useState(null); // editable copy

  const [showAddCertModal,       setShowAddCertModal]       = useState(false);
  const [showAddEducationModal,  setShowAddEducationModal]  = useState(false);
  const [showAddExperienceModal, setShowAddExperienceModal] = useState(false);

  const [newCert, setNewCert] = useState({
    name: "", issuer: "", dateObtained: "", expiryDate: "", credentialId: ""
  });
  const [newEducation, setNewEducation] = useState({
    degree: "", institution: "", graduationYear: "", fieldOfStudy: ""
  });
  const [newExperience, setNewExperience] = useState({
    position: "", company: "", startDate: "", endDate: "", description: "", current: false
  });

  // ── fetch profile on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const raw = await profileAPI.getCoachProfile();
        setProfile(normalizeProfile(raw));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── save / edit toggle ──────────────────────────────────────────────────────
  const handleEditToggle = async () => {
    if (!isEditing) {
      setEditDraft({ ...profile });
      setIsEditing(true);
      return;
    }

    // Save
    setSaving(true);
    try {
      const payload = {
        bio:             editDraft.bio,
        phone:           editDraft.phone,
        specialty:       editDraft.specialties[0] || "",
        specialties:     editDraft.specialties,
        experience_years: Number(editDraft.yearsOfExperience),
        hourly_rate:     Number(editDraft.hourlyRate),
        is_available:    editDraft.isAvailable,
        instagram:       editDraft.socialMedia.instagram,
        facebook:        editDraft.socialMedia.facebook,
        youtube:         editDraft.socialMedia.youtube,
        linkedin:        editDraft.socialMedia.linkedin,
      };

      await profileAPI.updateCoachProfile(payload);

      // Upload avatar if changed (use coach-specific endpoint)
      if (editDraft.photo) {
        const formData = new FormData();
        formData.append("avatar", editDraft.photo);
        const res = await profileAPI.uploadCoachAvatar(formData);
        editDraft.photoPreview = res.avatar_url || editDraft.photoPreview;
      }

      setProfile({ ...editDraft });
      setIsEditing(false);
      setSaveMsg("Profile saved successfully!");
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      alert("Failed to save profile: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── photo upload (preview only, sent on save) ───────────────────────────────
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image size must be less than 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) =>
      setEditDraft((d) => ({ ...d, photo: file, photoPreview: ev.target.result }));
    reader.readAsDataURL(file);
  };

  // ── CV upload ──────────────────────────────────────────────────────────────
  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) { alert("Please upload a PDF or Word document"); return; }
    if (file.size > 10 * 1024 * 1024) { alert("File size must be less than 10MB"); return; }
    try {
      const formData = new FormData();
      formData.append("cv", file);
      const res = await profileAPI.uploadCoachCV(formData);
      setProfile((p) => ({ ...p, cvFileName: res.filename || file.name, cvUrl: res.cv_url }));
    } catch (err) {
      alert("CV upload failed: " + err.message);
    }
  };

  // ── certifications ──────────────────────────────────────────────────────────
  const handleAddCertification = async () => {
    if (!newCert.name || !newCert.issuer || !newCert.dateObtained) {
      alert("Please fill in all required fields"); return;
    }
    try {
      const saved = await profileAPI.addCertification({
        name:          newCert.name,
        issuer:        newCert.issuer,
        date_obtained: newCert.dateObtained,
        expiry_date:   newCert.expiryDate   || null,
        credential_id: newCert.credentialId || null,
      });
      const cert = {
        id:           saved.id,
        name:         saved.name || saved.certification_name || newCert.name,
        issuer:       saved.issuer || saved.issuing_organization || newCert.issuer,
        dateObtained: saved.date_obtained || newCert.dateObtained,
        expiryDate:   saved.expiry_date   || newCert.expiryDate || "",
        credentialId: saved.credential_id || newCert.credentialId || "",
        verified:     saved.verified ?? false,
      };
      setProfile((p) => ({ ...p, certifications: [...p.certifications, cert] }));
      setNewCert({ name: "", issuer: "", dateObtained: "", expiryDate: "", credentialId: "" });
      setShowAddCertModal(false);
    } catch (e) {
      alert("Failed to add certification: " + e.message);
    }
  };

  const handleDeleteCertification = async (id) => {
    if (!confirm("Are you sure you want to delete this certification?")) return;
    try {
      await profileAPI.deleteCertification(id);
      setProfile((p) => ({ ...p, certifications: p.certifications.filter((c) => c.id !== id) }));
    } catch (e) {
      alert("Failed to delete certification: " + e.message);
    }
  };

  // ── education ───────────────────────────────────────────────────────────────
  const handleAddEducation = async () => {
    if (!newEducation.degree || !newEducation.institution || !newEducation.graduationYear) {
      alert("Please fill in all required fields"); return;
    }
    try {
      const saved = await profileAPI.addEducation({
        degree:          newEducation.degree,
        institution:     newEducation.institution,
        graduation_year: newEducation.graduationYear ? Number(newEducation.graduationYear) : null,
        field_of_study:  newEducation.fieldOfStudy || null,
      });
      const edu = {
        id:             saved.id,
        degree:         saved.degree         || newEducation.degree,
        institution:    saved.institution    || newEducation.institution,
        graduationYear: saved.graduation_year || newEducation.graduationYear,
        fieldOfStudy:   saved.field_of_study  || newEducation.fieldOfStudy || "",
      };
      setProfile((p) => ({ ...p, education: [...p.education, edu] }));
      setNewEducation({ degree: "", institution: "", graduationYear: "", fieldOfStudy: "" });
      setShowAddEducationModal(false);
    } catch (e) {
      alert("Failed to add education: " + e.message);
    }
  };

  const handleDeleteEducation = async (id) => {
    if (!confirm("Are you sure you want to delete this education entry?")) return;
    try {
      await profileAPI.deleteEducation(id);
      setProfile((p) => ({ ...p, education: p.education.filter((e) => e.id !== id) }));
    } catch (e) {
      alert("Failed to delete education: " + e.message);
    }
  };

  // ── experience ──────────────────────────────────────────────────────────────
  const handleAddExperience = async () => {
    if (!newExperience.position || !newExperience.company || !newExperience.startDate) {
      alert("Please fill in all required fields"); return;
    }
    try {
      const saved = await profileAPI.addExperience({
        position:    newExperience.position,
        company:     newExperience.company,
        start_date:  newExperience.startDate || null,
        end_date:    newExperience.current ? null : (newExperience.endDate || null),
        description: newExperience.description || null,
        current:     newExperience.current ?? false,
      });
      const exp = {
        id:          saved.id,
        position:    saved.position    || newExperience.position,
        company:     saved.company     || newExperience.company,
        startDate:   saved.start_date  || newExperience.startDate,
        endDate:     saved.current     ? "Present" : (saved.end_date || newExperience.endDate || ""),
        description: saved.description || newExperience.description || "",
        current:     saved.current     ?? newExperience.current,
      };
      setProfile((p) => ({ ...p, experience: [...p.experience, exp] }));
      setNewExperience({ position: "", company: "", startDate: "", endDate: "", description: "", current: false });
      setShowAddExperienceModal(false);
    } catch (e) {
      alert("Failed to add experience: " + e.message);
    }
  };

  const handleDeleteExperience = async (id) => {
    if (!confirm("Are you sure you want to delete this experience entry?")) return;
    try {
      await profileAPI.deleteExperience(id);
      setProfile((p) => ({ ...p, experience: p.experience.filter((e) => e.id !== id) }));
    } catch (e) {
      alert("Failed to delete experience: " + e.message);
    }
  };

  // ── current data source (editing uses draft, otherwise profile) ─────────────
  const data = isEditing ? editDraft : profile;
  const setData = (fn) => (isEditing ? setEditDraft(fn) : setProfile(fn));

  // ── loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 font-semibold mb-2">Failed to load profile</p>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h2>
          <p className="text-gray-600 dark:text-gray-400">Manage your professional profile and credentials</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className="text-green-600 dark:text-green-400 text-sm font-medium">{saveMsg}</span>
          )}
          {isEditing && (
            <button
              onClick={() => { setIsEditing(false); setEditDraft(null); }}
              className="px-5 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleEditToggle}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : isEditing ? (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Save Profile</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> Edit Profile</>
            )}
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 relative">
          <div className="absolute inset-0 bg-black/10"></div>
        </div>

        <div className="px-6 pb-6">
          <div className="flex flex-col md:flex-row gap-6 -mt-16">
            {/* Photo */}
            <div className="relative">
              <div className="w-32 h-32 rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-xl">
                {data.photoPreview ? (
                  <img src={data.photoPreview} alt="Profile" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                    {data.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                )}
              </div>
              {isEditing && (
                <>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute bottom-2 right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pt-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{data.name}</h1>

                  {isEditing ? (
                    <textarea
                      value={editDraft.bio}
                      onChange={(e) => setEditDraft((d) => ({ ...d, bio: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none text-sm mb-3"
                      placeholder="Write your bio…"
                    />
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{data.bio}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {data.specialties.map((s, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-sm font-medium">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {data.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {isEditing ? (
                        <input
                          value={editDraft.phone}
                          onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      ) : data.phone}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Years Exp", value: data.yearsOfExperience, color: "orange" },
                    { label: "Clients",   value: data.totalClients,      color: "blue"   },
                    { label: "Rating",    value: data.rating,            color: "yellow" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`text-center p-3 bg-${color}-50 dark:bg-${color}-900/20 rounded-xl`}>
                      <p className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {[
            { id: "overview",        label: "Overview",       icon: "👤" },
            { id: "certifications",  label: "Certifications", icon: "🏆" },
            { id: "education",       label: "Education",      icon: "🎓" },
            { id: "experience",      label: "Experience",     icon: "💼" },
            { id: "cv",              label: "CV/Resume",      icon: "📄" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-max px-6 py-4 font-medium transition-all relative ${
                activeTab === tab.id
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Social Media */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Social Media
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(data.socialMedia).map(([platform, handle]) => (
                    <div key={platform} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mb-1">{platform}</p>
                      {isEditing ? (
                        <input
                          value={editDraft.socialMedia[platform]}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              socialMedia: { ...d.socialMedia, [platform]: e.target.value },
                            }))
                          }
                          className="w-full px-2 py-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder={`@${platform}`}
                        />
                      ) : (
                        <p className="font-medium text-gray-900 dark:text-white truncate">{handle || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: data.successStories, label: "Success Stories", color: "green",  icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
                    { value: data.totalClients,   label: "Total Clients",   color: "blue",   icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
                    { value: data.rating,         label: "Avg Rating",      color: "yellow", icon: null },
                  ].map(({ value, label, color, icon }) => (
                    <div key={label} className={`p-6 bg-gradient-to-br from-${color}-50 to-${color === "yellow" ? "orange" : color}-50 dark:from-${color}-900/20 dark:to-${color === "yellow" ? "orange" : color}-900/10 rounded-xl border border-${color}-200 dark:border-${color}-800`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-12 h-12 bg-${color}-100 dark:bg-${color}-900 rounded-xl flex items-center justify-center`}>
                          {icon ? (
                            <svg className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                            </svg>
                          ) : (
                            <svg className={`w-6 h-6 text-${color}-600 dark:text-${color}-400`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <p className={`text-2xl md:text-3xl font-black text-${color}-600 dark:text-${color}-400`}>{value}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hourly Rate / Experience (editable) */}
              {isEditing && (
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Coaching Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hourly Rate (EGP)</label>
                      <input
                        type="number"
                        value={editDraft.hourlyRate}
                        onChange={(e) => setEditDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Years of Experience</label>
                      <input
                        type="number"
                        value={editDraft.yearsOfExperience}
                        onChange={(e) => setEditDraft((d) => ({ ...d, yearsOfExperience: e.target.value }))}
                        className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CERTIFICATIONS ── */}
          {activeTab === "certifications" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Professional Certifications</h3>
                <button onClick={() => setShowAddCertModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Certification
                </button>
              </div>
              <div className="space-y-3">
                {profile.certifications.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No certifications added yet.</p>
                )}
                {profile.certifications.map((cert) => (
                  <div key={cert.id} className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-900 dark:text-white">{cert.name}</h4>
                          {cert.verified && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">✓ Verified</span>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">{cert.issuer}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          {cert.dateObtained && (
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Obtained</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(cert.dateObtained + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                              </p>
                            </div>
                          )}
                          {cert.expiryDate && (
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Expires</p>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {new Date(cert.expiryDate + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                              </p>
                            </div>
                          )}
                          {cert.credentialId && (
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Credential ID</p>
                              <p className="font-medium text-gray-900 dark:text-white">{cert.credentialId}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteCertification(cert.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EDUCATION ── */}
          {activeTab === "education" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Education Background</h3>
                <button onClick={() => setShowAddEducationModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Education
                </button>
              </div>
              <div className="space-y-3">
                {profile.education.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No education entries added yet.</p>
                )}
                {profile.education.map((edu) => (
                  <div key={edu.id} className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 dark:text-white mb-1">{edu.degree}</h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">{edu.institution}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Graduated: {edu.graduationYear}</span>
                          {edu.fieldOfStudy && <>
                            <span className="text-gray-400">•</span>
                            <span className="text-gray-500 dark:text-gray-400">{edu.fieldOfStudy}</span>
                          </>}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteEducation(edu.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EXPERIENCE ── */}
          {activeTab === "experience" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Work Experience</h3>
                <button onClick={() => setShowAddExperienceModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add Experience
                </button>
              </div>
              <div className="space-y-3">
                {profile.experience.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No experience entries added yet.</p>
                )}
                {profile.experience.map((exp) => (
                  <div key={exp.id} className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 dark:text-white">{exp.position}</h4>
                          {exp.current && (
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">Current</span>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">{exp.company}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                          {exp.startDate} – {exp.endDate || "Present"}
                        </p>
                        {exp.description && <p className="text-gray-700 dark:text-gray-300">{exp.description}</p>}
                      </div>
                      <button onClick={() => handleDeleteExperience(exp.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CV ── */}
          {activeTab === "cv" && (
            <div className="space-y-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">CV/Resume</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Upload your CV or resume. Accepted formats: PDF, DOC, DOCX (Max 10MB)
              </p>
              <input ref={cvInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleCVUpload} className="hidden" />

              {profile.cv || profile.cvFileName ? (
                <div className="p-6 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-1">{profile.cvFileName || "Resume.pdf"}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {profile.cvUrl ? "Uploaded to server" : "Pending upload"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {profile.cvUrl && (
                        <a
                          href={profile.cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium shadow"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Open CV
                        </a>
                      )}
                      <button onClick={() => cvInputRef.current?.click()} className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 transition text-sm font-medium">
                        Replace
                      </button>
                      <button onClick={() => setProfile((p) => ({ ...p, cv: null, cvFileName: null, cvUrl: null }))} className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition text-sm font-medium">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => cvInputRef.current?.click()}
                  className="w-full p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition group"
                >
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 transition">
                      <svg className="w-10 h-10 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Upload Your CV/Resume</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Click to browse or drag and drop</p>
                  </div>
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Add Certification Modal ── */}
      {showAddCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Certification</h3>
              <button onClick={() => setShowAddCertModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: "name",         label: "Certification Name",     required: true, placeholder: "e.g., NASM Certified Personal Trainer" },
                { key: "issuer",       label: "Issuing Organization",   required: true, placeholder: "e.g., National Academy of Sports Medicine" },
                { key: "credentialId", label: "Credential ID",          required: false, placeholder: "e.g., CPT-123456" },
              ].map(({ key, label, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={newCert[key]}
                    onChange={(e) => setNewCert({ ...newCert, [key]: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "dateObtained", label: "Date Obtained", required: true },
                  { key: "expiryDate",   label: "Expiry Date",   required: false },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="month"
                      value={newCert[key]}
                      onChange={(e) => setNewCert({ ...newCert, [key]: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddCertModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                <button onClick={handleAddCertification} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition">Add Certification</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Education Modal ── */}
      {showAddEducationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Education</h3>
              <button onClick={() => setShowAddEducationModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: "degree",      label: "Degree/Diploma",   required: true,  placeholder: "e.g., Bachelor of Science in Kinesiology" },
                { key: "institution", label: "Institution",       required: true,  placeholder: "e.g., Cairo University" },
              ].map(({ key, label, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
                  <input type="text" value={newEducation[key]} onChange={(e) => setNewEducation({ ...newEducation, [key]: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder={placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Graduation Year <span className="text-red-500">*</span></label>
                  <input type="text" value={newEducation.graduationYear} onChange={(e) => setNewEducation({ ...newEducation, graduationYear: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="2015" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Field of Study</label>
                  <input type="text" value={newEducation.fieldOfStudy} onChange={(e) => setNewEducation({ ...newEducation, fieldOfStudy: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="e.g., Exercise Science" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddEducationModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                <button onClick={handleAddEducation} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition">Add Education</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Experience Modal ── */}
      {showAddExperienceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Add Experience</h3>
              <button onClick={() => setShowAddExperienceModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { key: "position", label: "Position",   required: true, placeholder: "e.g., Senior Personal Trainer" },
                { key: "company",  label: "Company/Gym", required: true, placeholder: "e.g., Elite Fitness Center" },
              ].map(({ key, label, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label} {required && <span className="text-red-500">*</span>}</label>
                  <input type="text" value={newExperience[key]} onChange={(e) => setNewExperience({ ...newExperience, [key]: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder={placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date <span className="text-red-500">*</span></label>
                  <input type="month" value={newExperience.startDate} onChange={(e) => setNewExperience({ ...newExperience, startDate: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                  <input type="month" value={newExperience.endDate} onChange={(e) => setNewExperience({ ...newExperience, endDate: e.target.value })} disabled={newExperience.current} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="current-exp" checked={newExperience.current} onChange={(e) => setNewExperience({ ...newExperience, current: e.target.checked, endDate: e.target.checked ? "" : newExperience.endDate })} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" />
                <label htmlFor="current-exp" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">I currently work here</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea value={newExperience.description} onChange={(e) => setNewExperience({ ...newExperience, description: e.target.value })} className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none" rows={4} placeholder="Describe your responsibilities and achievements…" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddExperienceModal(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition">Cancel</button>
                <button onClick={handleAddExperience} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition">Add Experience</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}