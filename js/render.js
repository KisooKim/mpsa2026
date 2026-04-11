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
    hint.innerHTML = "<strong>← Pick filters in the sidebar.</strong><br>Save combinations you like as Saved Views.";
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

  function renderFilterSummary(state, totalCount, activePresetName) {
    const bar = document.getElementById("filter-summary");
    if (!bar) return;
    bar.innerHTML = "";
    if (NS.filters.isEmpty(state)) return; // CSS :empty hides it

    if (activePresetName) {
      const badge = el("span", "summary-preset", "💾 " + activePresetName);
      bar.appendChild(badge);
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
    if (state.sessionTypes && state.sessionTypes.length) {
      bar.appendChild(chipEl("📋 " + state.sessionTypes.join(", ")));
    }
    if (state.keyword && state.keyword.trim()) {
      bar.appendChild(chipEl("🔍 \"" + state.keyword.trim() + "\""));
    }
    const count = el("span", "summary-count", totalCount + " session" + (totalCount === 1 ? "" : "s"));
    bar.appendChild(count);
  }

  NS.render = { renderMain, renderFilterSummary };
})(typeof window !== "undefined" ? window : globalThis);
