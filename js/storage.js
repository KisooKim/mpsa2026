(function (root) {
  const NS = root.MPSA = root.MPSA || {};

  const KEY_FILTERS   = "mpsa2026-filters";
  const KEY_PRESETS   = "mpsa2026-presets";
  const KEY_ACTIVE    = "mpsa2026-active-preset";
  const KEY_FAVORITES     = "mpsa2026-favorites";
  const KEY_FONT_SCALE    = "mpsa2026-font-scale";
  const KEY_HIGH_CONTRAST = "mpsa2026-high-contrast";

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

  // ---- Preferences ----

  function loadFontScale() {
    const val = parseFloat(root.localStorage.getItem(KEY_FONT_SCALE));
    return [0.9, 1.0, 1.3].includes(val) ? val : 1.0;
  }

  function saveFontScale(scale) {
    root.localStorage.setItem(KEY_FONT_SCALE, String(scale));
  }

  function loadHighContrast() {
    return root.localStorage.getItem(KEY_HIGH_CONTRAST) === "true";
  }

  function saveHighContrast(on) {
    root.localStorage.setItem(KEY_HIGH_CONTRAST, String(!!on));
  }

  // ---- Export / Import ----

  const BACKUP_VERSION = 1;

  // Font scale and high contrast are device-level UI preferences,
  // intentionally excluded from export/import (not session data).
  function exportAll() {
    return {
      app: "mpsa2026-viewer",
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      filters: loadFilters(),
      active_preset_id: loadActivePresetId(),
      presets: listPresets(),
      favorites: Array.from(loadFavorites()),
    };
  }

  // Returns a summary of what was imported, or throws on invalid input.
  // Strategy: REPLACE (not merge) — simpler and predictable. User runs the
  // import, and the prior local state is overwritten. They can Export first
  // if they want a safety copy.
  function importAll(raw) {
    let payload = raw;
    if (typeof raw === "string") {
      payload = JSON.parse(raw); // throws SyntaxError if malformed
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("Backup file is not a JSON object");
    }
    if (payload.app !== "mpsa2026-viewer") {
      throw new Error("Not an MPSA viewer backup (missing 'app' field)");
    }
    if (typeof payload.version !== "number" || payload.version > BACKUP_VERSION) {
      throw new Error("Unsupported backup version: " + payload.version);
    }

    const summary = { presets: 0, favorites: 0, filters: false };

    if (payload.filters && typeof payload.filters === "object") {
      saveFilters(payload.filters);
      summary.filters = true;
    }
    if (Array.isArray(payload.presets)) {
      // Replace the entire presets list. Each entry must at minimum have
      // id + name + filters; missing timestamps are backfilled to now.
      const now = Date.now();
      const sanitized = payload.presets
        .filter((p) => p && typeof p === "object" && p.id && p.name && p.filters)
        .map((p) => ({
          id: String(p.id),
          name: String(p.name),
          filters: p.filters,
          createdAt: typeof p.createdAt === "number" ? p.createdAt : now,
          updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : now,
        }));
      savePresetsArray(sanitized);
      summary.presets = sanitized.length;
    }
    if (Array.isArray(payload.favorites)) {
      const set = new Set(payload.favorites.map(String));
      saveFavorites(set);
      summary.favorites = set.size;
    }
    if (typeof payload.active_preset_id === "string") {
      saveActivePresetId(payload.active_preset_id);
    } else if (payload.active_preset_id === null) {
      saveActivePresetId(null);
    }
    return summary;
  }

  NS.storage = {
    emptyFilters, loadFilters, saveFilters,
    listPresets, savePreset, updatePreset, renamePreset, deletePreset,
    loadActivePresetId, saveActivePresetId,
    loadFavorites, saveFavorites, isFavorite, toggleFavorite,
    loadFontScale, saveFontScale, loadHighContrast, saveHighContrast,
    exportAll, importAll,
    BACKUP_VERSION,
  };
})(typeof window !== "undefined" ? window : globalThis);
