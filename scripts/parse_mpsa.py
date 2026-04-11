"""
parse_mpsa.py — Parse a single MPSA 2026 session detail HTML page.

Usage:
    from parse_mpsa import parse_session
    session = parse_session(html_string)
"""

import re
from bs4 import BeautifulSoup, NavigableString

# ---------------------------------------------------------------------------
# Month name → month number (full conference is in April, but support all 12)
# ---------------------------------------------------------------------------
_MONTH_MAP = {
    "January": 1, "February": 2, "March": 3, "April": 4,
    "May": 5, "June": 6, "July": 7, "August": 8,
    "September": 9, "October": 10, "November": 11, "December": 12,
}

# h4 role labels that map to canonical output keys (chair / co_chair / discussant)
_CANONICAL_ROLE_PATTERNS = {
    re.compile(r"^Chairs?$"):      "chair",
    re.compile(r"^Co-Chairs?$"):   "co_chair",
    re.compile(r"^Discussants?$"): "discussant",
}

# h4 role labels that are person-bearing but non-canonical → go into participants list.
# Each matched label is stored verbatim as the "role" field on each person entry.
_PARTICIPANT_ROLE_PATTERNS = [
    re.compile(r"^Participants?$"),
    re.compile(r"^Coordinators?$"),
    re.compile(r"^Lecturer$"),
]

# h4 labels that are NOT person-bearing — skip entirely.
_NON_PERSON_H4 = frozenset({
    "Section",
    "Individual Presentations",
    "Audience Participation",
    "Brief Overview",
    "Cosponsor",
    "Cosponsors",
    "Co-sponsor",
    "Co-sponsors",
})


# ---------------------------------------------------------------------------
# Helper: parse ISO date from header string like "Thu, April 23"
# ---------------------------------------------------------------------------
def _parse_date(date_str: str) -> str:
    """Convert 'Thu, April 23' → '2026-04-23'."""
    # date_str is like "Thu, April 23"
    m = re.match(r"\w+, (\w+) (\d+)", date_str)
    if not m:
        return ""
    month_name, day = m.group(1), int(m.group(2))
    month = _MONTH_MAP.get(month_name, 0)
    return f"2026-{month:02d}-{day:02d}"


# ---------------------------------------------------------------------------
# Helper: convert time string to 24h "HH:MM"
# ---------------------------------------------------------------------------
def _to_24h(time_str: str, period: str) -> str:
    """Convert '8:00' + 'am' → '08:00'; '1:10' + 'pm' → '13:10'."""
    h, m = time_str.split(":")
    h = int(h)
    if period == "am":
        if h == 12:
            h = 0
    else:  # pm
        if h != 12:
            h += 12
    return f"{h:02d}:{m}"


# ---------------------------------------------------------------------------
# Helper: parse the date/time/room <strong> text into components
# ---------------------------------------------------------------------------
_DATETIME_RE = re.compile(
    r"^(\w+, \w+ \d+), (\d+:\d+(?:am|pm)?) to (\d+:\d+(?:am|pm)) \w+ \(.*?\), (.+)$"
)


def _parse_datetime_room(text: str) -> dict:
    """
    Parse 'Thu, April 23, 8:00 to 9:30am CDT (8:00 to 9:30am CDT), TBA'
    Returns dict with date, start_time, end_time, time_slot, room.
    """
    m = _DATETIME_RE.match(text)
    if not m:
        return {}

    date_str = m.group(1)   # e.g. "Thu, April 23"
    start_raw = m.group(2)  # e.g. "8:00" or "11:40am"
    end_raw = m.group(3)    # e.g. "9:30am" — always has period
    room = m.group(4).strip()

    # Extract period from end_raw (always present)
    end_period_m = re.search(r"(am|pm)$", end_raw)
    end_period = end_period_m.group(1)
    end_time_digits = end_raw[: end_period_m.start()]

    # Determine start period (inherit from end if missing)
    start_period_m = re.search(r"(am|pm)$", start_raw)
    if start_period_m:
        start_period = start_period_m.group(1)
        start_time_digits = start_raw[: start_period_m.start()]
    else:
        start_period = end_period
        start_time_digits = start_raw

    # Build human time_slot label from the raw start (before 24h conversion)
    # e.g. "8:00" → "8:00 AM", "11:40am" → "11:40 AM"
    slot_h, slot_m = start_time_digits.split(":")
    slot_period_label = start_period.upper()
    time_slot = f"{int(slot_h)}:{slot_m} {slot_period_label}"

    return {
        "date": _parse_date(date_str),
        "start_time": _to_24h(start_time_digits, start_period),
        "end_time": _to_24h(end_time_digits, end_period),
        "time_slot": time_slot,
        "room": room,
    }


# ---------------------------------------------------------------------------
# Helper: extract session ID from the Direct-link <input> inside the HTML
# ---------------------------------------------------------------------------
def _extract_session_id(soup: BeautifulSoup) -> str:
    for inp in soup.find_all("input"):
        val = inp.get("value", "")
        if "view_session/" in val:
            return val.rstrip("/").rsplit("/", 1)[-1]
    return ""


# ---------------------------------------------------------------------------
# Helper: parse a single author segment (list of (type, value) nodes)
# ---------------------------------------------------------------------------
def _parse_author_segment(seg: list) -> dict:
    """
    Parse one author's token sequence into {name, affiliation}.

    Each segment is a list of ('TAG_I', text) or ('TEXT', text) pairs
    for one author's span of the paper (or person-role) <p>.

    WHY THIS FSM EXISTS — the duplicate-surname anomaly
    ---------------------------------------------------
    A small number of MPSA records have a data-quality bug where the last name
    appears twice inside consecutive <i> tags, with the first occurrence ending
    in a raw comma:

        <i>Ajit</i> <i>Phadnis,</i> <i>Phadnis</i>

    The naive "join all <i> tags, strip trailing commas" algorithm produces the
    wrong name "Ajit Phadnis Phadnis" (triplicate/duplicate surname).  A simpler
    fix of de-duplicating tokens would silently break people whose names really
    do repeat a word.

    FSM RULE: if any <i> tag ends with a raw comma (','), that tag is treated as
    the LAST name token.  All subsequent <i> tags in the same author segment are
    considered affiliation artifacts (the duplicate-surname repetition) and are
    skipped.  Text nodes that follow also go to the affiliation, as usual.

    Result for the Phadnis case:
        name        = "Ajit Phadnis"      (comma-terminated <i> stripped)
        affiliation = ""                  (the duplicate <i>Phadnis</i> dropped)

    Name: all <i> text tokens rstripped of commas, joined with spaces,
          up to and including the first comma-terminated token.
    Affiliation: text nodes after the name <i> sequence, stripped of leading ', '.
    """
    name_parts = []
    aff_texts = []
    in_name = True

    for typ, val in seg:
        if in_name:
            if typ == "TAG_I":
                raw = val
                name_parts.append(raw.rstrip(","))
                if raw.endswith(","):
                    in_name = False  # trailing comma → switch to affiliation
            elif typ == "TEXT":
                stripped = val.strip()
                if name_parts and stripped:
                    # Non-whitespace text after at least one name <i> = affiliation
                    aff_texts.append(val)
                    in_name = False
                # Else: whitespace between name <i> tokens — skip
        else:
            if typ == "TEXT":
                aff_texts.append(val)
            # TAG_I in affiliation mode: duplicate-surname artifact — skip

    name = " ".join(name_parts)
    aff = "".join(aff_texts).strip().lstrip(",").strip()
    return {"name": name, "affiliation": aff}


# ---------------------------------------------------------------------------
# Helper: extract authors from nodes after the <strong> title in a paper <p>
# ---------------------------------------------------------------------------
def _parse_paper_authors(strong_tag) -> list:
    """
    Walk siblings after <strong> in a paper <p style='white-space:normal'>.
    Split on '; ' text separators → one segment per author → call _parse_author_segment.
    Skips the leading ' - ' separator.
    """
    # Collect (type, value) pairs for all siblings after <strong>
    all_nodes = []
    for node in strong_tag.next_siblings:
        if isinstance(node, NavigableString):
            all_nodes.append(("TEXT", str(node)))
        elif getattr(node, "name", None) == "i":
            all_nodes.append(("TAG_I", node.get_text(strip=True)))

    # Skip the leading ' - ' text node
    start = 0
    if all_nodes and all_nodes[0] == ("TEXT", " - "):
        start = 1
    all_nodes = all_nodes[start:]

    # Split into per-author segments on '; ' within TEXT nodes
    segments = []
    current_seg = []
    for typ, val in all_nodes:
        if typ == "TEXT" and "; " in val:
            parts = val.split("; ")
            current_seg.append(("TEXT", parts[0]))
            segments.append(current_seg)
            for part in parts[1:-1]:
                segments.append([("TEXT", part)])
            current_seg = [("TEXT", parts[-1])]
        else:
            current_seg.append((typ, val))
    if current_seg:
        segments.append(current_seg)

    authors = []
    for seg in segments:
        result = _parse_author_segment(seg)
        if result["name"]:  # skip empty segments
            authors.append(result)
    return authors


# ---------------------------------------------------------------------------
# Helper: extract a person from a role <li> (chair, discussant, etc.)
# ---------------------------------------------------------------------------
def _parse_person_li(li) -> dict | None:
    """
    Extract name and affiliation from a participant <li>.
    The relevant <p> has style containing 'white-space' and contains <i> tags.
    """
    person_p = li.find("p", style=lambda s: s and "white-space" in s)
    if not person_p:
        return None

    # Build (type, value) sequence from <p> children
    seg = []
    for child in person_p.children:
        if isinstance(child, NavigableString):
            seg.append(("TEXT", str(child)))
        elif getattr(child, "name", None) == "i":
            seg.append(("TAG_I", child.get_text(strip=True)))

    result = _parse_author_segment(seg)
    if not result["name"]:
        return None
    return result


# ---------------------------------------------------------------------------
# Helper: extract a paper from an "Individual Presentations" <li>
# ---------------------------------------------------------------------------
def _parse_paper_li(li) -> dict | None:
    """Extract title and authors from a paper <li>."""
    paper_p = li.find("p", style=lambda s: s and "white-space" in s)
    if not paper_p:
        return None

    strong = paper_p.find("strong")
    if not strong:
        return None

    title = strong.get_text(strip=True)
    authors = _parse_paper_authors(strong)
    return {"title": title, "authors": authors}


# ---------------------------------------------------------------------------
# Helper: extract a list of persons from a role <ul>
# ---------------------------------------------------------------------------
def _parse_role_ul(ul) -> list:
    if ul is None:
        return []
    people = []
    for li in ul.find_all("li", recursive=False):
        person = _parse_person_li(li)
        if person:
            people.append(person)
    return people


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
def parse_session(detail_html: str) -> dict:
    """
    Parse a single MPSA 2026 session detail HTML page.
    Returns a dict with keys: id, date, start_time, end_time, time_slot,
    room, title, session_type, division, chair, co_chair, discussant,
    participants, papers.

    The ``participants`` list collects every person found under a non-canonical
    role <h4> (Participant/Participants, Coordinator/Coordinators, Lecturer).
    Each entry is {name, affiliation, role} where ``role`` is the h4 label
    as it appeared in the HTML (e.g. "Participants", "Coordinator", "Lecturer").
    """
    soup = BeautifulSoup(detail_html, "html.parser")

    # --- Main container ---
    content_divs = soup.find_all("div", attrs={"data-role": "content"})
    main_inner = content_divs[-1].find("div", class_="undefined")

    # --- Session ID (from Direct-link input) ---
    session_id = _extract_session_id(soup)

    # --- Title ---
    h3 = main_inner.find("h3")
    title = h3.get_text(strip=True) if h3 else ""

    # --- Date / Time / Room (first direct-child <strong> of main_inner) ---
    datetime_str = ""
    for child in main_inner.children:
        if getattr(child, "name", None) == "strong":
            datetime_str = child.get_text(strip=True)
            break
    dt = _parse_datetime_room(datetime_str)

    # --- Session type ---
    session_type = ""
    for p in main_inner.find_all("p", style=lambda s: s and "white-space" in s):
        if "Session Submission Type:" in p.get_text():
            strong = p.find("strong")
            if strong:
                session_type = p.get_text(strip=True).replace(
                    strong.get_text(strip=True), ""
                ).strip()
            break

    # --- Division ---
    division = ""
    section_h4 = main_inner.find("h4", string="Section")
    if section_h4:
        section_ul = section_h4.find_next_sibling("ul")
        if section_ul:
            strong_div = section_ul.find("strong")
            if strong_div:
                division = strong_div.get_text(strip=True)

    # --- Participant roles ---
    chair = []
    co_chair = []
    discussant = []
    participants = []  # non-canonical person-bearing roles

    for h4 in main_inner.find_all("h4"):
        label = h4.get_text(strip=True)

        # Skip non-person sections outright
        if label in _NON_PERSON_H4:
            continue

        # Try canonical roles first
        canonical_matched = False
        for pattern, key in _CANONICAL_ROLE_PATTERNS.items():
            if pattern.match(label):
                ul = h4.find_next_sibling("ul")
                people = _parse_role_ul(ul)
                if key == "chair":
                    chair = people
                elif key == "co_chair":
                    co_chair = people
                elif key == "discussant":
                    discussant = people
                canonical_matched = True
                break

        if canonical_matched:
            continue

        # Try non-canonical person-bearing roles → participants list
        for pattern in _PARTICIPANT_ROLE_PATTERNS:
            if pattern.match(label):
                ul = h4.find_next_sibling("ul")
                people = _parse_role_ul(ul)
                for person in people:
                    person["role"] = label  # store verbatim h4 label
                participants.extend(people)
                break

    # --- Papers ---
    papers = []
    presentations_h4 = main_inner.find("h4", string="Individual Presentations")
    if presentations_h4:
        pres_ul = presentations_h4.find_next_sibling("ul")
        if pres_ul:
            for li in pres_ul.find_all("li", recursive=False):
                paper = _parse_paper_li(li)
                if paper:
                    papers.append(paper)

    return {
        "id": session_id,
        "date": dt.get("date", ""),
        "start_time": dt.get("start_time", ""),
        "end_time": dt.get("end_time", ""),
        "time_slot": dt.get("time_slot", ""),
        "room": dt.get("room", ""),
        "title": title,
        "session_type": session_type,
        "division": division,
        "chair": chair,
        "co_chair": co_chair,
        "discussant": discussant,
        "participants": participants,
        "papers": papers,
    }
