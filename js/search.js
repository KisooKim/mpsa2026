(function (root) {
  const NS = root.MPSA = root.MPSA || {};

  function collectPeopleFromSession(session, bag) {
    const push = (p) => {
      if (!p || !p.name) return;
      const key = (p.name + "|" + (p.affiliation || "")).toLowerCase();
      if (!bag.has(key)) {
        bag.set(key, { name: p.name, affiliation: p.affiliation || "", normalized: p.name.toLowerCase() });
      }
    };
    for (const c of session.chair || []) push(c);
    for (const c of session.co_chair || []) push(c);
    for (const d of session.discussant || []) push(d);
    for (const p of session.participants || []) push(p);
    for (const paper of session.papers || []) {
      for (const a of paper.authors || []) push(a);
    }
  }

  function buildPeopleIndex(sessions) {
    const bag = new Map();
    for (const s of sessions) collectPeopleFromSession(s, bag);
    return Array.from(bag.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function matchPeople(index, rawQuery, limit) {
    if (limit === undefined) limit = 8;
    const q = (rawQuery || "").trim().toLowerCase();
    if (!q) return [];
    const results = [];
    for (const p of index) {
      const i = p.normalized.indexOf(q);
      if (i >= 0) {
        results.push({ name: p.name, affiliation: p.affiliation, matchStart: i, matchEnd: i + q.length });
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  function buildAffiliationIndex(sessions) {
    const counts = new Map();
    for (const s of sessions) {
      const seen = new Set();
      const check = (p) => {
        if (!p || !p.affiliation) return;
        const key = p.affiliation.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const entry = counts.get(key);
        if (entry) { entry.count++; } else { counts.set(key, { name: p.affiliation, normalized: key, count: 1 }); }
      };
      for (const c of s.chair || []) check(c);
      for (const c of s.co_chair || []) check(c);
      for (const d of s.discussant || []) check(d);
      for (const p of s.participants || []) check(p);
      for (const paper of s.papers || []) { for (const a of paper.authors || []) check(a); }
    }
    return Array.from(counts.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  function matchAffiliations(index, rawQuery, limit) {
    if (limit === undefined) limit = 8;
    const q = (rawQuery || "").trim().toLowerCase();
    if (!q) return [];
    const results = [];
    for (const a of index) {
      if (a.normalized.includes(q)) {
        results.push(a);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  NS.search = { buildPeopleIndex, matchPeople, buildAffiliationIndex, matchAffiliations };
})(typeof window !== "undefined" ? window : globalThis);
