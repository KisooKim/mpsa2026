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


if __name__ == "__main__":
    unittest.main()
