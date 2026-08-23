import importlib.util
import json
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("draftday_rankings_refresh", ROOT / "scripts" / "draftday_rankings_refresh.py")
refresh = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(refresh)


class DraftDayRankingsRefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT / "data" / "rankings" / "draftday_rankings_manifest_2026-08-23.json").read_text())
        cls.sources = {
            "Fantasyland": json.loads((ROOT / "data" / "sources" / "fantasyland_draftday_2026-08-23.json").read_text()),
            "Flock": json.loads((ROOT / "data" / "sources" / "flock_draftday_2026-08-23.json").read_text()),
        }
        cls.normalized = {
            source: json.loads((ROOT / "data" / "rankings" / f"{source.lower()}_draftday_2026-08-23.normalized.json").read_text())
            for source in cls.sources
        }

    def record(self, source, name):
        return next(row for row in self.normalized[source]["records"] if row["sourcePlayerName"] == name and row["importStatus"] == "MATCHED")

    def test_manifest_continuity_and_provenance(self):
        for source, snapshot in self.sources.items():
            self.assertEqual(refresh.validate_source(snapshot, self.manifest), [])
            self.assertEqual((snapshot["source"], snapshot["host_platform"]), (source, "Flock Fantasy"))
            self.assertEqual(snapshot["source_snapshot_date"], None)
            self.assertEqual([row["overall_rank"] for row in snapshot["rows"]], list(range(1, 355)))

    def test_sources_are_independent_and_exact_tiers_are_preserved(self):
        fantasyland = self.record("Fantasyland", "Jaxon Smith-Njigba")
        flock = self.record("Flock", "Jaxon Smith-Njigba")
        self.assertEqual((fantasyland["overallTier"], fantasyland["decisionOverallTier"]), ("SS", "S"))
        self.assertEqual((flock["overallTier"], flock["decisionOverallTier"]), ("AA", "A"))
        self.assertNotEqual(fantasyland["overallTier"], flock["overallTier"])

    def test_active_identities_are_unique_and_unresolved_rows_are_quarantined(self):
        for snapshot in self.normalized.values():
            matched = [row for row in snapshot["records"] if row["importStatus"] == "MATCHED"]
            self.assertEqual(len(matched), 256)
            self.assertEqual(len({row["playerId"] for row in matched}), 256)
            self.assertEqual(sum(row["importStatus"] != "MATCHED" for row in snapshot["records"]), 98)
            eli = [row for row in snapshot["records"] if row["sourcePlayerName"] == "Eli Stowers"]
            self.assertEqual([row["importStatus"] for row in eli], ["MATCHED", "QUARANTINED"])

    def test_known_aliases_resolve_to_one_stable_identity(self):
        for source in self.normalized:
            brooks = self.record(source, "Jonathon Brooks")
            noel = self.record(source, "Jaylin Noel")
            chig = self.record(source, "Chig Okonkwo")
            self.assertEqual((brooks["playerId"], brooks["canonicalPlayerName"]), ("108", "Jonathon Brooks"))
            self.assertEqual((noel["playerId"], noel["canonicalPlayerName"]), ("1000177", "Jayden Noel"))
            self.assertEqual((chig["playerId"], chig["canonicalPlayerName"]), ("1000091", "Chigoziem Okonkwo"))

    def test_jennings_and_gadsden_exact_values(self):
        self.assertEqual(tuple(self.record("Fantasyland", "Jauan Jennings")[key] for key in ("overallRank", "positionRank", "positionTier")), (193, 73, "JJ"))
        self.assertEqual(tuple(self.record("Flock", "Jauan Jennings")[key] for key in ("overallRank", "positionRank", "positionTier")), (196, 79, "GG"))
        self.assertEqual(tuple(self.record("Fantasyland", "Oronde Gadsden")[key] for key in ("overallRank", "positionRank", "positionTier")), (164, 27, "FF"))
        self.assertEqual(tuple(self.record("Flock", "Oronde Gadsden")[key] for key in ("overallRank", "positionRank", "positionTier")), (158, 20, "FF"))

    def test_high_value_sample_and_positional_tiers(self):
        expected = {
            "Jahmyr Gibbs": (1, 1), "Bijan Robinson": (2, 2), "Ja'Marr Chase": (3, 1),
            "Puka Nacua": (4, 2), "Jaxon Smith-Njigba": (5, 3), "Christian McCaffrey": (6, 3),
        }
        for source in self.normalized:
            for name, ranks in expected.items():
                row = self.record(source, name)
                self.assertEqual((row["overallRank"], row["positionRank"]), ranks)
                self.assertIsNotNone(row["positionTier"])

    def test_tier_cliff_keeps_last_and_first_players_distinct(self):
        rows = self.normalized["Fantasyland"]["records"]
        rank_five = next(row for row in rows if row["overallRank"] == 5)
        rank_six = next(row for row in rows if row["overallRank"] == 6)
        self.assertEqual((rank_five["overallTier"], rank_five["decisionOverallTier"]), ("SS", "S"))
        self.assertEqual((rank_six["overallTier"], rank_six["decisionOverallTier"]), ("AA", "A"))
        self.assertNotEqual(rank_five["decisionOverallTier"], rank_six["decisionOverallTier"])

    def test_missing_source_fails_soft(self):
        fantasyland_ids = {row["playerId"] for row in self.normalized["Fantasyland"]["records"] if row["importStatus"] == "MATCHED"}
        self.assertEqual(len(fantasyland_ids), 256)
        self.assertNotEqual(self.normalized["Fantasyland"]["snapshotId"], self.normalized["Flock"]["snapshotId"])


if __name__ == "__main__":
    unittest.main()
