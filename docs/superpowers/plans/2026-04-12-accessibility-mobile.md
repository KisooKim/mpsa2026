# Accessibility & Mobile Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MPSA 2026 viewer accessible and mobile-friendly based on attendee demographics (~45% aged 40+ with presbyopia, ~4-5% color vision deficient, mobile use at conference).

**Architecture:** All changes are CSS + vanilla JS modifications to existing files. Preferences (font scale, high contrast) stored in localStorage via existing storage.js pattern. Mobile uses CSS media queries + JS drawer toggle. No new modules; no build tools.

**Tech Stack:** Vanilla JS, CSS custom properties, CSS media queries, localStorage

**Spec:** `docs/superpowers/specs/2026-04-12-accessibility-mobile-design.md`

---

## File Structure

| File | Changes |
|------|---------|
| `js/storage.js` | Add `loadFontScale`, `saveFontScale`, `loadHighContrast`, `saveHighContrast` |
| `css/main.css` | Font rem conversion, contrast fix, custom checkboxes, focus styles, high contrast overrides, mobile media queries, drawer styles |
| `index.html` | Header controls (font size buttons, contrast toggle, hamburger), drawer overlay div |
| `js/app.js` | Preference initialization, system preference detection, drawer toggle, header control wiring |
| `js/render.js` | ARIA attributes on sidebar sections/cards/star, keyboard handlers for cards |
| `tests/js/storage.test.mjs` | Tests for new preference functions |

---

### Task 1: Preferences Storage Layer

**Files:**
- Modify: `js/storage.js`
- Modify: `tests/js/storage.test.mjs`

- [ ] **Step 1: Write failing tests for font-scale and high-contrast storage**

Add to the end of `tests/js/storage.test.mjs`:

```javascript
// ── Font scale preferences ──

test("loadFontScale returns 1.0 when nothing stored", () => {
  const val = MPSA.storage.loadFontScale();
  assert.strictEqual(val, 1.0);
});

test("saveFontScale + loadFontScale round-trips", () => {
  MPSA.storage.saveFontScale(1.1);
  assert.strictEqual(MPSA.storage.loadFontScale(), 1.1);
  MPSA.storage.saveFontScale(0.9);
  assert.strictEqual(MPSA.storage.loadFontScale(), 0.9);
});

test("loadFontScale rejects invalid values", () => {
  localStorage.setItem("mpsa2026-font-scale", "2.5");
  assert.strictEqual(MPSA.storage.loadFontScale(), 1.0);
  localStorage.setItem("mpsa2026-font-scale", "garbage");
  assert.strictEqual(MPSA.storage.loadFontScale(), 1.0);
});

// ── High contrast preferences ──

test("loadHighContrast returns false when nothing stored", () => {
  assert.strictEqual(MPSA.storage.loadHighContrast(), false);
});

test("saveHighContrast + loadHighContrast round-trips", () => {
  MPSA.storage.saveHighContrast(true);
  assert.strictEqual(MPSA.storage.loadHighContrast(), true);
  MPSA.storage.saveHighContrast(false);
  assert.strictEqual(MPSA.storage.loadHighContrast(), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/js/storage.test.mjs`
Expected: 5 new tests FAIL (loadFontScale/saveFontScale/loadHighContrast/saveHighContrast not defined)

- [ ] **Step 3: Implement preference functions in storage.js**

Add new constants after line 7 (`const KEY_FAVORITES = ...`):

```javascript
const KEY_FONT_SCALE    = "mpsa2026-font-scale";
const KEY_HIGH_CONTRAST = "mpsa2026-high-contrast";
```

Add new functions before the `NS.storage = {` export block (before line 182):

```javascript
function loadFontScale() {
  const val = parseFloat(root.localStorage.getItem(KEY_FONT_SCALE));
  return [0.9, 1.0, 1.1].includes(val) ? val : 1.0;
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
```

Add to the `NS.storage` export object:

```javascript
loadFontScale, saveFontScale, loadHighContrast, saveHighContrast,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/js/storage.test.mjs`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/js/storage.test.mjs
git commit -m "feat: add font-scale and high-contrast preference storage"
```

---

### Task 2: CSS Typography & Contrast

**Files:**
- Modify: `css/main.css`

This task increases font sizes for presbyopia users and fixes WCAG AA contrast failures. Font sizes are converted from `px` to `rem` so they respond to the `--font-scale` feature (Task 5). Layout dimensions (padding, width, margins) remain in `px`.

- [ ] **Step 1: Update CSS variables and html font-size**

In `:root` (line 3-19), change `--muted`:

```css
--muted: #636363;
```

In `html, body` (line 23-30), change font to use `--font-scale`:

```css
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font: calc(16px * var(--font-scale, 1)) / 1.5 var(--font);
}
```

- [ ] **Step 2: Convert main content font sizes from px to rem (increased)**

Replace each font-size declaration. The pattern: current px → increased px → rem (at 16px base).

```css
/* .app-dates — keep px, header is fixed */
.app-dates { color: var(--muted); font-size: 13px; }

/* .day-section-header: 18px → 1.125rem */
.day-section-header { font-size: 1.125rem; /* ... rest unchanged */ }

/* .session-title: 14px → 0.9375rem (=15px at scale 1) */
.session-title { font-size: 0.9375rem; /* ... rest unchanged */ }

/* .session-meta: 11px → 0.75rem (=12px) */
.session-meta { font-size: 0.75rem; /* ... rest unchanged */ }

/* .division-tag: 10px → 0.6875rem (=11px) */
.division-tag { font-size: 0.6875rem; /* ... rest unchanged */ }

/* .session-detail: 13px → 0.875rem (=14px) */
.session-detail { font-size: 0.875rem; /* ... rest unchanged */ }

/* .detail-person: 12px → 0.8125rem (=13px) */
.detail-person { font-size: 0.8125rem; }

/* .detail-paper: 12px → 0.8125rem (=13px) */
.detail-paper { font-size: 0.8125rem; }

/* .detail-paper .author: 11px → 0.75rem (=12px) */
.detail-paper .author { color: var(--muted); font-size: 0.75rem; }

/* .time-label: 12px → 0.8125rem (=13px) */
.time-label { font-size: 0.8125rem; /* ... rest unchanged */ }

/* .filter-summary: 12px → 0.8125rem (=13px) */
.filter-summary { font-size: 0.8125rem; /* ... rest unchanged */ }

/* .summary-chip: 11px → 0.75rem (=12px) */
.summary-chip { font-size: 0.75rem; /* ... rest unchanged */ }

/* .summary-count: 11px → 0.75rem (=12px) */
.summary-count { font-size: 0.75rem; /* ... rest unchanged */ }

/* .summary-preset: 11px → 0.75rem (=12px) */
.summary-preset { font-size: 0.75rem; /* ... rest unchanged */ }

/* .check-row: 13px → 0.875rem (=14px) */
.check-row { font-size: 0.875rem; /* ... rest unchanged */ }

/* .sidebar-search: 12px → 0.8125rem (=13px) */
.sidebar-search { font-size: 0.8125rem; /* ... rest unchanged */ }

/* .preset-item: 12px → 0.8125rem (=13px) */
.preset-item { font-size: 0.8125rem; /* ... rest unchanged */ }

/* .dd-name: 12px → 0.8125rem (=13px) */
.dd-name { font-size: 0.8125rem; }

/* .dd-affil: 10px → 0.6875rem (=11px) */
.dd-affil { font-size: 0.6875rem; }

/* .empty-state h2: 20px → 1.25rem */
.empty-state h2 { font-size: 1.25rem; }
```

The following stay in `px` (decorative/structural — should not scale):
- `.app-dates` (13px), `.detail-label` (10px), `.check-row .count` (10px), `.chip` (10px), `.sidebar-footer` (10px), `.io-btn` (10px), `.reset-btn` (10px), `.preset-btn` (11px), `.preset-empty` (10px), `.preset-action` (12px), `.preset-mod` (12px), `.empty-state .empty-icon` (42px), `.empty-state .empty-hint` (12px)

- [ ] **Step 3: Verify existing tests still pass**

Run: `node --test tests/js/*.test.mjs`
Expected: All pass (CSS changes don't affect JS tests)

- [ ] **Step 4: Commit**

```bash
git add css/main.css
git commit -m "feat: increase font sizes and fix muted text contrast for WCAG AA"
```

---

### Task 3: CSS Custom Checkboxes & Touch Targets

**Files:**
- Modify: `css/main.css`

- [ ] **Step 1: Add custom checkbox styles**

Replace the existing `.check-row` and checkbox rules (lines 281-298) with:

```css
.check-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 4px 0;
  font-size: 0.875rem;
  color: var(--text);
  cursor: pointer;
}
.check-row .count {
  margin-left: auto;
  color: var(--muted);
  font-size: 10px;
}
.check-row input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 2px solid var(--muted);
  border-radius: 3px;
  cursor: pointer;
  position: relative;
  background: var(--bg);
  transition: border-color 0.15s, background 0.15s;
}
.check-row input[type="checkbox"]:checked {
  background: var(--accent);
  border-color: var(--accent);
}
.check-row input[type="checkbox"]:checked::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 6px;
  height: 10px;
  border: solid var(--bg);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
```

- [ ] **Step 2: Increase favorite star touch target**

Replace `.fav-star` styles (lines 436-458) with:

```css
.fav-star {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 44px;
  height: 44px;
  font-size: 0;
  color: transparent;
  cursor: pointer;
  background: none;
  border: none;
  padding: 11px;
  background-size: 22px 22px;
  background-repeat: no-repeat;
  background-position: center;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26' fill='none' stroke='%23ccc' stroke-width='1.8' stroke-linejoin='round'/%3E%3C/svg%3E");
  transition: transform 0.15s;
  z-index: 1;
}
.fav-star:hover { transform: scale(1.15); }
.fav-star.on {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpolygon points='12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26' fill='%23f97316' stroke='%23f97316' stroke-width='1.8' stroke-linejoin='round'/%3E%3C/svg%3E");
}
```

- [ ] **Step 3: Increase dropdown item and button touch targets**

Update `.dd-item` (line 332-337):

```css
.dd-item {
  padding: 10px;
  min-height: 40px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
```

Update `.io-btn` (lines 246-256):

```css
.io-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 10px;
  padding: 6px 12px;
  min-height: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
```

Update `.reset-btn` (lines 424-434):

```css
.reset-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 10px;
  padding: 6px 12px;
  min-height: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
```

- [ ] **Step 4: Commit**

```bash
git add css/main.css
git commit -m "feat: custom checkboxes and larger touch targets for accessibility"
```

---

### Task 4: Focus Indicators, High Contrast & Reduced Motion

**Files:**
- Modify: `css/main.css`

- [ ] **Step 1: Add focus indicator styles**

Append to `css/main.css`:

```css
/* ── Focus indicators ─────────────────────────────── */

.check-row input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.fav-star:focus-visible,
.io-btn:focus-visible,
.reset-btn:focus-visible,
.preset-btn:focus-visible,
.preset-action:focus-visible,
.preset-item:focus-visible,
.sidebar-search:focus-visible,
.session-card:focus-visible,
.font-btn:focus-visible,
.contrast-btn:focus-visible,
.drawer-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.dd-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
```

- [ ] **Step 2: Add high contrast mode overrides**

Append to `css/main.css`:

```css
/* ── High contrast mode ───────────────────────────── */

.high-contrast {
  --bg: #ffffff;
  --panel: #f0f0f0;
  --panel-2: #ffffff;
  --border: #000000;
  --text: #000000;
  --muted: #444444;
  --accent: #000000;
  --accent-2: #000000;
  --accent-bg: rgba(0,0,0,0.08);
  --chip-bg: rgba(0,0,0,0.1);
  --tag-bg: rgba(0,0,0,0.08);
  --tag-fg: #000000;
  --ok: #000000;
}

.high-contrast .session-card {
  border-width: 2px;
}

.high-contrast .check-row input[type="checkbox"] {
  border-width: 2px;
}

@media (prefers-contrast: more) {
  :root:not(.no-auto-contrast) {
    --bg: #ffffff;
    --panel: #f0f0f0;
    --panel-2: #ffffff;
    --border: #000000;
    --text: #000000;
    --muted: #444444;
    --accent: #000000;
    --accent-2: #000000;
    --accent-bg: rgba(0,0,0,0.08);
    --chip-bg: rgba(0,0,0,0.1);
    --tag-bg: rgba(0,0,0,0.08);
    --tag-fg: #000000;
    --ok: #000000;
  }
}
```

- [ ] **Step 3: Add reduced motion support**

Append to `css/main.css`:

```css
/* ── Reduced motion ───────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add css/main.css
git commit -m "feat: focus indicators, high contrast mode, and reduced motion support"
```

---

### Task 5: Header Controls & Preferences Initialization

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/main.css`

- [ ] **Step 1: Add header controls and drawer overlay to index.html**

Replace the `<header>` block (lines 10-13) with:

```html
<header class="app-header">
  <button class="drawer-toggle" id="drawer-toggle" aria-label="Open filters" title="Open filters">&#9776;</button>
  <div class="app-title">MPSA 2026 Program</div>
  <div class="app-dates">April 23&#8211;26, 2026</div>
  <div class="header-controls" id="header-controls">
    <button class="font-btn" data-scale="0.9" aria-label="Decrease font size">A&#8722;</button>
    <button class="font-btn active" data-scale="1" aria-label="Default font size">A</button>
    <button class="font-btn" data-scale="1.1" aria-label="Increase font size">A+</button>
    <button class="contrast-btn" id="contrast-toggle" aria-label="Toggle high contrast mode" aria-pressed="false">&#9680;</button>
  </div>
</header>
```

Add drawer overlay after `<header>`, before `<div class="app-body">`:

```html
<div class="drawer-overlay" id="drawer-overlay"></div>
```

- [ ] **Step 2: Add CSS for header controls**

Append to `css/main.css` (before any media queries):

```css
/* ── Header controls ──────────────────────────────── */

.drawer-toggle {
  display: none; /* shown only on mobile via media query */
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text);
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
}

.header-controls {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
}

.font-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--muted);
  font-size: 13px;
  font-family: var(--font);
  font-weight: 500;
  padding: 4px 8px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.font-btn:hover {
  color: var(--text);
  border-color: var(--border);
}
.font-btn.active {
  color: var(--text);
  font-weight: 700;
  border-bottom: 2px solid var(--accent);
}

.contrast-btn {
  background: none;
  border: 1px solid transparent;
  font-size: 18px;
  color: var(--muted);
  padding: 4px 8px;
  min-width: 36px;
  min-height: 36px;
  border-radius: 6px;
  cursor: pointer;
  margin-left: 4px;
  transition: color 0.15s, border-color 0.15s;
}
.contrast-btn:hover {
  color: var(--text);
  border-color: var(--border);
}
.contrast-btn[aria-pressed="true"] {
  color: var(--text);
  background: var(--chip-bg);
}

.drawer-overlay {
  display: none;
}
```

- [ ] **Step 3: Add preference initialization and header control wiring to app.js**

Add after `let FAVORITES = MPSA.storage.loadFavorites();` (line 8):

```javascript
let FONT_SCALE = MPSA.storage.loadFontScale();
let HIGH_CONTRAST = MPSA.storage.loadHighContrast();
```

Add new functions before `window.MPSA_APP = {` (before line 58):

```javascript
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
```

In the `DOMContentLoaded` handler, add after `snapshotForActive();` (line 192) and before `refreshAll();`:

```javascript
applyFontScale(FONT_SCALE);
applyHighContrast(HIGH_CONTRAST);
initHeaderControls();
```

- [ ] **Step 4: Run tests to verify nothing is broken**

Run: `node --test tests/js/*.test.mjs`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add index.html js/app.js css/main.css
git commit -m "feat: add font size controls and high contrast toggle in header"
```

---

### Task 6: ARIA Attributes & Keyboard Navigation

**Files:**
- Modify: `js/render.js`

- [ ] **Step 1: Add ARIA attributes to sidebar sections**

In `render.js`, update the `sectionEl` function (line 168-172) to accept an aria-label:

```javascript
function sectionEl(title, ariaLabel) {
  const section = el("section", "sidebar-section");
  if (ariaLabel) section.setAttribute("aria-label", ariaLabel);
  section.appendChild(el("h4", null, title));
  return section;
}
```

Update all callers to pass `ariaLabel`:

In `favoritesFilterSection` (line 175):
```javascript
const section = sectionEl("⭐ Favorites", "Favorites filter");
```

In `dateFilterSection` (line 194):
```javascript
const section = sectionEl("📅 Date", "Date filter");
```

In `divisionFilterSection` (line 228):
```javascript
const section = sectionEl("Division", "Division filter");
```

In `sessionTypeFilterSection` (line 265):
```javascript
const section = sectionEl("Session Type", "Session type filter");
```

In `keywordFilterSection` (line 287):
```javascript
const section = sectionEl("Topic / Keyword", "Keyword filter");
```

In `authorFilterSection` (line 307):
```javascript
const section = sectionEl("Author", "Author filter");
```

In `affiliationFilterSection` (line 362):
```javascript
const section = sectionEl("Affiliation", "Affiliation filter");
```

In `presetsSection` (line 457):
```javascript
const section = sectionEl("💾 Saved in Browser", "Saved views");
```

- [ ] **Step 2: Add ARIA attributes and keyboard support to session cards**

In `renderSessionCard` (line 46), after `const card = el("div", "session-card");`:

```javascript
card.setAttribute("role", "button");
card.setAttribute("tabindex", "0");
card.setAttribute("aria-expanded", "false");
```

Update the star button (line 50-51) to add ARIA label:

```javascript
const star = el("button", "fav-star" + (isFav ? " on" : ""));
star.setAttribute("aria-label", isFav ? "Remove from favorites" : "Add to favorites");
```

Update the card click handler (lines 92-95) to also update `aria-expanded`:

```javascript
card.addEventListener("click", (e) => {
  e.stopPropagation();
  const expanded = card.classList.toggle("expanded");
  card.setAttribute("aria-expanded", String(expanded));
});
```

Add keyboard handler right after the click handler:

```javascript
card.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.stopPropagation();
    const expanded = card.classList.toggle("expanded");
    card.setAttribute("aria-expanded", String(expanded));
  }
});
```

- [ ] **Step 3: Update star toggle ARIA labels on favorite toggle**

In the `toggleFavorite` handler in `app.js` (around line 157-159), after updating the star class, also update the aria-label:

```javascript
if (star) {
  star.classList.toggle("on", nowFav);
  star.textContent = "";
  star.title = nowFav ? "Remove from favorites" : "Add to favorites";
  star.setAttribute("aria-label", nowFav ? "Remove from favorites" : "Add to favorites");
}
```

- [ ] **Step 4: Add aria-live region for filter result count**

In `renderFilterSummary` in `render.js`, update the filter summary bar. After `bar.innerHTML = "";` (line 572), add:

```javascript
bar.setAttribute("aria-live", "polite");
bar.setAttribute("role", "status");
```

- [ ] **Step 5: Add ARIA landmark to sidebar**

In `renderSidebar` (line 536), after `if (!sidebar) return;`, add:

```javascript
sidebar.setAttribute("role", "complementary");
sidebar.setAttribute("aria-label", "Filters");
```

- [ ] **Step 6: Run tests**

Run: `node --test tests/js/*.test.mjs`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add js/render.js js/app.js
git commit -m "feat: add ARIA attributes and keyboard navigation for accessibility"
```

---

### Task 7: Mobile Responsive Layout & Drawer

**Files:**
- Modify: `css/main.css`
- Modify: `js/app.js`
- Modify: `js/render.js`

- [ ] **Step 1: Add mobile CSS media queries and drawer styles**

Append to `css/main.css`:

```css
/* ── Mobile responsive (≤768px) ───────────────────── */

@media (max-width: 768px) {
  .drawer-toggle {
    display: block;
  }

  .app-header {
    padding: 0 12px;
    gap: 8px;
  }

  .app-dates {
    display: none;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 85vw;
    max-width: 360px;
    height: 100vh;
    max-height: 100vh;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    border-right: 1px solid var(--border);
    box-shadow: none;
    padding-top: 16px;
  }

  .sidebar.open {
    transform: translateX(0);
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }

  .drawer-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.3);
    z-index: 99;
  }

  .drawer-overlay.visible {
    display: block;
  }

  .main {
    padding: 16px;
  }

  .filter-summary {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
  }

  .time-row {
    flex-direction: column;
    gap: 8px;
  }

  .time-label {
    width: auto;
    padding-top: 0;
  }

  .time-slot {
    flex-direction: column;
  }

  .session-card {
    flex: 1 1 100%;
    min-width: 0;
  }

  .drawer-close-row {
    display: block;
    padding: 12px 0;
    margin-top: 8px;
  }

  .drawer-close-btn {
    display: block;
    width: 100%;
    background: var(--accent);
    color: var(--bg);
    border: none;
    font-size: 14px;
    font-family: var(--font);
    font-weight: 600;
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
  }
}

@media (min-width: 769px) {
  .drawer-close-row {
    display: none;
  }
}
```

- [ ] **Step 2: Add "Apply & Close" button to sidebar footer in render.js**

In `sidebarFooter()` in `render.js` (after the ioRow is appended to footer, around line 451), add:

```javascript
const closeRow = el("div", "drawer-close-row");
const closeBtn = el("button", "drawer-close-btn", "Apply & Close");
closeBtn.addEventListener("click", () => {
  if (window.MPSA_APP.closeDrawer) window.MPSA_APP.closeDrawer();
});
closeRow.appendChild(closeBtn);
footer.appendChild(closeRow);
```

- [ ] **Step 3: Add drawer toggle logic to app.js**

Add drawer functions before the `window.MPSA_APP` export block:

```javascript
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
```

Add `closeDrawer` to the `window.MPSA_APP` export object:

```javascript
closeDrawer,
```

In the `DOMContentLoaded` handler, add `initDrawer();` after `initHeaderControls();`.

- [ ] **Step 4: Set sidebar aria-hidden on desktop**

In the `DOMContentLoaded` handler, after `initDrawer();`:

```javascript
// On desktop, sidebar is always visible
const isMobile = window.matchMedia("(max-width: 768px)").matches;
const sidebar = document.getElementById("sidebar");
if (sidebar) sidebar.setAttribute("aria-hidden", isMobile ? "true" : "false");
```

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `node --test tests/js/*.test.mjs`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add css/main.css js/app.js js/render.js
git commit -m "feat: add mobile responsive layout with slide-out drawer"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all existing tests**

```bash
node --test tests/js/*.test.mjs
```

Expected: All pass.

- [ ] **Step 2: Visual verification checklist**

Open `http://localhost:8000` and verify:

Desktop (>768px):
1. Font sizes are visibly larger than before
2. Muted text (#636363) is readable
3. `A−` / `A` / `A+` buttons in header change font sizes
4. Active font size button has underline
5. `◐` toggles high contrast mode (borders darken, muted text gets darker)
6. Custom checkboxes render (18x18px with checkmark)
7. Star has large clickable area (44x44px)
8. Tab through interactive elements — blue/black focus outlines appear
9. Enter/Space on a session card toggles expand/collapse
10. Hamburger ☰ is hidden on desktop

Mobile (≤768px, use browser DevTools responsive mode):
1. Hamburger ☰ appears in header
2. Sidebar is hidden
3. Click ☰ → drawer slides in from left with overlay
4. Click overlay → drawer closes
5. Escape key → drawer closes
6. "Apply & Close" button at drawer bottom works
7. Session cards stack vertically (single column)
8. Filter summary bar scrolls horizontally

Color blindness (Chrome DevTools → Rendering → Emulate vision deficiencies):
9. Deuteranopia: star shape change (outline→filled) is visible without color
10. Protanopia: same verification

- [ ] **Step 3: Fix any issues found during verification and commit**

```bash
git add -A
git commit -m "fix: address issues found during accessibility verification"
```

(Skip this step if no issues found.)
