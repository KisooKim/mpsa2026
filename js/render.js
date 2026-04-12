(function (root) {
  const NS = root.MPSA = root.MPSA || {};
  const document = root.document;

  const DAY_NAMES = {
    "2026-04-23": "Thursday, April 23",
    "2026-04-24": "Friday, April 24",
    "2026-04-25": "Saturday, April 25",
    "2026-04-26": "Sunday, April 26",
  };

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function groupByDayAndTime(sessions) {
    const byDay = new Map();
    for (const s of sessions) {
      if (!byDay.has(s.date)) byDay.set(s.date, new Map());
      const byTime = byDay.get(s.date);
      const key = s.start_time || "unknown";
      if (!byTime.has(key)) byTime.set(key, { label: s.time_slot || key, items: [] });
      byTime.get(key).items.push(s);
    }
    const daysOrdered = Array.from(byDay.keys()).sort();
    return daysOrdered.map((day) => {
      const byTime = byDay.get(day);
      const times = Array.from(byTime.keys()).sort().map((t) => byTime.get(t));
      return { day, times };
    });
  }

  function renderPersonList(parent, label, people) {
    if (!people || people.length === 0) return;
    parent.appendChild(el("div", "detail-label", label));
    for (const p of people) {
      const txt = p.affiliation ? `${p.name} (${p.affiliation})` : p.name;
      parent.appendChild(el("div", "detail-person", txt));
    }
  }

  function renderSessionCard(session) {
    const card = el("div", "session-card");
    card.dataset.sessionId = session.id;

    const isFav = window.MPSA_APP.isFavorite(session.id);
    const star = el("button", "fav-star" + (isFav ? " on" : ""));
    star.title = isFav ? "Remove from favorites" : "Add to favorites";
    star.addEventListener("click", (e) => {
      e.stopPropagation();
      window.MPSA_APP.toggleFavorite(session.id);
    });
    card.appendChild(star);

    const title = el("div", "session-title", session.title);
    card.appendChild(title);

    const meta = el("div", "session-meta");
    if (session.division) meta.appendChild(el("span", "division-tag", session.division));
    if (session.session_type) meta.appendChild(el("span", null, session.session_type));
    if (session.room) meta.appendChild(el("span", null, session.room));
    if (session.papers && session.papers.length) {
      meta.appendChild(el("span", null, `${session.papers.length} paper${session.papers.length === 1 ? "" : "s"}`));
    }
    card.appendChild(meta);

    const detail = el("div", "session-detail");
    renderPersonList(detail, "Chair", session.chair);
    renderPersonList(detail, "Co-chair", session.co_chair);
    renderPersonList(detail, "Discussant", session.discussant);
    renderPersonList(detail, "Participants", session.participants);
    if (session.papers && session.papers.length) {
      detail.appendChild(el("div", "detail-label", "Papers"));
      for (const paper of session.papers) {
        const row = el("div", "detail-paper");
        row.appendChild(document.createTextNode("• " + (paper.title || "")));
        const authorNames = (paper.authors || [])
          .map((a) => a.affiliation ? `${a.name} (${a.affiliation})` : a.name)
          .join(", ");
        if (authorNames) {
          const au = el("span", "author", "  — " + authorNames);
          row.appendChild(au);
        }
        detail.appendChild(row);
      }
    }
    card.appendChild(detail);

    card.addEventListener("click", (e) => {
      e.stopPropagation();
      card.classList.toggle("expanded");
    });

    return card;
  }

  function renderEmptyState(container) {
    container.innerHTML = "";
    const wrap = el("div", "empty-state");
    const inner = el("div", "empty-state-inner");
    inner.appendChild(el("div", "empty-icon", "🗂️"));
    inner.appendChild(el("h2", null, "MPSA 2026 Program"));
    inner.appendChild(el("p", null, "Filter sessions by author, division, topic, or date to build your schedule."));
    const hint = el("div", "empty-hint");
    hint.innerHTML = "<strong>← Pick filters in the sidebar.</strong><br>★ sessions to build a favorites list, save combinations as Saved Views.";
    inner.appendChild(hint);
    wrap.appendChild(inner);
    container.appendChild(wrap);
  }

  function renderMain(filteredSessions, state) {
    const container = document.getElementById("main-content");
    if (!container) return;
    container.innerHTML = "";
    if (NS.filters.isEmpty(state)) {
      renderEmptyState(container);
      return;
    }
    if (filteredSessions.length === 0) {
      const none = el("div", "empty-state");
      const inner = el("div", "empty-state-inner");
      inner.appendChild(el("h2", null, "No sessions match"));
      inner.appendChild(el("p", null, "Try removing one of the filters."));
      none.appendChild(inner);
      container.appendChild(none);
      return;
    }
    const grouped = groupByDayAndTime(filteredSessions);
    for (const { day, times } of grouped) {
      const section = el("section", "day-section");
      section.appendChild(el("h2", "day-section-header", DAY_NAMES[day] || day));
      for (const slot of times) {
        const row = el("div", "time-row");
        row.appendChild(el("div", "time-label", slot.label));
        const slotEl = el("div", "time-slot");
        for (const s of slot.items) slotEl.appendChild(renderSessionCard(s));
        row.appendChild(slotEl);
        section.appendChild(row);
      }
      container.appendChild(section);
    }
  }

  function chipEl(text) {
    return el("span", "summary-chip", text);
  }

  // ── Sidebar helpers ──────────────────────────────────────────────────────────

  const DAY_LIST = [
    { iso: "2026-04-23", short: "Thu", label: "Thu Apr 23" },
    { iso: "2026-04-24", short: "Fri", label: "Fri Apr 24" },
    { iso: "2026-04-25", short: "Sat", label: "Sat Apr 25" },
    { iso: "2026-04-26", short: "Sun", label: "Sun Apr 26" },
  ];

  function countByDay(program) {
    const counts = {};
    for (const s of program.sessions || []) {
      counts[s.date] = (counts[s.date] || 0) + 1;
    }
    return counts;
  }

  function sectionEl(title) {
    const section = el("section", "sidebar-section");
    section.appendChild(el("h4", null, title));
    return section;
  }

  function favoritesFilterSection(state) {
    const section = sectionEl("⭐ Favorites");
    const row = el("label", "check-row");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!state.favoritesOnly;
    cb.addEventListener("change", () => {
      window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), favoritesOnly: cb.checked });
    });
    row.appendChild(cb);
    row.appendChild(document.createTextNode(" Show favorites only"));
    const count = window.MPSA_APP.getFavoritesCount();
    if (count > 0) {
      row.appendChild(el("span", "count", String(count)));
    }
    section.appendChild(row);
    return section;
  }

  function dateFilterSection(program, state) {
    const section = sectionEl("📅 Date");
    const counts = countByDay(program);
    for (const day of DAY_LIST) {
      const row = el("label", "check-row");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = day.iso;
      cb.checked = (state.dates || []).includes(day.iso);
      cb.addEventListener("change", () => {
        const current = new Set(window.MPSA_APP.getState().dates || []);
        if (cb.checked) current.add(day.iso); else current.delete(day.iso);
        window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), dates: Array.from(current).sort() });
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(" " + day.label));
      if (counts[day.iso]) {
        const c = el("span", "count", String(counts[day.iso]));
        row.appendChild(c);
      }
      section.appendChild(row);
    }
    return section;
  }

  function countByField(program, field) {
    const counts = {};
    for (const s of program.sessions || []) {
      const v = s[field];
      if (v) counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }

  function divisionFilterSection(program, state) {
    const section = sectionEl("Division");
    const search = document.createElement("input");
    search.type = "text";
    search.className = "sidebar-search";
    search.placeholder = "Filter divisions…";
    section.appendChild(search);

    const list = el("div", "check-list");
    section.appendChild(list);
    const counts = countByField(program, "division");

    function renderList() {
      list.innerHTML = "";
      const q = search.value.trim().toLowerCase();
      for (const div of program.divisions || []) {
        if (q && !div.toLowerCase().includes(q)) continue;
        const row = el("label", "check-row");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = div;
        cb.checked = (state.divisions || []).includes(div);
        cb.addEventListener("change", () => {
          const current = new Set(window.MPSA_APP.getState().divisions || []);
          if (cb.checked) current.add(div); else current.delete(div);
          window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), divisions: Array.from(current).sort() });
        });
        row.appendChild(cb);
        row.appendChild(document.createTextNode(" " + div));
        if (counts[div]) row.appendChild(el("span", "count", String(counts[div])));
        list.appendChild(row);
      }
    }
    search.addEventListener("input", renderList);
    renderList();
    return section;
  }

  function sessionTypeFilterSection(program, state) {
    const section = sectionEl("Session Type");
    const counts = countByField(program, "session_type");
    for (const t of program.session_types || []) {
      const row = el("label", "check-row");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = (state.sessionTypes || []).includes(t);
      cb.addEventListener("change", () => {
        const current = new Set(window.MPSA_APP.getState().sessionTypes || []);
        if (cb.checked) current.add(t); else current.delete(t);
        window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), sessionTypes: Array.from(current).sort() });
      });
      row.appendChild(cb);
      row.appendChild(document.createTextNode(" " + t));
      if (counts[t]) row.appendChild(el("span", "count", String(counts[t])));
      section.appendChild(row);
    }
    return section;
  }

  function keywordFilterSection(state) {
    const section = sectionEl("Topic / Keyword");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar-search";
    input.placeholder = "e.g. democracy populism";
    input.value = state.keyword || "";
    input.addEventListener("input", () => {
      window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), keyword: input.value });
    });
    section.appendChild(input);
    return section;
  }

  function chipButton(label, onRemove) {
    const span = el("span", "chip", "× " + label);
    span.addEventListener("click", (e) => { e.stopPropagation(); onRemove(); });
    return span;
  }

  function authorFilterSection(state) {
    const section = sectionEl("Author");
    const wrap = el("div", "author-wrap");
    section.appendChild(wrap);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar-search";
    input.placeholder = "Type a name…";
    wrap.appendChild(input);

    const dropdown = el("div", "author-dropdown");
    wrap.appendChild(dropdown);

    const chips = el("div", "chip-list");
    wrap.appendChild(chips);

    function rebuildChips() {
      chips.innerHTML = "";
      for (const n of (window.MPSA_APP.getState().authors || [])) {
        chips.appendChild(chipButton(n, () => {
          const next = (window.MPSA_APP.getState().authors || []).filter((a) => a !== n);
          window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), authors: next });
          rebuildChips();
        }));
      }
    }
    rebuildChips();

    function renderDropdown() {
      dropdown.innerHTML = "";
      const q = input.value.trim();
      if (!q) return;
      const results = NS.search.matchPeople(window.MPSA_APP.getPeopleIndex(), q, 8);
      for (const r of results) {
        const row = el("div", "dd-item");
        const name = el("div", "dd-name", r.name);
        row.appendChild(name);
        if (r.affiliation) row.appendChild(el("div", "dd-affil", r.affiliation));
        row.addEventListener("click", () => {
          const next = new Set(window.MPSA_APP.getState().authors || []);
          next.add(r.name);
          window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), authors: Array.from(next).sort() });
          input.value = "";
          dropdown.innerHTML = "";
          rebuildChips();
        });
        dropdown.appendChild(row);
      }
    }
    input.addEventListener("input", renderDropdown);
    input.addEventListener("blur", () => setTimeout(() => { dropdown.innerHTML = ""; }, 150));
    return section;
  }

  function affiliationFilterSection(state) {
    const section = sectionEl("Affiliation");
    const wrap = el("div", "author-wrap");
    section.appendChild(wrap);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "sidebar-search";
    input.placeholder = "Type a school / institution…";
    wrap.appendChild(input);

    const dropdown = el("div", "author-dropdown");
    wrap.appendChild(dropdown);

    const chips = el("div", "chip-list");
    wrap.appendChild(chips);

    function rebuildChips() {
      chips.innerHTML = "";
      for (const name of (window.MPSA_APP.getState().affiliations || [])) {
        chips.appendChild(chipButton(name, () => {
          const next = (window.MPSA_APP.getState().affiliations || []).filter((a) => a !== name);
          window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), affiliations: next });
          rebuildChips();
        }));
      }
    }
    rebuildChips();

    function renderDropdown() {
      dropdown.innerHTML = "";
      const q = input.value.trim();
      if (!q) return;
      const results = NS.search.matchAffiliations(window.MPSA_APP.getAffiliationIndex(), q, 8);
      for (const r of results) {
        const row = el("div", "dd-item");
        row.appendChild(el("div", "dd-name", r.name));
        row.appendChild(el("div", "dd-affil", r.count + " session" + (r.count === 1 ? "" : "s")));
        row.addEventListener("click", () => {
          const next = new Set(window.MPSA_APP.getState().affiliations || []);
          next.add(r.name);
          window.MPSA_APP.setState({ ...window.MPSA_APP.getState(), affiliations: Array.from(next).sort() });
          input.value = "";
          dropdown.innerHTML = "";
          rebuildChips();
        });
        dropdown.appendChild(row);
      }
    }
    input.addEventListener("input", renderDropdown);
    input.addEventListener("blur", () => setTimeout(() => { dropdown.innerHTML = ""; }, 150));
    return section;
  }

  function formatAgo(ms) {
    if (!ms) return "";
    const diff = Date.now() - ms;
    if (diff < 2000) return "just now";
    if (diff < 60000) return Math.floor(diff / 1000) + "s ago";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    return Math.floor(diff / 3600000) + "h ago";
  }

  function sidebarFooter() {
    const footer = el("div", "sidebar-footer");
    footer.id = "sidebar-footer";

    const topRow = el("div", "footer-row");
    const status = el("span", null, "");
    const saved = window.MPSA_APP.getLastSavedAt();
    status.innerHTML = '<span style="color: var(--ok)">✓</span> Auto-saved ' + formatAgo(saved);
    topRow.appendChild(status);

    const reset = el("button", "reset-btn", "Reset all");
    reset.addEventListener("click", () => {
      window.MPSA_APP.resetAll();
    });
    topRow.appendChild(reset);
    footer.appendChild(topRow);

    const ioRow = el("div", "footer-row");
    const exportBtn = el("button", "io-btn", "⬇ Export");
    exportBtn.title = "Download filters, favorites, and saved views as a JSON backup file";
    exportBtn.addEventListener("click", () => window.MPSA_APP.exportBackup());
    ioRow.appendChild(exportBtn);

    const importBtn = el("button", "io-btn", "⬆ Import");
    importBtn.title = "Load a previously exported backup file (replaces current state)";
    importBtn.addEventListener("click", () => window.MPSA_APP.importBackup());
    ioRow.appendChild(importBtn);
    footer.appendChild(ioRow);

    return footer;
  }

  function presetsSection(state, presets, activePresetId) {
    const section = sectionEl("💾 Saved Views");
    section.id = "sidebar-presets-section";
    const list = el("div", "preset-list");
    if (presets.length === 0) {
      list.appendChild(el("div", "preset-empty", "No saved views yet"));
    } else {
      for (const p of presets) {
        const isActive = p.id === activePresetId;
        const item = el("div", "preset-item" + (isActive ? " active" : ""));
        item.appendChild(el("span", "preset-dot", ""));
        const nameEl = el("span", "preset-name", p.name);
        item.appendChild(nameEl);
        if (isActive && window.MPSA_APP.isPresetModified()) {
          item.appendChild(el("span", "preset-mod", "●"));
        }
        const actions = el("span", "preset-actions");
        const renameBtn = el("button", "preset-action", "✎");
        renameBtn.title = "Rename";
        renameBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const nn = prompt("Rename view:", p.name);
          if (!nn) return;
          window.MPSA.storage.renamePreset(p.id, nn);
          window.MPSA_APP.refresh();
        });
        const delBtn = el("button", "preset-action", "🗑");
        delBtn.title = "Delete";
        delBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!confirm("Delete view \"" + p.name + "\"?")) return;
          window.MPSA.storage.deletePreset(p.id);
          if (p.id === window.MPSA_APP.getActivePresetId()) {
            window.MPSA_APP.setActivePresetId(null);
          } else {
            window.MPSA_APP.refresh();
          }
        });
        actions.appendChild(renameBtn);
        actions.appendChild(delBtn);
        item.appendChild(actions);
        item.addEventListener("click", () => {
          window.MPSA_APP.loadPreset(p);
        });
        list.appendChild(item);
      }
    }
    section.appendChild(list);

    const modified = activePresetId && window.MPSA_APP.isPresetModified();
    if (modified) {
      const activePreset = presets.find((x) => x.id === activePresetId);
      const updateBtn = el("button", "preset-btn primary", "Update \"" + activePreset.name + "\"");
      updateBtn.addEventListener("click", () => window.MPSA_APP.updateActivePreset());
      section.appendChild(updateBtn);

      const newBtn = el("button", "preset-btn", "Save as new");
      newBtn.addEventListener("click", () => {
        const name = prompt("Name this view:");
        if (!name) return;
        window.MPSA_APP.saveAsNew(name);
      });
      section.appendChild(newBtn);
    } else {
      const saveBtn = el("button", "preset-btn primary", "+ Save current");
      saveBtn.addEventListener("click", () => {
        if (NS.filters.isEmpty(window.MPSA_APP.getState())) {
          alert("Pick at least one filter before saving a view.");
          return;
        }
        const name = prompt("Name this view:");
        if (!name) return;
        window.MPSA_APP.saveAsNew(name);
      });
      section.appendChild(saveBtn);
    }
    return section;
  }

  function renderSidebar(program, state, presets, activePresetId) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const prevScroll = sidebar.scrollTop;
    sidebar.innerHTML = "";
    sidebar.appendChild(presetsSection(state, presets || [], activePresetId));
    sidebar.appendChild(favoritesFilterSection(state));
    sidebar.appendChild(dateFilterSection(program, state));
    sidebar.appendChild(authorFilterSection(state));
    sidebar.appendChild(affiliationFilterSection(state));
    sidebar.appendChild(divisionFilterSection(program, state));
    sidebar.appendChild(keywordFilterSection(state));
    sidebar.appendChild(sessionTypeFilterSection(program, state));
    sidebar.appendChild(sidebarFooter());
    sidebar.scrollTop = prevScroll;
  }

  // Partial update: swap only the Saved Views section + footer in place.
  // Called from refresh() on every filter change. The filter checkbox sections
  // are intentionally left alone so that scroll position, input focus, and
  // keyboard selection survive across state updates.
  function updateSidebarDynamic(state, presets, activePresetId) {
    const presetsEl = document.getElementById("sidebar-presets-section");
    if (presetsEl && presetsEl.parentNode) {
      const next = presetsSection(state, presets || [], activePresetId);
      presetsEl.parentNode.replaceChild(next, presetsEl);
    }
    const footerEl = document.getElementById("sidebar-footer");
    if (footerEl && footerEl.parentNode) {
      const next = sidebarFooter();
      footerEl.parentNode.replaceChild(next, footerEl);
    }
  }

  function renderFilterSummary(state, totalCount, activePresetName) {
    const bar = document.getElementById("filter-summary");
    if (!bar) return;
    bar.innerHTML = "";
    if (NS.filters.isEmpty(state)) return; // CSS :empty hides it

    if (activePresetName) {
      const badge = el("span", "summary-preset", "💾 " + activePresetName);
      bar.appendChild(badge);
    }
    if (state.favoritesOnly) {
      bar.appendChild(chipEl("⭐ Favorites only"));
    }
    if (state.dates && state.dates.length) {
      bar.appendChild(chipEl("📅 " + state.dates.map((d) => d.slice(5)).join(", ")));
    }
    if (state.divisions && state.divisions.length) {
      bar.appendChild(chipEl("🏛 " + state.divisions.join(", ")));
    }
    if (state.authors && state.authors.length) {
      bar.appendChild(chipEl("👤 " + state.authors.join(", ")));
    }
    if (state.affiliations && state.affiliations.length) {
      bar.appendChild(chipEl("🏫 " + state.affiliations.join(", ")));
    }
    if (state.sessionTypes && state.sessionTypes.length) {
      bar.appendChild(chipEl("📋 " + state.sessionTypes.join(", ")));
    }
    if (state.keyword && state.keyword.trim()) {
      bar.appendChild(chipEl("🔍 \"" + state.keyword.trim() + "\""));
    }
    const count = el("span", "summary-count", totalCount + " session" + (totalCount === 1 ? "" : "s"));
    bar.appendChild(count);
  }

  NS.render = { renderMain, renderFilterSummary, renderSidebar, updateSidebarDynamic };
})(typeof window !== "undefined" ? window : globalThis);
