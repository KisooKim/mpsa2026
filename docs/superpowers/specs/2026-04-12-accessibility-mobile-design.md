# MPSA 2026 Viewer — Accessibility & Mobile Responsive Design

## Purpose

Adapt the MPSA 2026 Program Viewer for its actual user demographics: political science academics aged 25–70+, ~45% with presbyopia, ~4-5% with color vision deficiency, using devices from laptops to phones in contexts from hotel rooms to conference hallways.

## Scope

- Typography & font size scaling (user-adjustable)
- Color contrast WCAG AA compliance
- Color-blind-safe visual indicators
- High contrast mode (manual + system detection)
- Touch/click target sizing (WCAG 44px minimum)
- Mobile responsive layout (sidebar → drawer)
- ARIA labels & keyboard accessibility
- System preference detection (contrast, reduced motion)

## Out of Scope

- WCAG AAA full compliance
- Dark mode / color themes
- Swipe gestures
- Screen reader comprehensive audit (beyond basic ARIA)
- Internationalization / language switching

---

## 1. User Demographics

| Group | Age | Share | Key Visual Need |
|-------|-----|-------|-----------------|
| Graduate students | 25–35 | ~30% | Small screens, mobile use |
| Assistant professors | 30–40 | ~20% | Mild presbyopia onset |
| Associate professors | 40–55 | ~25% | Presbyopia common |
| Full professors | 55–70+ | ~20% | Presbyopia + contrast sensitivity decline |
| Other (journalists, policy) | 30–60 | ~5% | Mixed |

- **~45%+ are 40+** → presbyopia is the dominant visual issue
- **~4-5% color vision deficient** (8% of males, ~55% male field)
- **Usage contexts**: pre-conference laptop planning, on-site phone checking between sessions

---

## 2. Typography & Font Sizing

### Base Size Increase

| Element | Before | After |
|---------|--------|-------|
| body base | 13px | **15px** |
| Session card title | 0.97em (~12.6px) | **1.05em (~15.75px)** |
| Card meta (division, type) | 0.82em (~10.7px) | **0.85em (~12.75px)** |
| Sidebar labels | 0.92em (~12px) | **0.93em (~14px)** |
| Expanded card paper titles | 0.93em | Unchanged (auto-scales with base) |
| Minimum font size | None | **12px floor** |

### User-Adjustable Font Scale

- Three buttons in header: `A−` `A` `A+`
- CSS variable `--font-scale`: `0.9` / `1.0` / `1.1`
- Body font-size: `calc(15px * var(--font-scale))`
- All `em`-based children scale proportionally
- Active step indicated by underline
- Stored in `localStorage` key `mpsa2026-font-scale`
- Default: `1.0`

Effective sizes:
- A−: 13.5px (similar to current)
- A: 15px (new default)
- A+: 16.5px (presbyopia-friendly)

---

## 3. Color & Contrast

### Contrast Fixes

| Element | Before | After | Ratio |
|---------|--------|-------|-------|
| Muted text (`--muted`) | `#8a8a8a` | **`#636363`** | 3.5:1 → **5.9:1** (AA pass) |
| Muted on sidebar (`--panel`) | `#8a8a8a` on `#fafafa` | **`#636363`** on `#fafafa` | 3.4:1 → **5.7:1** (AA pass) |
| Main text | `#171717` on `#fff` | Unchanged | 18.1:1 (excellent) |

### Color-Blind-Safe Design

- **Favorites star**: State communicated by **shape change** (outline → filled) as primary signal, color (orange) as secondary. Already partially implemented; ensure fill is visually distinct without color.
- **Current monochrome palette**: Already color-blind-safe. No color-only state indicators elsewhere.
- **Division tags**: Monochrome backgrounds — safe. No changes.

### High Contrast Mode

- Toggle button `◐` in header (next to font controls)
- Activates CSS class `.high-contrast` on `<body>`
- CSS variable overrides:
  ```
  --bg: #ffffff
  --text: #000000
  --muted: #444444
  --border: #000000
  --panel: #f0f0f0
  --chip-bg: rgba(0,0,0,0.1)
  --tag-bg: rgba(0,0,0,0.08)
  ```
- Stored in `localStorage` key `mpsa2026-high-contrast`
- Auto-activates when `prefers-contrast: more` detected
- Active state: filled icon variant

---

## 4. Touch/Click Targets

### Checkboxes

- Hide native checkbox with `appearance: none` + custom CSS
- Visual checkbox size: **18x18px**
- Clickable area (label row): **minimum 44px height**
- Checkmark drawn with `::after` pseudo-element
- Adequate spacing between checkbox rows

### Favorites Star

- Expand button padding to create **minimum 44x44px touch target**
- Maintain top-right card position
- No visual size change — padding creates invisible hit area

### Autocomplete Dropdown Items (Author, Affiliation)

- Minimum item height: **40px**
- Separator lines between items for visual clarity

### Sidebar Buttons (Reset, Export, Import)

- Minimum height: **36px**
- Horizontal padding: 12px+
- Spacing between buttons: 8px minimum

---

## 5. Mobile Responsive Layout

### Breakpoint

- **>768px**: Current two-column layout (sidebar + main), unchanged
- **≤768px**: Single-column with drawer

### Header (≤768px)

```
┌──────────────────────────────┐
│ ☰  MPSA 2026       A− A A+ ◐│
│    April 23–26, 2026         │
└──────────────────────────────┘
```

- Hamburger button `☰` added to left side
- `display: none` on desktop (>768px)
- Font controls and high-contrast toggle remain in header

### Sidebar → Drawer

- Slides in from left on `☰` click
- Width: 85vw, max 360px
- Overlay: semi-transparent backdrop, click to close
- Contains all existing sidebar content unchanged
- Bottom-pinned **"Apply & Close"** button
- `Escape` key closes drawer
- Focus trapped inside when open

### Main Content (≤768px)

- Session cards: `flex: 1 1 100%` (single-column stack)
- Filter summary bar: `overflow-x: auto` (horizontal scroll)
- Padding reduced to 16px horizontal
- Time labels and day headers full-width

### Drawer Behavior

- Filters apply in real-time as changed (same as desktop)
- "Apply & Close" button provides explicit close action
- Drawer state not persisted (always starts closed on page load)

### Touch Considerations

- All controls meet 44px minimum target (from Section 4)
- Card tap to expand/collapse (same as desktop click)
- No swipe gestures (complexity vs. value)

---

## 6. ARIA & Keyboard Accessibility

### ARIA Labels

| Element | Attribute |
|---------|-----------|
| Sidebar / Drawer | `role="complementary"`, `aria-label="Filters"` |
| Each filter section | `aria-label="Date filter"`, `"Author filter"`, etc. |
| Session card | `role="button"`, `tabindex="0"`, `aria-expanded="false"` / `"true"` on toggle |
| Favorites star button | `aria-label="Add to favorites"` / `"Remove from favorites"` |
| Filter result count | `aria-live="polite"` (announces count on filter change) |
| Drawer (mobile) | `aria-hidden="true"` / `"false"`, focus trap when open |
| Font size buttons | `aria-label="Decrease font size"`, `"Default font size"`, `"Increase font size"` |
| High contrast toggle | `aria-label="Toggle high contrast mode"`, `aria-pressed="true/false"` |

### Keyboard Navigation

- All interactive elements receive **visible focus indicator**: 2px solid `--accent`, 2px offset
- Session cards: `Enter` or `Space` to expand/collapse
- Drawer (mobile): `Escape` to close
- Tab order: Header controls → Sidebar filters (top to bottom) → Main content cards
- Focus outline uses `--accent` color (adapts to high-contrast mode)

### System Preference Detection

- `prefers-contrast: more` → auto-enable high contrast mode
- `prefers-reduced-motion: reduce` → disable drawer slide animation (instant show/hide)

---

## 7. Implementation Notes

### Files Modified

| File | Changes |
|------|---------|
| `css/main.css` | Font sizes, contrast colors, custom checkboxes, focus styles, media queries, drawer styles, high-contrast overrides |
| `js/render.js` | Header controls (font size, high contrast), ARIA attributes on cards/sections, drawer toggle, focus management |
| `js/app.js` | Preferences initialization (font scale, high contrast), system preference detection, localStorage for new prefs |
| `index.html` | Meta viewport tag (if missing), semantic landmark adjustments |

### New Files

None. All changes are modifications to existing files.

### localStorage Keys (New)

| Key | Values | Default |
|-----|--------|---------|
| `mpsa2026-font-scale` | `0.9`, `1.0`, `1.1` | `1.0` |
| `mpsa2026-high-contrast` | `true`, `false` | `false` |

### CSS Variables (New/Modified)

| Variable | Purpose |
|----------|---------|
| `--font-scale` | Font size multiplier |
| `--focus-outline` | Focus indicator style |

High-contrast mode overrides existing variables (`--bg`, `--text`, `--muted`, `--border`, `--panel`, `--chip-bg`, `--tag-bg`).

### Testing

- Verify WCAG contrast ratios with browser dev tools
- Test with color blindness simulator (e.g., Chrome DevTools → Rendering → Emulate vision deficiencies)
- Test keyboard-only navigation flow
- Test at 768px breakpoint for drawer behavior
- Test localStorage persistence of font scale and high contrast preferences
- Existing JS unit tests should not break (no logic changes to filters/search/storage)
