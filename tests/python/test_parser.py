import unittest
from pathlib import Path
import sys
import re

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from parse_mpsa import parse_session

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


if __name__ == "__main__":
    unittest.main()
