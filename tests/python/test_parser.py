import unittest
from pathlib import Path
import sys
import re

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from parse_mpsa import parse_session, _parse_datetime_room

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "sample_session.html"


class ParseSessionSample2315178Test(unittest.TestCase):
    """Tests against the sample_session.html fixture (session 2315178)."""

    @classmethod
    def setUpClass(cls):
        cls.html = FIXTURE.read_text(encoding="utf-8")
        cls.s = parse_session(cls.html)

    def test_id_is_numeric_string(self):
        self.assertEqual(self.s["id"], "2315178")

    def test_title(self):
        self.assertEqual(self.s["title"], "Electoral Accountability and Public Opinion Research")

    def test_date_is_iso(self):
        self.assertEqual(self.s["date"], "2026-04-23")

    def test_start_time_24h(self):
        self.assertEqual(self.s["start_time"], "08:00")

    def test_end_time_24h(self):
        self.assertEqual(self.s["end_time"], "09:30")

    def test_time_slot_label(self):
        self.assertEqual(self.s["time_slot"], "8:00 AM")

    def test_room(self):
        self.assertEqual(self.s["room"], "TBA")

    def test_session_type(self):
        self.assertEqual(self.s["session_type"], "Paper Session")

    def test_division(self):
        self.assertEqual(self.s["division"], "02. Representation & Electoral Systems")

    def test_chair(self):
        self.assertEqual(len(self.s["chair"]), 1)
        self.assertEqual(self.s["chair"][0]["name"], "Shahana Sheikh")
        self.assertEqual(self.s["chair"][0]["affiliation"], "University of Pennsylvania")

    def test_co_chair_empty(self):
        self.assertEqual(self.s["co_chair"], [])

    def test_discussants(self):
        self.assertEqual(len(self.s["discussant"]), 2)
        names = {d["name"] for d in self.s["discussant"]}
        self.assertIn("Sofia Marini", names)
        self.assertIn("Tevfik Murat Yildirim", names)

    def test_has_four_papers(self):
        self.assertEqual(len(self.s["papers"]), 4)

    def test_first_paper_title(self):
        self.assertEqual(
            self.s["papers"][0]["title"],
            "Institutional Trust, Political Participation and Social Structure in India",
        )

    def test_first_paper_has_two_authors(self):
        authors = self.s["papers"][0]["authors"]
        self.assertEqual(len(authors), 2)

    def test_first_paper_author_names(self):
        authors = self.s["papers"][0]["authors"]
        names = [a["name"] for a in authors]
        self.assertIn("Abhishek Priyadarshi", names)
        self.assertIn("Ajit Phadnis", names)

    def test_first_paper_author_affiliation(self):
        authors = self.s["papers"][0]["authors"]
        # Both should have the same affiliation
        for a in authors:
            self.assertEqual(a["affiliation"], "Indian Institute of Management Indore")

    def test_all_fields_present(self):
        for field in (
            "id", "date", "start_time", "end_time", "time_slot", "room",
            "title", "session_type", "division",
            "chair", "co_chair", "discussant", "papers",
        ):
            self.assertIn(field, self.s, f"missing field: {field}")

    def test_has_all_people_field(self):
        self.assertIn("all_people", self.s)
        self.assertIsInstance(self.s["all_people"], list)

    def test_all_people_is_lowercase(self):
        for name in self.s["all_people"]:
            self.assertEqual(name, name.lower(),
                             f"all_people entry not lowercased: {name!r}")

    def test_all_people_contains_chair(self):
        self.assertIn("shahana sheikh", self.s["all_people"])

    def test_all_people_contains_discussants(self):
        self.assertIn("sofia marini", self.s["all_people"])
        self.assertIn("tevfik murat yildirim", self.s["all_people"])

    def test_all_people_contains_paper_authors(self):
        self.assertIn("abhishek priyadarshi", self.s["all_people"])
        self.assertIn("ajit phadnis", self.s["all_people"])

    def test_all_people_no_duplicates(self):
        self.assertEqual(len(self.s["all_people"]), len(set(self.s["all_people"])))

    def test_all_people_no_affiliations(self):
        # Affiliation text like "University of Pennsylvania" should NOT be in all_people
        for name in self.s["all_people"]:
            self.assertNotIn("university", name)
            self.assertNotIn("institute", name)


DETAILS_DIR = Path(__file__).resolve().parents[2] / "raw_html" / "details"


class ParseSessionParticipantsTest(unittest.TestCase):
    """Tests for non-canonical roles -> participants field (Issue 1)."""

    def _load(self, session_id: str) -> dict:
        html = (DETAILS_DIR / f"session_{session_id}.html").read_text(encoding="utf-8")
        return parse_session(html)

    # --- session 2306163: Roundtable with Participants role ---
    def test_roundtable_participants_field_present(self):
        s = self._load("2306163")
        self.assertIn("participants", s)

    def test_roundtable_participants_nonempty(self):
        s = self._load("2306163")
        self.assertGreater(len(s["participants"]), 0)

    def test_roundtable_participants_role_label(self):
        s = self._load("2306163")
        roles = {p["role"] for p in s["participants"]}
        self.assertIn("Participants", roles)

    def test_roundtable_participants_has_name(self):
        s = self._load("2306163")
        for p in s["participants"]:
            self.assertTrue(p["name"], f"Empty name in {p}")

    # --- session 2324108: Lecture with Lecturer role ---
    def test_lecture_participants_field_present(self):
        s = self._load("2324108")
        self.assertIn("participants", s)

    def test_lecture_participants_nonempty(self):
        s = self._load("2324108")
        self.assertGreater(len(s["participants"]), 0)

    def test_lecture_participants_role_label(self):
        s = self._load("2324108")
        roles = {p["role"] for p in s["participants"]}
        self.assertIn("Lecturer", roles)

    def test_lecture_lecturer_name(self):
        s = self._load("2324108")
        lecturers = [p for p in s["participants"] if p["role"] == "Lecturer"]
        self.assertEqual(len(lecturers), 1)
        self.assertEqual(lecturers[0]["name"], "Lotte Andersen")
        self.assertEqual(lecturers[0]["affiliation"], "Aarhus University")

    # --- session 2322329: Working Group with Coordinator + Participants ---
    def test_working_group_participants_field_present(self):
        s = self._load("2322329")
        self.assertIn("participants", s)

    def test_working_group_participants_nonempty(self):
        s = self._load("2322329")
        self.assertGreater(len(s["participants"]), 0)

    def test_working_group_coordinator_role_label(self):
        s = self._load("2322329")
        roles = {p["role"] for p in s["participants"]}
        self.assertIn("Coordinator", roles)

    def test_working_group_participants_role_label(self):
        s = self._load("2322329")
        roles = {p["role"] for p in s["participants"]}
        self.assertIn("Participants", roles)

    # --- existing fields must still be present (participants is additive) ---
    def test_all_fields_include_participants(self):
        s = self._load("2306163")
        for field in (
            "id", "date", "start_time", "end_time", "time_slot", "room",
            "title", "session_type", "division",
            "chair", "co_chair", "discussant", "papers", "participants",
        ):
            self.assertIn(field, s, f"missing field: {field}")

    # --- participants must NOT include chair/co_chair/discussant people ---
    def test_chair_not_in_participants(self):
        """Chair should stay in chair field, not bleed into participants."""
        s = self._load("2306163")
        participant_names = {p["name"] for p in s["participants"]}
        chair_names = {p["name"] for p in s["chair"]}
        self.assertTrue(
            participant_names.isdisjoint(chair_names),
            f"Overlap between chair and participants: {participant_names & chair_names}",
        )


class ParseDateTimeRoomTest(unittest.TestCase):
    """Unit tests for _parse_datetime_room covering all three period patterns (Issue 3)."""

    def test_period_inherit_am(self):
        """Pattern: 'H:MM to H:MMam' — start inherits am from end."""
        result = _parse_datetime_room(
            "Fri, April 24, 9:50 to 11:20am CDT (9:50 to 11:20am CDT), TBA"
        )
        self.assertEqual(result["date"], "2026-04-24")
        self.assertEqual(result["start_time"], "09:50")
        self.assertEqual(result["end_time"], "11:20")
        self.assertEqual(result["time_slot"], "9:50 AM")
        self.assertEqual(result["room"], "TBA")

    def test_period_inherit_pm(self):
        """Pattern: 'H:MM to H:MMpm' — start inherits pm from end."""
        result = _parse_datetime_room(
            "Thu, April 23, 1:30 to 3:00pm CDT (1:30 to 3:00pm CDT), TBA"
        )
        self.assertEqual(result["date"], "2026-04-23")
        self.assertEqual(result["start_time"], "13:30")
        self.assertEqual(result["end_time"], "15:00")
        self.assertEqual(result["time_slot"], "1:30 PM")
        self.assertEqual(result["room"], "TBA")

    def test_cross_period_am_pm(self):
        """Pattern: 'H:MMam to H:MMpm' — explicit am/pm on both ends."""
        result = _parse_datetime_room(
            "Thu, April 23, 11:40am to 1:10pm CDT (11:40am to 1:10pm CDT), TBA"
        )
        self.assertEqual(result["date"], "2026-04-23")
        self.assertEqual(result["start_time"], "11:40")
        self.assertEqual(result["end_time"], "13:10")
        self.assertEqual(result["time_slot"], "11:40 AM")
        self.assertEqual(result["room"], "TBA")

    def test_invalid_returns_empty(self):
        """Malformed input returns empty dict without crashing."""
        result = _parse_datetime_room("not a datetime string")
        self.assertEqual(result, {})


class ParseSessionLectureTest(unittest.TestCase):
    """Verify all_people includes participants (non-canonical roles).

    Uses session_2324108 which is a Lecture with Lotte Andersen as Lecturer.
    The lecturer must appear in all_people in lowercase form.
    """

    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[2] / "raw_html" / "details" / "session_2324108.html"
        if not path.exists():
            raise unittest.SkipTest("session_2324108.html not present")
        cls.s = parse_session(path.read_text(encoding="utf-8"))

    def test_lecturer_in_all_people(self):
        # session_2324108 is a Lecture with Lotte Andersen as Lecturer
        names = self.s["all_people"]
        # The lecturer's name should appear in lowercase
        self.assertTrue(any("andersen" in n for n in names),
                        f"Lecturer not in all_people: {names}")

    def test_lecturer_name_is_lowercased(self):
        names = self.s["all_people"]
        self.assertIn("lotte andersen", names)


class BuildProgramTest(unittest.TestCase):
    """Tests for the top-level program structure builder."""

    @classmethod
    def setUpClass(cls):
        # Parse the fixture twice with different dates to exercise multi-day logic
        html = FIXTURE.read_text(encoding="utf-8")
        s1 = parse_session(html)  # date from HTML: 2026-04-23
        # Hand-fabricate a second session with a different date / division / type
        s2 = {
            **s1,
            "id": "9999999",
            "date": "2026-04-25",
            "division": "99. Fake Division for Testing",
            "session_type": "Roundtable",
        }
        cls.sessions = [s1, s2]
        from parse_mpsa import build_program
        cls.prog = build_program(cls.sessions)

    def test_has_meta(self):
        self.assertIn("meta", self.prog)
        self.assertEqual(self.prog["meta"]["conference"], "MPSA 2026")

    def test_generated_at_is_iso8601_utc(self):
        ts = self.prog["meta"]["generated_at"]
        # Must parse; must end with +00:00 or Z
        self.assertRegex(ts, r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")
        self.assertTrue(ts.endswith("+00:00") or ts.endswith("Z"))

    def test_days_sorted_unique(self):
        self.assertEqual(self.prog["meta"]["days"], ["2026-04-23", "2026-04-25"])

    def test_divisions_sorted_unique(self):
        divs = self.prog["divisions"]
        self.assertEqual(divs, sorted(set(divs)))
        self.assertIn("02. Representation & Electoral Systems", divs)
        self.assertIn("99. Fake Division for Testing", divs)

    def test_session_types_sorted_unique(self):
        types = self.prog["session_types"]
        self.assertEqual(types, sorted(set(types)))
        self.assertIn("Paper Session", types)
        self.assertIn("Roundtable", types)

    def test_sessions_pass_through_unchanged(self):
        self.assertEqual(len(self.prog["sessions"]), 2)
        self.assertIs(self.prog["sessions"][0], self.sessions[0])

    def test_build_program_empty_list(self):
        from parse_mpsa import build_program
        empty = build_program([])
        self.assertEqual(empty["meta"]["days"], [])
        self.assertEqual(empty["divisions"], [])
        self.assertEqual(empty["session_types"], [])
        self.assertEqual(empty["sessions"], [])
        self.assertEqual(empty["meta"]["conference"], "MPSA 2026")


if __name__ == "__main__":
    unittest.main()
