# MPSA HTML Parser — Observed Structure (from day1-2026-04-23.html)

Investigated: `raw_html/day1-2026-04-23.html` (409,793 bytes, ~274 lines — mostly one large blob)
Tool: Python 3 + BeautifulSoup (lxml parser)
Date of investigation: 2026-04-11

---

## Source Page Type

The raw HTML files are **"Browse by Day" listing pages** from the allacademic platform
(`cmd=Online+Program+View+Selected+Day+Submissions`). They contain **session summaries only**.

**Fields available in these listing pages:**
- Session ID (numeric, in the `id` attribute)
- Date (implicit from the page / time-slot headers)
- Time range (start + end)
- Room/location (all show "TBA" in the current dump — rooms not yet assigned)
- Session title
- Division/Section
- Session submission type

**Fields NOT available in the listing pages (require separate detail page fetches):**
- Chair(s) and co-chair(s)
- Discussant(s)
- Papers (titles, authors, affiliations)

This is an important constraint for Task 3. The parser will only be able to populate the
session-level summary fields from these files. `chair`, `co_chair`, `discussant`, and `papers`
will be empty arrays unless a second scrape of individual session detail pages is performed.

---

## Session Count

| File | Sessions |
|------|----------|
| day1-2026-04-23.html | 298 |
| day2-2026-04-24.html | 363 |

---

## Overall Page Structure

The 298 sessions live in a single `<ul data-role="listview" class="ui-listview">` (the 5th `<ul>` 
in the document). This UL has 309 direct `<li>` children:
- 1 list-divider LI: the day header ("Thursday, April 23, 2026 CDT")
- 10 static LIs: time-slot headers ("Thursday, April 23, 8:00am CDT ...")
- 298 session LIs: `<li class="ui-li-has-alt">`

---

## Session Container

**Primary selector:** `div.ui-grid-a[id^="session_"]`

- One per session; the `id` and `name` attributes both hold the official session ID string
  in the form `session_NNNNNNN` (e.g., `session_2315178`).
- Also present: a paired `<div id="session_result_NNNNNNN">` (always empty in the listing page).
- The `div.ui-grid-a` is nested inside `<a class="ul-li-has-alt-left ui-btn">` which is
  inside `<li class="ui-li-has-alt">`.
- All session fields (title, division, type) are `<p>` siblings of the `div.ui-grid-a`,
  also inside the same `<a>` tag.

**ID extraction:**
```python
session_div = soup.select_one('div.ui-grid-a[id^="session_"]')
full_id   = session_div['id']            # "session_2315178"
numeric_id = full_id.replace('session_', '')  # "2315178"
```

**To iterate all sessions:**
```python
sessions = soup.select('div.ui-grid-a[id^="session_"]')
# len(sessions) == 298 for day1
```

---

## Session Fields

### Session ID
- **Location:** `id` attribute of `div.ui-grid-a`
- **Format:** `session_NNNNNNN` (strip prefix to get numeric ID)
- **Example:** `id="session_2315178"` → numeric ID `2315178`
- **Also in:** `name` attribute of same div; `session_id` attribute of the second `<a>` in the LI

### Date / Time Range
- **Container:** `div.ui-block-a` (inside `div.ui-grid-a`)
- **Selector:** `div.ui-grid-a .ui-block-a p[style]`
  (second `<p>` — the first `<p>` is empty)
- **Format:** `"H:MM to H:MMam/pm CDT (H:MM to H:MMam/pm GMT-0600)"`
- **Examples from day 1:**
  - `"8:00 to 9:30am CDT (7:00 to 8:30am GMT-0600)"`
  - `"9:50 to 11:20am CDT (8:50 to 10:20am GMT-0600)"`
  - `"11:40am to 1:10pm CDT (10:40am to 12:10pm GMT-0600)"`
  - `"12:00 to 2:30pm CDT (11:00am to 1:30pm GMT-0600)"`
  - `"8:00am to 6:30pm CDT (7:00am to 5:30pm GMT-0600)"` ← Meeting/Reception edge case
- **Note:** The start and end times can span am/pm boundary. The format is inconsistent —
  sometimes both have am/pm, sometimes only the end does. Parse with regex, not strptime.
- **13 unique time strings** in day1.

**Parsing hint:**
```python
time_text = session_div.select_one('.ui-block-a p[style]').get_text(strip=True)
# e.g. "8:00 to 9:30am CDT (7:00 to 8:30am GMT-0600)"
# Strip the GMT parenthetical: time_text.split('(')[0].strip()
# → "8:00 to 9:30am CDT"
```

### Room / Location
- **Container:** `div.ui-block-b` (inside `div.ui-grid-a`)
- **Selector:** `div.ui-grid-a .ui-block-b p[style]`
- **Example:** `"TBA"` (all 298 sessions in day1 show "TBA" — rooms not yet assigned in this dump)
- **Expected future format** (based on allacademic convention): hotel room name string

### Session Title
- **Selector:** Inside the parent `<a>` tag, the `<p style="white-space: normal;">` that
  contains a `<strong>` tag **without** the labels "Section:" or "Session Submission Type:"
- **Content:** The `<strong>` tag wraps the entire title text; there is no trailing text outside the strong.
- **Example:** `<p style="white-space: normal;"><strong>Electoral Accountability and Public Opinion Research</strong></p>`
- **Extraction:**
  ```python
  parent_a = session_div.find_parent('a')
  for p in parent_a.find_all('p', style=lambda v: v and 'white-space' in v):
      strong = p.find('strong')
      if strong and 'Section:' not in p.get_text() and 'Session Submission Type:' not in p.get_text():
          title = strong.get_text(strip=True)
          break
  ```

### Division (Section)
- **Selector:** `<p>` inside the parent `<a>` whose text contains `"Section:"`
- **Structure:** `<p style="white-space: normal;"><strong>Section: </strong>TEXT</p>`
  where TEXT is the NavigableString sibling after `<strong>`.
- **Format:** `"NN. Division Name"` (2-digit number + period + name)
- **Example:** `"02. Representation & Electoral Systems"`, `"29. (Post) Communist Countries"`
- **Extraction:**
  ```python
  for p in parent_a.find_all('p'):
      if 'Section:' in p.get_text():
          strong = p.find('strong')
          division = str(strong.next_sibling).strip()  # e.g. "02. Representation & Electoral Systems"
          break
  ```

### Session Type
- **Selector:** `<p>` inside the parent `<a>` whose text contains `"Session Submission Type:"`
- **Structure:** `<p style="white-space: normal;"><strong>Session Submission Type: </strong>TEXT</p>`
- **Values seen in day1:** `Paper Session` (232), `Complete Panel` (23), `Roundtable` (20),
  `Lightning Talk` (18), `Meeting/Reception` (4), `Working Groups` (1)
- **Example:** `"Paper Session"`, `"Roundtable"`
- **Extraction:**
  ```python
  for p in parent_a.find_all('p'):
      if 'Session Submission Type:' in p.get_text():
          strong = p.find('strong')
          session_type = str(strong.next_sibling).strip()
          break
  ```

---

## Participants (Chair, Co-chair, Discussant)

**Not available in the listing pages.** These fields are only present on individual session
detail pages (`cmd=Online+Program+View+Session&selected_session_id=NNNNNNN`).

The parser should emit empty arrays for these fields:
```json
"chair": [],
"co_chair": [],
"discussant": []
```

---

## Papers

**Not available in the listing pages.** Papers (titles and authors) are only on detail pages.

The parser should emit an empty array:
```json
"papers": []
```

---

## Anomalies / Edge Cases

1. **All rooms are "TBA"** in the current dump (day1 and day2 both confirmed). The room field
   should be stored as-is; do not treat "TBA" as an error.

2. **Inconsistent time format.** The start time sometimes omits am/pm when it shares the same
   period as the end time (e.g., `"8:00 to 9:30am"` — start is 8:00 AM but `am` is omitted).
   Parse with a regex that tolerates missing am/pm on the start token.

3. **Special session types.** `Meeting/Reception` has an 8-hour span
   (`"8:00am to 6:30pm CDT"`). `Working Groups` also appears. The parser should pass these
   through as-is without special-casing.

4. **HTML attribute whitespace variation.** The time `<p>` uses `style="white-space:normal;"` 
   (no space after colon) while room and other `<p>` elements use `style="white-space: normal;"` 
   (space after colon). Use `lambda v: v and 'white-space' in v` rather than exact match.

5. **`session_result_NNNNNNN` paired div** is always empty in the listing page. Ignore it.

6. **Double URL** in href: the allacademic URLs use `//one/` (double slash). This is intentional
   on their end. Do not normalize it.

7. **HTML entity in division names.** E.g., `"29. (Post) Communist Countries"` and
   `"51. Public Policy"` are clean, but section names like `"Assymetries, cooperation..."` appear.
   BeautifulSoup handles entity decoding automatically (`&amp;` → `&`).

8. **All 298 sessions in day1 have all 4 fields present** (id, time, room, title, division,
   type) — no missing fields found in the full scan.

---

## Selector Quick Reference

| Field | Selector / Method | Notes |
|-------|------------------|-------|
| Session container | `div.ui-grid-a[id^="session_"]` | 298 per day1 |
| Session numeric ID | `div['id'].replace('session_', '')` | e.g. `"2315178"` |
| Time range | `.ui-block-a p[style*="white-space"]` | CDT + GMT in parens |
| Room | `.ui-block-b p[style*="white-space"]` | Currently all "TBA" |
| Title | `parent_a > p > strong` (not Section/Type p) | strong wraps full title |
| Division | `parent_a > p` containing `"Section:"` → strong.next_sibling | `"NN. Name"` format |
| Session type | `parent_a > p` containing `"Session Submission Type:"` → strong.next_sibling | 6 values in day1 |
| Chair | N/A — listing page only | Always `[]` |
| Co-chair | N/A — listing page only | Always `[]` |
| Discussant | N/A — listing page only | Always `[]` |
| Papers | N/A — listing page only | Always `[]` |

---

## Detail URL Pattern (for future second-pass scrape)

```
https://convention2.allacademic.com//one/mpsa/mpsa26/index.php?cmd=Online+Program+View+Session&selected_session_id=NNNNNNN&PHPSESSID=...
```

The `PHPSESSID` is session-specific and will differ per browser session. A second-pass scrape
would need a valid session cookie and would need to visit 298 + 363 + ... URLs.
