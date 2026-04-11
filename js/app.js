(function () {
  const MPSA = window.MPSA;
  let PROGRAM = null;
  let STATE = MPSA.storage.loadFilters();
  let ACTIVE_PRESET_ID = MPSA.storage.loadActivePresetId();
  let SAVED_PRESET_SNAPSHOT = null;
  let LAST_SAVED_AT = 0;

  function snapshotForActive() {
    if (!ACTIVE_PRESET_ID) { SAVED_PRESET_SNAPSHOT = null; return; }
    const p = MPSA.storage.listPresets().find((x) => x.id === ACTIVE_PRESET_ID);
    SAVED_PRESET_SNAPSHOT = p ? JSON.parse(JSON.stringify(p.filters)) : null;
  }

  function isModified() {
    if (!ACTIVE_PRESET_ID || !SAVED_PRESET_SNAPSHOT) return false;
    return !MPSA.filters.equals(STATE, SAVED_PRESET_SNAPSHOT);
  }

  function getActivePresetName() {
    if (!ACTIVE_PRESET_ID) return null;
    const p = MPSA.storage.listPresets().find((x) => x.id === ACTIVE_PRESET_ID);
    return p ? p.name : null;
  }

  function refresh() {
    // Partial update on every filter change — re-renders the main content,
    // filter summary bar, and the dynamic sidebar regions (Saved Views + footer).
    // The filter checkbox sections are NOT re-rendered, so scroll position and
    // keyword-input focus survive.
    if (!PROGRAM) return;
    const filtered = PROGRAM.sessions.filter((s) => MPSA.filters.matches(s, STATE));
    MPSA.render.renderMain(filtered, STATE);
    MPSA.render.renderFilterSummary(STATE, filtered.length, getActivePresetName());
    if (MPSA.render.updateSidebarDynamic) {
      MPSA.render.updateSidebarDynamic(STATE, MPSA.storage.listPresets(), ACTIVE_PRESET_ID);
    }
  }

  function refreshAll() {
    // Full rebuild: used on initial load and whenever filter state is changed
    // from outside the sidebar (load preset, reset all). The filter checkboxes
    // need to re-render to reflect the new state, so scroll reset is acceptable.
    if (!PROGRAM) return;
    if (MPSA.render.renderSidebar) {
      MPSA.render.renderSidebar(PROGRAM, STATE, MPSA.storage.listPresets(), ACTIVE_PRESET_ID);
    }
    refresh();
  }

  function onFiltersChanged() {
    MPSA.storage.saveFilters(STATE);
    LAST_SAVED_AT = Date.now();
    refresh();
  }

  window.MPSA_APP = {
    getState: () => STATE,
    setState: (next) => { STATE = next; onFiltersChanged(); },
    getProgram: () => PROGRAM,
    getPeopleIndex: () => (PROGRAM ? PROGRAM.peopleIndex : []),
    getActivePresetId: () => ACTIVE_PRESET_ID,
    setActivePresetId: (id) => {
      ACTIVE_PRESET_ID = id;
      MPSA.storage.saveActivePresetId(id);
      snapshotForActive();
      refresh();
    },
    isPresetModified: () => isModified(),
    updateActivePreset: () => {
      if (!ACTIVE_PRESET_ID) return;
      const p = MPSA.storage.updatePreset(ACTIVE_PRESET_ID, STATE);
      SAVED_PRESET_SNAPSHOT = JSON.parse(JSON.stringify(p.filters));
      refresh();
    },
    saveAsNew: (name) => {
      const p = MPSA.storage.savePreset(name, STATE);
      ACTIVE_PRESET_ID = p.id;
      MPSA.storage.saveActivePresetId(p.id);
      SAVED_PRESET_SNAPSHOT = JSON.parse(JSON.stringify(p.filters));
      refresh();
    },
    loadPreset: (preset) => {
      STATE = preset.filters;
      ACTIVE_PRESET_ID = preset.id;
      MPSA.storage.saveFilters(STATE);
      MPSA.storage.saveActivePresetId(preset.id);
      LAST_SAVED_AT = Date.now();
      SAVED_PRESET_SNAPSHOT = JSON.parse(JSON.stringify(preset.filters));
      // Full sidebar rebuild — filter checkbox states need to reflect the
      // new preset state since the user didn't click the checkboxes directly.
      refreshAll();
    },
    resetAll: () => {
      STATE = MPSA.filters.emptyState();
      ACTIVE_PRESET_ID = null;
      MPSA.storage.saveFilters(STATE);
      MPSA.storage.saveActivePresetId(null);
      LAST_SAVED_AT = Date.now();
      SAVED_PRESET_SNAPSHOT = null;
      refreshAll();
    },
    getLastSavedAt: () => LAST_SAVED_AT,
    refresh,
    refreshAll,
  };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("data/program.json");
      if (!res.ok) throw new Error("program.json fetch failed: " + res.status);
      PROGRAM = await res.json();
      PROGRAM.peopleIndex = MPSA.search.buildPeopleIndex(PROGRAM.sessions);
    } catch (err) {
      const main = document.getElementById("main-content");
      if (main) main.textContent = "Failed to load data/program.json. Run `python3 scripts/parse_mpsa.py --pretty` first.";
      console.error(err);
      return;
    }
    snapshotForActive();
    refreshAll();
  });
})();
