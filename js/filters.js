(function (root) {
  const NS = root.MPSA = root.MPSA || {};

  function emptyState() {
    return { dates: [], authors: [], divisions: [], sessionTypes: [], keyword: "", favoritesOnly: false };
  }

  function isEmpty(state) {
    if (!state) return true;
    return (
      (state.dates || []).length === 0 &&
      (state.authors || []).length === 0 &&
      (state.divisions || []).length === 0 &&
      (state.sessionTypes || []).length === 0 &&
      !(state.keyword && state.keyword.trim()) &&
      !state.favoritesOnly
    );
  }

  // Order-sensitive array comparison. Callers must keep filter arrays sorted
  // (render.js does this via Array.from(set).sort() at every mutation point);
  // if a future caller pushes without sorting, preset-modification detection
  // will silently misbehave. Keep filter arrays canonical.
  function eqArr(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function equals(a, b) {
    return (
      eqArr(a.dates || [], b.dates || []) &&
      eqArr(a.authors || [], b.authors || []) &&
      eqArr(a.divisions || [], b.divisions || []) &&
      eqArr(a.sessionTypes || [], b.sessionTypes || []) &&
      (a.keyword || "") === (b.keyword || "") &&
      (!!a.favoritesOnly) === (!!b.favoritesOnly)
    );
  }

  function collectSessionText(session) {
    const parts = [session.title || ""];
    for (const p of session.papers || []) {
      parts.push(p.title || "");
      for (const a of p.authors || []) parts.push(a.name || "");
    }
    for (const c of session.chair || []) parts.push(c.name || "");
    for (const c of session.co_chair || []) parts.push(c.name || "");
    for (const d of session.discussant || []) parts.push(d.name || "");
    for (const p of session.participants || []) parts.push(p.name || "");
    return parts.join(" ").toLowerCase();
  }

  function matchesDates(session, state) {
    if (!state.dates || state.dates.length === 0) return true;
    return state.dates.includes(session.date);
  }

  function matchesDivisions(session, state) {
    if (!state.divisions || state.divisions.length === 0) return true;
    return state.divisions.includes(session.division);
  }

  function matchesSessionTypes(session, state) {
    if (!state.sessionTypes || state.sessionTypes.length === 0) return true;
    return state.sessionTypes.includes(session.session_type);
  }

  function matchesAuthors(session, state) {
    if (!state.authors || state.authors.length === 0) return true;
    const people = session.all_people || [];
    for (const authorQuery of state.authors) {
      const needle = String(authorQuery).toLowerCase();
      for (const entry of people) {
        if (entry.includes(needle)) return true;
      }
    }
    return false;
  }

  function matchesKeyword(session, state) {
    const kw = (state.keyword || "").trim().toLowerCase();
    if (!kw) return true;
    const haystack = collectSessionText(session);
    const tokens = kw.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (!haystack.includes(t)) return false;
    }
    return true;
  }

  // favorites is an optional Set<string> of session IDs. When state.favoritesOnly
  // is true, only sessions whose id is in this Set pass the filter.
  function matchesFavorites(session, state, favorites) {
    if (!state.favoritesOnly) return true;
    if (!favorites) return false;
    return favorites.has(String(session.id));
  }

  function matches(session, state, favorites) {
    return (
      matchesDates(session, state) &&
      matchesDivisions(session, state) &&
      matchesSessionTypes(session, state) &&
      matchesAuthors(session, state) &&
      matchesKeyword(session, state) &&
      matchesFavorites(session, state, favorites)
    );
  }

  NS.filters = { emptyState, isEmpty, equals, matches };
})(typeof window !== "undefined" ? window : globalThis);
