# MPSA HTML Parser — Observed Structure

**NOTE:** This supersedes the earlier listing-based investigation (which covered `raw_html/day*.html` "Browse by Day" pages and could only extract shallow session metadata). The parser for Task 3 reads `raw_html/details/session_{id}.html` detail pages, which are bulk-fetched via `scripts/fetch_details.py`. These contain the full data: chair, discussants, papers, and authors with affiliations.

Investigation date: 2026-04-11
Sessions examined: 2315178, 2306163, 2314926, 2336381, 2307566, 2315885, 2306790, 2308570, 2322203, 2322919, 2324104, 2321869, 2324108, 2322329; full-corpus h4 pattern scan across all 1099 files.

---

## Detail page overall shape

- File is a full jQuery-Mobile HTML document (~23 KB), one per session.
- Most of the body is navigation scaffolding; the session-specific content sits inside a nested div path:
  - Outer container: second `<div data-role="content">` (there are always exactly 2; the first is empty navigation)
  - Inner container: `<div class="undefined">` — the direct child of the outer content div
- **Main container selector (two-step):**
  ```python
  content_divs = soup.find_all('div', attrs={'data-role': 'content'})
  main_inner = content_divs[-1].find('div', class_='undefined')
  ```
  Confirmed across all 1099 files: every session has exactly 2 `data-role="content"` divs, and the last one always contains a `class="undefined"` div.

---

## Session-level fields

### Session ID

Two reliable sources, in order of preference:

1. **Filename** (`session_NNNNNN.html`): always present, no parsing required.
   ```python
   session_id = filename.replace('session_', '').replace('.html', '')
   ```
2. **Direct-link `<input>` value** inside the page:
   ```html
   <input type="text" value="https://convention2.allacademic.com/one/mpsa/mpsa26/online_program_direct_link/view_session/2315178/"/>
   ```
   Extract with:
   ```python
   for inp in soup.find_all('input'):
       if 'view_session' in inp.get('value', ''):
           session_id = inp['value'].rstrip('/').rsplit('/', 1)[-1]
   ```
   This input has no `name`, `id`, or `data-role` attribute; match by `value` content.

**Recommendation:** use the filename — it is simpler and guaranteed correct since `fetch_details.py` names files by session ID.

---

### Title

- **Selector:** the single `<h3>` element anywhere in the document.
- Every session has exactly one `<h3>` (confirmed across all 1099); no disambiguation needed.
- It is a direct child of `main_inner`.
- **Extraction:**
  ```python
  title = main_inner.find('h3').get_text(strip=True)
  ```
- **Example:** `'Electoral Accountability and Public Opinion Research'`
- **Note:** Titles sometimes contain a numeric prefix (poster sessions): `'75-303 - Poster Session: How Do Authoritarian Governments...'`. Store as-is.

---

### Date / Time / Room

- **Selector:** the `<strong>` element that is a **direct child** of `main_inner` (not nested inside a `<li>` or `<div>`).
- It is always the first direct-child `<strong>` of `main_inner`.
- **Extraction:**
  ```python
  for child in main_inner.children:
      if getattr(child, 'name', None) == 'strong':
          datetime_str = child.get_text(strip=True)
          break
  ```
- **Format:** `"DayOfWeek, Month DayNum, H:MM[am|pm] to H:MM[am|pm] TZ (H:MM[am|pm] to H:MM[am|pm] TZ), Room"`
- **Example:** `"Thu, April 23, 8:00 to 9:30am CDT (8:00 to 9:30am CDT), TBA"`
- **All 1099 sessions** have room = `"TBA"` in this dump (rooms not yet assigned).
- **Recommended parsing regex:**
  ```python
  import re
  pattern = r'^(\w+, \w+ \d+), (\d+:\d+(?:am|pm)?) to (\d+:\d+(?:am|pm)) (\w+) \(.*?\), (.+)$'
  m = re.match(pattern, datetime_str)
  date   = m.group(1)   # e.g. "Thu, April 23"
  start  = m.group(2)   # e.g. "8:00" (no am/pm when same period as end) or "11:40am"
  end    = m.group(3)   # e.g. "9:30am" or "1:10pm" — always has am/pm
  tz     = m.group(4)   # "CDT"
  room   = m.group(5)   # "TBA"
  ```
- **Period shorthand rule:** When start and end are in the same am/pm period, the start time omits the suffix (e.g., `"8:00 to 9:30am"` → start is 8:00 AM). When they cross periods, both are explicit (e.g., `"11:40am to 1:10pm"`). The regex above handles both cases via `(?:am|pm)?`.
- **Time-to-24h conversion rule (IMPORTANT for the parser):** After the regex match, if the start time's period is missing, **inherit it from the end time's period.** That is:
  - `"8:00 to 9:30am"` → start period = "am" (inherited), start = 08:00, end = 09:30
  - `"2:00 to 3:30pm"` → start period = "pm" (inherited), start = 14:00, end = 15:30
  - `"11:40am to 1:10pm"` → start period = "am" (explicit), start = 11:40, end = 13:10
- **Observed distribution across all 1,099 sessions** (empirically verified by scanning every detail file):

  | Pattern | Count | Example |
  |---|---|---|
  | `(none)→pm` (inherit pm) | 517 | `"2:00 to 3:30pm"` |
  | `(none)→am` (inherit am) | 407 | `"8:00 to 9:30am"` |
  | `am→pm` (cross-period, explicit) | 175 | `"11:40am to 1:10pm"` |
  | `pm→am` / `pm→pm` (would need `_to_24h` logic adjustment) | 0 | — (none observed) |

  Total: 1,099. The regex + inheritance rule covers 100% of the corpus. No session crosses midnight or has a "pm → am" pattern.

---

### Session Type

- **Selector:** the `<p style="white-space: normal;">` inside `main_inner` whose text contains `"Session Submission Type:"`.
- **Structure:** `<p style="white-space: normal;"><strong>Session Submission Type: </strong>TypeValue</p>`
- **Extraction:**
  ```python
  for p in main_inner.find_all('p', style=lambda s: s and 'white-space' in s):
      if 'Session Submission Type:' in p.get_text():
          strong = p.find('strong')
          session_type = p.get_text(strip=True).replace(strong.get_text(strip=True), '').strip()
          break
  ```
- **All values observed across 1099 sessions:**

  | Type | Count |
  |------|-------|
  | Paper Session | 803 |
  | Roundtable | 72 |
  | Complete Panel | 69 |
  | Poster Session | 67 |
  | Lightning Talk | 57 |
  | Meeting/Reception | 19 |
  | Working Groups | 11 |
  | Lecture | 1 |

---

### Division (Section)

- **Selector:** `<h4>Section</h4>` followed immediately by `<ul data-role="listview">` → `<li>` → `<a>` → `<p>` → `<strong>`.
- **Extraction:**
  ```python
  section_h4 = main_inner.find('h4', string='Section')
  section_ul  = section_h4.find_next_sibling('ul')
  division    = section_ul.find('strong').get_text(strip=True)
  ```
- **Example:** `"02. Representation & Electoral Systems"`, `"29. (Post) Communist Countries"`
- **Format:** `"NN. Name"` (2-digit section number, period, section name).

### Cosponsor(s)

- **Selector:** `<h4>Cosponsor</h4>` or `<h4>Cosponsors</h4>` (check for both), same structure as Section.
- Only present in a subset of sessions (those with cross-listed cosponsors).
- **Extraction:** same pattern as Section → `find_next_sibling('ul').find_all('strong')` for multi-cosponsor case.
- **Example:** `"01. Program Chairs"`, `"32. Comparative Political Economy"`

---

## Participant fields

Each participant section follows the pattern:
```
<h4>RoleLabel</h4>
<ul data-role="listview">
  <li>...<a ...><[optional time div]><p><i>First</i> <i>Last</i>, Affiliation</p></a></li>
  ...
</ul>
```

### Role labels observed (all 33 distinct h4 patterns scanned)

| h4 Text | Notes |
|---------|-------|
| `Chair` | Single chair; most common |
| `Chairs` | Plural form used in Lightning Talk sessions with 2 chairs |
| `Participant` | Singular (rare; roundtables) |
| `Participants` | Plural (roundtables) |
| `Discussant` | Singular |
| `Discussants` | Plural |
| `Coordinator` | Used in Working Group sessions |
| `Coordinators` | Plural form |
| `Lecturer` | Used in Lecture sessions |

**The parser must match role labels case-sensitively** and handle both singular and plural forms.

### Person `<li>` structure — two variants

**Variant A — with timestamp div** (Paper Sessions, Complete Panels):
```html
<li>
  <a href="...">
    <div style="vertical-align: middle; float:left; padding-right: 5px;">
      <p><strong>8:00am</strong> |</p>
    </div>
    <p style="white-space: normal;"><i>Shahana</i> <i>Sheikh</i>, University of Pennsylvania</p>
  </a>
</li>
```

**Variant B — no timestamp div** (Roundtables, Poster Sessions, some others):
```html
<li>
  <a href="...">
    <p style="white-space: normal;"><i>Jennifer</i> <i>Holmquist</i>, Alamo Colleges, Northeast Lakeview College</p>
  </a>
</li>
```

**Person extraction (handles both variants):**
```python
def extract_person(li):
    # The person-data p is the one with style="white-space: normal;" containing <i> tags
    person_p = li.find('p', style=lambda s: s and 'white-space' in s)
    if not person_p:
        return None
    i_tags = person_p.find_all('i')
    if not i_tags:
        return None
    # Name: join all <i> text with spaces, stripping trailing commas from any token
    name = ' '.join(i.get_text(strip=True).rstrip(',') for i in i_tags)
    # Affiliation: text after the last </i> tag
    last_i = i_tags[-1]
    after = last_i.next_sibling
    affiliation = ''
    if after and isinstance(after, str):
        affiliation = after.strip().lstrip(',').strip()
    return {'name': name, 'affiliation': affiliation}
```

**Name anomalies to handle:**
- Middle names / initials: `<i>Tevfik Murat</i> <i>Yildirim</i>` — first `<i>` can contain multiple words (first + middle).
- Middle names as separate `<i>`: `<i>Adam</i> <i>J.</i> <i>Berinsky</i>` — join all three.
- Trailing comma inside an `<i>`: `<i>Phadnis,</i>` — strip with `.rstrip(',')`.
- Triplicate bug: `<i>Ajit</i> <i>Phadnis,</i> <i>Phadnis</i>` — this is a data-quality issue (duplicated surname), not a structural variant. The parser should store whatever the HTML says.

---

## Papers (Individual Presentations)

### Section header

- `<h4>Individual Presentations</h4>` — used for all session types including Poster Session and Lightning Talk.

### Paper `<li>` structure

**Variant A — with timestamp** (most Paper Sessions, Complete Panels):
```html
<li>
  <a href="https://...?cmd=Online+Program+View+Paper&selected_paper_id=2307495&...">
    <div style="vertical-align: middle; float:left; padding-right: 5px;">
      <p><strong>8:05am</strong> |</p>
    </div>
    <p style="white-space: normal;">
      <strong>Paper Title Here</strong> - <i>First</i> <i>Last</i>, Affiliation; <i>First2</i> <i>Last2</i>, Affiliation2
    </p>
  </a>
</li>
```

**Variant B — no timestamp** (Poster Sessions; 67 sessions confirmed):
```html
<li>
  <a href="https://...?cmd=Online+Program+View+Paper&selected_paper_id=2319851&...">
    <p style="white-space: normal;">
      <strong>35. Paper Title Here</strong> - <i>First</i> <i>Last</i>, Affiliation
    </p>
  </a>
</li>
```
Note: Poster session paper titles are prefixed with a numeric ordinal (e.g., `"35. Title"`).

### Paper extraction algorithm

```python
def extract_paper(li):
    paper_p = li.find('p', style=lambda s: s and 'white-space' in s)
    if not paper_p:
        return None

    # Paper ID from the href
    a_tag = li.find('a', href=True)
    href = a_tag['href'] if a_tag else ''
    paper_id = None
    import re
    m = re.search(r'selected_paper_id=(\d+)', href)
    if m:
        paper_id = m.group(1)

    strong = paper_p.find('strong')
    title = strong.get_text(strip=True) if strong else ''

    # Authors come after the <strong> tag, separated by ' - ' from the title
    # then individual authors separated by '; '
    # Within each author entry: <i>First</i> <i>Last</i>, Affiliation
    authors = []
    # Collect all text/tag nodes after the <strong>
    after_strong = []
    for node in strong.next_siblings:
        after_strong.append(node)

    # Reconstruct the raw HTML of the author section and parse it
    # Strategy: find all <i> tags in paper_p AFTER the strong
    i_tags_in_p = paper_p.find_all('i')

    # Split author block on '; ' boundaries
    # Walk node by node, grouping <i> runs into author records
    current_name_parts = []
    current_after_text = ''
    all_authors = []

    for node in strong.next_siblings:
        if getattr(node, 'name', None) == 'i':
            if current_after_text.strip().rstrip(';').strip():
                # We hit a ';' separator — commit previous author
                if current_name_parts:
                    aff = current_after_text.strip().lstrip(',').strip().rstrip(';').strip()
                    all_authors.append({'name': ' '.join(p.rstrip(',') for p in current_name_parts), 'affiliation': aff})
                current_name_parts = []
                current_after_text = ''
            current_name_parts.append(node.get_text(strip=True).rstrip(','))
        elif isinstance(node, str):
            current_after_text += node

    # Commit last author
    if current_name_parts:
        aff = current_after_text.strip().lstrip(',').strip()
        all_authors.append({'name': ' '.join(p.rstrip(',') for p in current_name_parts), 'affiliation': aff})

    return {'paper_id': paper_id, 'title': title, 'authors': all_authors}
```

**Multiple authors separator:** `'; '` (semicolon + space) between author entries within the same `<p>` tag. Some papers have 4+ authors.

**Multi-name boundary detection:** after the `' - '` separator following `<strong>`, text nodes of `'; '` delineate author boundaries; `<i>` tags belong to the next author name.

---

## Brief Overview section

- Present in 64 of 1099 sessions (mainly Roundtables and special meetings).
- Structure: `<h4>Brief Overview</h4><blockquote>Text...</blockquote>`
- Text is plain (no inner tags observed).
- Optional field; store as `brief_overview` string or `None`.

---

## Audience Participation section

- Present in most Paper Session, Complete Panel, and Lightning Talk sessions.
- Structure: `<h4>Audience Participation</h4><ul data-role="listview"><li>...<strong>Time</strong>|Audience participation will last for the remainder of the session.</li>`
- The timestamp and description text are in the same `<li>` structure as papers.
- This section does not represent a person or paper — it is informational only.
- **Recommended:** parse the timestamp out as `audience_participation_start` or ignore entirely.

---

## h4 Section Header Reference

All 33 distinct `<h4>` patterns observed in the corpus (sorted by frequency):

```
['Section', 'Chair', 'Individual Presentations', 'Discussants', 'Audience Participation']  -- most common
['Section', 'Chair', 'Individual Presentations', 'Discussant', 'Audience Participation']
['Section', 'Chair', 'Individual Presentations', 'Audience Participation']
['Section', 'Individual Presentations', 'Discussants', 'Audience Participation']
['Section', 'Individual Presentations', 'Discussant', 'Audience Participation']
['Section', 'Individual Presentations', 'Audience Participation']
['Brief Overview', 'Section', 'Chair', 'Individual Presentations', 'Discussants', 'Audience Participation']
['Brief Overview', 'Section', 'Chair', 'Individual Presentations', 'Discussant', 'Audience Participation']
['Brief Overview', 'Section', 'Chair', 'Individual Presentations', 'Audience Participation']
['Brief Overview', 'Section', 'Chair', 'Participants']
['Brief Overview', 'Section', 'Cosponsor', 'Chair', 'Participants']
['Brief Overview', 'Section', 'Cosponsors', 'Chair', 'Participants']
['Brief Overview', 'Section', 'Chair', 'Participant']
['Brief Overview', 'Section', 'Participants']
['Brief Overview', 'Section', 'Lecturer', 'Chair']
['Brief Overview', 'Section', 'Participant', 'Coordinator']
['Brief Overview', 'Section']
['Section', 'Chair', 'Participants']
['Section', 'Chair', 'Participant']
['Section', 'Chairs']
['Section', 'Chairs', 'Individual Presentations', 'Audience Participation']
['Section', 'Cosponsor', 'Chair', 'Individual Presentations', 'Discussant', 'Audience Participation']
['Section', 'Cosponsor', 'Chair', 'Individual Presentations', 'Discussants', 'Audience Participation']
['Section', 'Cosponsors', 'Chair', 'Individual Presentations', 'Discussants', 'Audience Participation']
['Section', 'Cosponsor', 'Individual Presentations', 'Discussant', 'Audience Participation']
['Section', 'Cosponsors', 'Chair', 'Participants']
['Section', 'Individual Presentations']
['Section', 'Individual Presentations', 'Discussant']
['Section', 'Individual Presentations', 'Discussants']
['Section', 'Cosponsor']
['Section', 'Participants', 'Coordinator']
['Section', 'Participants', 'Coordinators']
['Section']
```

---

## Anomalies the parser must handle

1. **Singular vs plural role labels.** `Chair` and `Chairs`, `Discussant` and `Discussants`, `Participant` and `Participants`, `Coordinator` and `Coordinators` all appear. Use case-insensitive prefix matching or an explicit allowlist: `{'chair', 'chairs', 'participant', 'participants', 'discussant', 'discussants', 'coordinator', 'coordinators', 'lecturer'}`.

2. **Timestamp div present/absent per-role.** Paper Session chairs have a timestamp div; Roundtable chairs do not. Individual Presentations in Poster Sessions (67 sessions) have no timestamp div. Person extraction must not depend on the timestamp div.

3. **Malformed duplicate surname in `<i>` tags.** `<i>Ajit</i> <i>Phadnis,</i> <i>Phadnis</i>` — the comma inside `<i>Phadnis,</i>` is a data-quality artifact. Strip trailing commas from every `<i>` text token with `.rstrip(',')`.

4. **Multi-word first names inside a single `<i>`.** `<i>Tevfik Murat</i> <i>Yildirim</i>` — the first `<i>` contains first name + middle name as a single string. This is intentional formatting. Join all `<i>` tokens with spaces.

5. **Author affiliation containing commas.** Affiliation text itself contains commas (e.g., `"University of Virginia, Main Campus"`, `"Alamo Colleges, Northeast Lakeview College"`). Do not split on commas to get affiliation — everything after the last `</i>` tag (with leading `, ` stripped) is the full affiliation string.

6. **Missing Chair entirely.** 64+ sessions (all-text roundtables, meetings, empty-shell sessions) have no `<h4>Chair</h4>` at all. Emit `chair: []` when absent.

7. **Missing Individual Presentations entirely.** Sessions with only `Section` or `Section + Chair + Participants` structure have no papers. Emit `papers: []` when absent.

8. **Poster session paper titles prefixed with ordinals.** E.g., `"35. A Comparative Analysis of..."`. The prefix is part of the `<strong>` text. Store as-is; strip if a clean title is needed with `re.sub(r'^\d+\.\s*', '', title)`.

9. **Non-ASCII characters in names and affiliations.** E.g., `Böhmelt`, `Søren`, `Etzerodt`. BeautifulSoup handles UTF-8 decoding automatically; no special handling needed.

10. **Session with only `<h4>Section</h4>`.** Meetings/Receptions and some special sessions (e.g., `"Separation of Powers: Breakfast"`) have no participants, papers, or overview at all. The parser should return empty collections without error.

---

## Selector Quick Reference

| Field | Selector / Method | Notes |
|-------|------------------|-------|
| Main container | `soup.find_all('div', attrs={'data-role':'content'})[-1].find('div', class_='undefined')` | Always the last content div |
| Session ID | filename `session_NNNNNN.html` | Or parse `<input>` `value` containing `view_session/` |
| Title | `main_inner.find('h3').get_text(strip=True)` | Exactly one h3 per page |
| Date/time/room | Direct-child `<strong>` of `main_inner` | Regex parse |
| Session type | `<p>` with `'Session Submission Type:'` in text → text after `<strong>` | 8 distinct types |
| Division | `main_inner.find('h4', string='Section')` → next-sibling `<ul>` → `find('strong').get_text()` | `"NN. Name"` format |
| Cosponsor | `main_inner.find('h4', string=re.compile(r'Cosponsor'))` → same UL pattern | Optional; singular or plural |
| Chair(s) | `main_inner.find('h4', string=re.compile(r'^Chairs?$'))` → next-sibling `<ul>` | Optional |
| Participants | `main_inner.find('h4', string=re.compile(r'^Participants?$'))` → next-sibling `<ul>` | Roundtable role |
| Discussant(s) | `main_inner.find('h4', string=re.compile(r'^Discussants?$'))` → next-sibling `<ul>` | Optional |
| Coordinator(s) | `main_inner.find('h4', string=re.compile(r'^Coordinators?$'))` → next-sibling `<ul>` | Working Group role |
| Lecturer | `main_inner.find('h4', string='Lecturer')` → next-sibling `<ul>` | Lecture sessions only |
| Papers | `main_inner.find('h4', string='Individual Presentations')` → next-sibling `<ul>` → each `<li>` | Optional |
| Paper ID | `<a href>` → `selected_paper_id=NNNNNN` in URL | Each paper `<li>` `<a>` |
| Paper title | `<strong>` in paper `<p style="white-space: normal;">` | After any ordinal prefix |
| Person name | Join `<i>.get_text().rstrip(',')` for all `<i>` in person `<p>` | Space-joined |
| Affiliation | Text after last `</i>` in person `<p>`, strip leading `, ` | May contain commas |
| Brief Overview | `main_inner.find('h4', string='Brief Overview')` → next sibling `<blockquote>` | Present in 64/1099 |
