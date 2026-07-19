import json
import unittest
from pathlib import Path

from scripts import player_data_audit as audit

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as source:
        return json.load(source)


class PlayerDataAuditTests(unittest.TestCase):
    def test_normalization_handles_suffixes_punctuation_and_team_aliases(self):
        self.assertEqual("chris godwin", audit.normalize_name("Chris Godwin Jr."))
        self.assertEqual("dj moore", audit.normalize_search_name("D.J. Moore"))
        self.assertEqual("jamarr chase", audit.normalize_search_name("Ja'Marr Chase"))
        self.assertEqual("JAX", audit.normalize_team("Jacksonville"))
        self.assertEqual("JAX", audit.normalize_team("JAC"))

    def test_stable_identity_prefers_external_id_then_canonical_key(self):
        self.assertEqual("42", audit.stable_identity({"stable_id": 42, "canonical_key": "ignored"}))
        self.assertEqual("player-wr", audit.stable_identity({"canonical_key": "player-wr"}))
        self.assertEqual("test player|WR", audit.stable_identity({"name": "Test Player", "pos": "wr"}))

    def test_exact_duplicate_detection_has_exact_fixture_result(self):
        records = load_fixture("audit_master.json")
        records.append({"stable_id": "2", "name": "DJ Moore", "position": "WR", "team": "CHI"})
        self.assertEqual(
            [{"identity_key": "2", "count": 2, "names": ["D.J. Moore", "DJ Moore"]}],
            audit.detect_exact_duplicates(records),
        )

    def test_probable_duplicate_detection_has_exact_fixture_result(self):
        records = load_fixture("audit_master.json") + load_fixture("audit_live.json")
        self.assertEqual(
            [{"identity_a": "1", "identity_b": "101", "evidence": "chris godwin|WR|TB"}],
            audit.probable_duplicates(records),
        )

    def test_non_null_fields_are_preserved(self):
        original = {"id": 41, "overall": 41, "analysis": "keep", "risk": 0, "notes": []}
        replacement = {"id": 41, "overall": None, "analysis": "", "risk": None, "notes": ["new"]}
        self.assertEqual(
            {"id": 41, "overall": 41, "analysis": "keep", "risk": 0, "notes": ["new"]},
            audit.preserve_non_null_fields(original, replacement),
        )


if __name__ == "__main__":
    unittest.main()
