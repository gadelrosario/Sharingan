import json
import unittest
from pathlib import Path

from scripts.canonical_expansion import build_candidates, classify_live_only
from scripts.player_data_audit import match_records, resolve_team_assignments

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name):
    with (FIXTURES / name).open(encoding="utf-8") as source:
        return json.load(source)


class PlayerReconciliationTests(unittest.TestCase):
    def test_fixture_matching_uses_stable_id_and_alias(self):
        matched, missing, extra = match_records(fixture("audit_master.json"), fixture("audit_live.json"))
        self.assertEqual(["alias", "stable_id"], sorted(method for _, _, method in matched))
        self.assertEqual(["Mark Andrews"], [row["name"] for row in missing])
        self.assertEqual(["Jordan Love", "Unknown Prospect"], [row["name"] for row in extra])

    def test_live_only_classification_is_exact(self):
        rows = classify_live_only(fixture("audit_master.json"), fixture("audit_live.json"))
        self.assertEqual(["duplicate", "duplicate", "candidate", "unsupported"], [row["classification"] for row in rows])

    def test_candidate_builder_is_deterministic_and_avoids_existing_keys(self):
        classified = classify_live_only(fixture("audit_master.json"), fixture("audit_live.json"))
        candidates = build_candidates(classified, {"jordan-love-qb"})
        self.assertEqual(1, len(candidates))
        self.assertEqual("jordan-love-qb-1", candidates[0]["proposed_canonical_id"])
        self.assertEqual("200", candidates[0]["live_player_id"])

    def test_team_resolution_statuses_are_fixture_driven(self):
        master = [{"stable_id": "1", "name": "One", "position": "WR", "team": "NE"},
                  {"stable_id": "2", "name": "Two", "position": "RB", "team": "MIA"},
                  {"stable_id": "4", "name": "Four", "position": "TE", "team": ""}]
        db = [{"stable_id": "1", "name": "One", "position": "WR", "team": "NE"},
              {"stable_id": "3", "name": "Three", "position": "QB", "team": "BUF"},
              {"stable_id": "4", "name": "Four", "position": "TE", "team": ""}]
        statuses = {row["stable_id"]: row["status"] for row in resolve_team_assignments(master, [], db)}
        self.assertEqual({"1": "consistent", "2": "missing_db", "3": "missing_master", "4": "missing_both"}, statuses)

    def test_team_resolution_reports_mismatch_and_prefers_database(self):
        master = [{"stable_id": "1", "name": "One", "position": "WR", "team": "MIA"}]
        live = [{"stable_id": "1", "name": "One", "position": "WR", "team": "BUF"}]
        db = [{"stable_id": "1", "name": "One", "position": "WR", "team": "NE"}]
        self.assertEqual(
            {"status": "mismatch", "selected_current_team": "NE"},
            {key: resolve_team_assignments(master, live, db)[0][key] for key in ("status", "selected_current_team")},
        )


if __name__ == "__main__":
    unittest.main()
