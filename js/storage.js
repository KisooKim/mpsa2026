(function (root) {
  const NS = root.MPSA = root.MPSA || {};

  const KEY_FILTERS   = "mpsa2026-filters";
  const KEY_PRESETS   = "mpsa2026-presets";
  const KEY_ACTIVE    = "mpsa2026-active-preset";
  const KEY_FAVORITES = "mpsa2026-favorites";

  function emptyFilters() {
    return { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false };
  }

  function safeParse(raw, fallback) {
    if (raw == null) return fallback;
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function loadFilters() {
    const state = safeParse(root.localStorage.getItem(KEY_FILTERS), null);
    if (!state || typeof state !== "object") return emptyFilters();
    return {
      dates: Array.isArray(state.dates) ? state.dates : [],
      authors: Array.isArray(state.authors) ? state.authors : [],
      divisions: Array.isArray(state.divisions) ? state.divisions : [],
      sessionTypes: Array.isArray(state.sessionTypes) ? state.sessionTypes : [],
      keyword: typeof state.keyword === "string" ? state.keyword : "",
      favoritesOnly: state.favoritesOnly === true,
    };
  }

  function saveFilters(state) {
    root.localStorage.setItem(KEY_FILTERS, JSON.stringify(state));
  }

  function listPresets() {
    const arr = safeParse(root.localStorage.getItem(KEY_PRESETS), []);
    return Array.isArray(arr) ? arr : [];
  }

  function savePresetsArray(arr) {
    root.localStorage.setItem(KEY_PRESETS, JSON.stringify(arr));
  }

  function newId() {
    return "p_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
  }

  function savePreset(name, filters) {
    const now = Date.now();
    const preset = { id: newId(), name: String(name), filters, createdAt: now, updatedAt: now };
    const arr = listPresets();
    arr.push(preset);
    savePresetsArray(arr);
    return preset;
  }

  function updatePreset(id, filters) {
    const arr = listPresets();
    const idx = arr.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("preset not found: " + id);
    arr[idx] = { ...arr[idx], filters, updatedAt: Date.now() };
    savePresetsArray(arr);
    return arr[idx];
  }

  function renamePreset(id, newName) {
    const arr = listPresets();
    const idx = arr.findIndex((p) => p.id === id);
    if (idx < 0) throw new Error("preset not found: " + id);
    arr[idx] = { ...arr[idx], name: String(newName), updatedAt: Date.now() };
    savePresetsArray(arr);
    return arr[idx];
  }

  function deletePreset(id) {
    const arr = listPresets().filter((p) => p.id !== id);
    savePresetsArray(arr);
  }

  function loadActivePresetId() {
    const raw = root.localStorage.getItem(KEY_ACTIVE);
    return raw || null;
  }

  function saveActivePresetId(id) {
    if (id == null) root.localStorage.removeItem(KEY_ACTIVE);
    else root.localStorage.setItem(KEY_ACTIVE, String(id));
  }

  function loadFavorites() {
    const arr = safeParse(root.localStorage.getItem(KEY_FAVORITES), []);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  }

  function saveFavorites(set) {
    root.localStorage.setItem(KEY_FAVORITES, JSON.stringify(Array.from(set)));
  }

  function isFavorite(set, sessionId) {
    return set.has(String(sessionId));
  }

  function toggleFavorite(set, sessionId) {
    const id = String(sessionId);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    saveFavorites(set);
    return set.has(id);
  }

  NS.storage = {
    emptyFilters, loadFilters, saveFilters,
    listPresets, savePreset, updatePreset, renamePreset, deletePreset,
    loadActivePresetId, saveActivePresetId,
    loadFavorites, saveFavorites, isFavorite, toggleFavorite,
  };
})(typeof window !== "undefined" ? window : globalThis);
