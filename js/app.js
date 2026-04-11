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
    if (!PROGRAM) return;
    const filtered = PROGRAM.sessions.filter((s) => MPSA.filters.matches(s, STATE));
    MPSA.render.renderMain(filtered, STATE);
    MPSA.render.renderFilterSummary(STATE, filtered.length, getActivePresetName());
    if (MPSA.render.renderSidebar) {
      MPSA.render.renderSidebar(PROGRAM, STATE, MPSA.storage.listPresets(), ACTIVE_PRESET_ID);
    }
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
      refresh();
    },
    getLastSavedAt: () => LAST_SAVED_AT,
    refresh,
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
    refresh();
  });
})();
