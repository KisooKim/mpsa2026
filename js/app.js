(function () {
  const MPSA = window.MPSA;
  let PROGRAM = null;
  let STATE = MPSA.storage.loadFilters();
  let ACTIVE_PRESET_ID = MPSA.storage.loadActivePresetId();
  let SAVED_PRESET_SNAPSHOT = null;
  let LAST_SAVED_AT = 0;
  let FAVORITES = MPSA.storage.loadFavorites();
  let FONT_SCALE = MPSA.storage.loadFontScale();
  let HIGH_CONTRAST = MPSA.storage.loadHighContrast();

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
    const filtered = PROGRAM.sessions.filter((s) => MPSA.filters.matches(s, STATE, FAVORITES));
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

  function applyFontScale(scale) {
    FONT_SCALE = scale;
    document.documentElement.style.setProperty("--font-scale", scale);
    MPSA.storage.saveFontScale(scale);
    document.querySelectorAll(".font-btn").forEach((btn) => {
      btn.classList.toggle("active", parseFloat(btn.dataset.scale) === scale);
    });
  }

  function applyHighContrast(on) {
    HIGH_CONTRAST = on;
    document.body.classList.toggle("high-contrast", on);
    MPSA.storage.saveHighContrast(on);
    const btn = document.getElementById("contrast-toggle");
    if (btn) btn.setAttribute("aria-pressed", String(on));
  }

  function initHeaderControls() {
    document.querySelectorAll(".font-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        applyFontScale(parseFloat(btn.dataset.scale));
      });
    });

    const contrastBtn = document.getElementById("contrast-toggle");
    if (contrastBtn) {
      contrastBtn.addEventListener("click", () => {
        applyHighContrast(!HIGH_CONTRAST);
      });
    }

    // Auto-detect system high contrast preference
    const contrastMq = window.matchMedia("(prefers-contrast: more)");
    if (contrastMq.matches && !MPSA.storage.loadHighContrast()) {
      applyHighContrast(true);
    }
    contrastMq.addEventListener("change", (e) => {
      applyHighContrast(e.matches);
    });
  }

  function openDrawer() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("drawer-overlay");
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("visible");
    if (sidebar) sidebar.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("drawer-overlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
    if (sidebar) sidebar.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function initDrawer() {
    const toggle = document.getElementById("drawer-toggle");
    const overlay = document.getElementById("drawer-overlay");

    if (toggle) {
      toggle.addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");
        if (sidebar && sidebar.classList.contains("open")) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (overlay) {
      overlay.addEventListener("click", closeDrawer);
    }

    document.addEventListener("keydown", (e) => {
      const sidebar = document.getElementById("sidebar");
      if (!sidebar || !sidebar.classList.contains("open")) return;

      if (e.key === "Escape") {
        closeDrawer();
        if (toggle) toggle.focus();
        return;
      }

      // Focus trap: keep Tab cycling within the drawer
      if (e.key === "Tab") {
        const focusable = sidebar.querySelectorAll(
          'button, input, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  window.MPSA_APP = {
    getState: () => STATE,
    setState: (next) => { STATE = next; onFiltersChanged(); },
    getProgram: () => PROGRAM,
    getPeopleIndex: () => (PROGRAM ? PROGRAM.peopleIndex : []),
    getAffiliationIndex: () => (PROGRAM ? PROGRAM.affiliationIndex : []),
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
    exportBackup: () => {
      const backup = MPSA.storage.exportAll();
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `mpsa2026-backup-${today}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    importBackup: () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const summary = MPSA.storage.importAll(String(reader.result));
            // Reload in-memory state from the freshly imported localStorage
            STATE = MPSA.storage.loadFilters();
            ACTIVE_PRESET_ID = MPSA.storage.loadActivePresetId();
            FAVORITES = MPSA.storage.loadFavorites();
            snapshotForActive();
            LAST_SAVED_AT = Date.now();
            refreshAll();
            alert(`Imported: ${summary.presets} saved view(s), ${summary.favorites} favorite(s)` + (summary.filters ? ", filter state" : ""));
          } catch (err) {
            alert("Import failed: " + (err && err.message ? err.message : err));
          }
        };
        reader.onerror = () => alert("Could not read file: " + reader.error);
        reader.readAsText(file);
      });
      input.click();
    },
    isFavorite: (sessionId) => MPSA.storage.isFavorite(FAVORITES, sessionId),
    getFavoritesCount: () => FAVORITES.size,
    toggleFavorite: (sessionId) => {
      const nowFav = MPSA.storage.toggleFavorite(FAVORITES, sessionId);
      // Update just the clicked card's star without a full refresh
      const card = document.querySelector(`.session-card[data-session-id="${sessionId}"]`);
      if (card) {
        const star = card.querySelector(".fav-star");
        if (star) {
          star.classList.toggle("on", nowFav);
          star.textContent = "";
          star.title = nowFav ? "Remove from favorites" : "Add to favorites";
          star.setAttribute("aria-label", nowFav ? "Remove from favorites" : "Add to favorites");
        }
      }
      // If "Favorites only" is active, the filter result changes → re-filter main.
      // Otherwise only the sidebar count needs updating.
      if (STATE.favoritesOnly) {
        refresh();
      } else if (MPSA.render.updateSidebarDynamic) {
        // Update the favorites count in the sidebar. Since the Favorites filter
        // section is a static part, we need a partial rebuild that also swaps
        // it. For simplicity do a full sidebar rebuild; scroll is preserved.
        if (MPSA.render.renderSidebar) {
          MPSA.render.renderSidebar(PROGRAM, STATE, MPSA.storage.listPresets(), ACTIVE_PRESET_ID);
        }
      }
    },
    refresh,
    refreshAll,
    closeDrawer,
  };

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("data/program.json");
      if (!res.ok) throw new Error("program.json fetch failed: " + res.status);
      PROGRAM = await res.json();
      PROGRAM.peopleIndex = MPSA.search.buildPeopleIndex(PROGRAM.sessions);
      PROGRAM.affiliationIndex = MPSA.search.buildAffiliationIndex(PROGRAM.sessions);
    } catch (err) {
      const main = document.getElementById("main-content");
      if (main) main.textContent = "Failed to load data/program.json. Run `python3 scripts/parse_mpsa.py --pretty` first.";
      console.error(err);
      return;
    }
    snapshotForActive();
    applyFontScale(FONT_SCALE);
    applyHighContrast(HIGH_CONTRAST);
    initHeaderControls();
    initDrawer();
    // On desktop, sidebar is always visible
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const sidebarEl = document.getElementById("sidebar");
    if (sidebarEl) sidebarEl.setAttribute("aria-hidden", isMobile ? "true" : "false");
    refreshAll();
  });
})();
