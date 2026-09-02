import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
RANKINGS = ROOT / "data" / "rankings"
SOURCES = ROOT / "data" / "sources"


class SeptemberRankingsRefreshTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.players = json.loads((ROOT / "data" / "players.json").read_text())
        cls.by_id = {str(player["id"]): player for player in cls.players}
        cls.active = json.loads((RANKINGS / "ACTIVE_SNAPSHOT.json").read_text())
        cls.snapshots = {
            source: json.loads(
                (
                    RANKINGS
                    / f"{source.lower()}_draftday_2026-09-02.normalized.json"
                ).read_text()
            )
            for source in ("Fantasyland", "Flock")
        }
        cls.inputs = {
            source: json.loads(
                (
                    SOURCES
                    / f"{source.lower()}_rankings_2026-09-02.normalized_input.json"
                ).read_text()
            )
            for source in ("Fantasyland", "Flock")
        }

    def matched(self, source, name):
        return next(
            row
            for row in self.snapshots[source]["records"]
            if row["sourcePlayerName"] == name and row["importStatus"] == "MATCHED"
        )

    def test_active_selector_promotes_september_and_preserves_august_rollback(self):
        self.assertEqual(self.active["snapshotId"], "2026-draftday-2026-09-02")
        self.assertEqual(
            self.active["sources"]["Fantasyland"]["activeSnapshot"],
            "fantasyland_draftday_2026-09-02.normalized.json",
        )
        self.assertEqual(
            self.active["sources"]["Flock"]["activeSnapshot"],
            "flock_draftday_2026-09-02.normalized.json",
        )
        self.assertTrue(
            (RANKINGS / "fantasyland_draftday_2026-08-23.normalized.json").exists()
        )
        self.assertTrue((RANKINGS / "flock_draftday_2026-08-23.normalized.json").exists())

    def test_sources_remain_distinct_and_provenance_is_exact(self):
        fantasyland = self.snapshots["Fantasyland"]
        flock = self.snapshots["Flock"]
        self.assertEqual(
            (fantasyland["source"], fantasyland["hostPlatform"]),
            ("Fantasyland", "Flock Fantasy"),
        )
        self.assertEqual(
            (flock["source"], flock["hostPlatform"]),
            ("Flock", "Flock Fantasy"),
        )
        self.assertNotEqual(fantasyland["snapshotId"], flock["snapshotId"])
        self.assertTrue(
            all(row["creatorSource"] == "Fantasyland" for row in fantasyland["records"])
        )
        self.assertTrue(all(row["creatorSource"] == "Flock" for row in flock["records"]))

    def test_overall_and_positional_ranks_are_unique_and_contiguous(self):
        for source, snapshot in self.snapshots.items():
            rows = snapshot["records"]
            self.assertEqual(
                [row["overallRank"] for row in rows], list(range(1, len(rows) + 1))
            )
            for position in ("QB", "RB", "WR", "TE"):
                ranks = [
                    row["positionRank"]
                    for row in rows
                    if row["position"] == position and row["positionRank"] is not None
                ]
                self.assertEqual(len(ranks), len(set(ranks)), (source, position))

    def test_identity_resolution_fails_closed_and_matched_ids_are_unique(self):
        expected = {
            "Fantasyland": {"MATCHED": 256, "UNMATCHED": 96, "AMBIGUOUS": 2},
            "Flock": {"MATCHED": 256, "UNMATCHED": 95, "AMBIGUOUS": 2},
        }
        for source, snapshot in self.snapshots.items():
            statuses = {}
            for row in snapshot["records"]:
                statuses[row["importStatus"]] = statuses.get(row["importStatus"], 0) + 1
            self.assertEqual(statuses, expected[source])
            matched = [row for row in snapshot["records"] if row["importStatus"] == "MATCHED"]
            self.assertEqual(len(matched), len({row["playerId"] for row in matched}))
            self.assertTrue(
                all(row["playerId"] is None for row in snapshot["records"] if row["importStatus"] != "MATCHED")
            )
            ambiguous = [row for row in snapshot["records"] if row["importStatus"] == "AMBIGUOUS"]
            self.assertEqual([row["sourcePlayerName"] for row in ambiguous], ["Kyle Williams", "Kyle Williams"])

    def test_source_display_team_is_preserved_separately_from_canonical_team(self):
        fantasyland_evans = self.matched("Fantasyland", "Mike Evans")
        self.assertEqual(fantasyland_evans["sourceTeam"], "SF")
        self.assertEqual(fantasyland_evans["teamAsDisplayed"], "SF")
        self.assertEqual(
            fantasyland_evans["canonicalTeam"],
            self.by_id[str(fantasyland_evans["playerId"])]["team"],
        )
        self.assertIn("sourceTeam", fantasyland_evans)
        self.assertIn("canonicalTeam", fantasyland_evans)

    def test_fantasyland_canaries(self):
        expected = {
            "Christian McCaffrey": (6, 3), "Devon Achane": (10, 6),
            "Drake London": (19, 8), "Rashee Rice": (23, 11),
            "Luther Burden": (45, 22), "Lamar Jackson": (46, 2),
            "Tyler Warren": (52, 4), "Mike Evans": (61, 29),
            "Michael Wilson": (72, 35), "Jonathon Brooks": (77, 29),
            "J.K. Dobbins": (80, 30), "Kyle Pitts": (83, 8),
            "Rachaad White": (88, 31), "Alec Pierce": (90, 41),
            "De'Zhaun Stribling": (91, 42), "Oronde Gadsden": (164, 27),
            "Jauan Jennings": (203, 79),
        }
        for name, values in expected.items():
            row = self.matched("Fantasyland", name)
            self.assertEqual((row["overallRank"], row["positionRank"]), values, name)

    def test_flock_canaries_and_pitts_discrepancy(self):
        expected = {
            "Christian McCaffrey": (6, 3), "Devon Achane": (13, 7),
            "Drake London": (19, 7), "Rashee Rice": (25, 12),
            "Luther Burden": (47, 22), "Lamar Jackson": (55, 2),
            "Tyler Warren": (57, 4), "Mike Evans": (62, 31),
            "Jonathon Brooks": (70, 28), "J.K. Dobbins": (83, 32),
            "Michael Wilson": (90, 42), "Alec Pierce": (93, 43),
            "Kyle Pitts": (94, 8), "Rachaad White": (102, 37),
            "De'Zhaun Stribling": (105, 48), "Oronde Gadsden": (175, 24),
        }
        for name, values in expected.items():
            row = self.matched("Flock", name)
            self.assertEqual((row["overallRank"], row["positionRank"]), values, name)
        pitts = self.matched("Flock", "Kyle Pitts")
        self.assertEqual(pitts["auditMetadata"]["activatedOverallBoard"], {"overallRank": 94, "positionRank": 8})
        self.assertEqual(pitts["auditMetadata"]["separateTEListObservation"], {"overallRankAsDisplayed": 96, "positionRank": 8})

    def test_unsupported_flock_position_tiers_remain_null(self):
        incoming = {
            (row["overall_rank"], row["player"]): row.get("positional_tier")
            for row in self.inputs["Flock"]["rows"]
        }
        for row in self.snapshots["Flock"]["records"]:
            original = incoming[(row["overallRank"], row["sourcePlayerName"])]
            self.assertEqual(row["positionTier"], original)
            if original is None:
                self.assertIsNone(row["decisionPositionTier"])

    def test_existing_alias_contract_retains_stable_player_ids(self):
        for source in self.snapshots:
            self.assertEqual(self.matched(source, "Devon Achane")["playerId"], "15")
            self.assertEqual(self.matched(source, "Luther Burden")["playerId"], "46")
            self.assertEqual(self.matched(source, "Oronde Gadsden")["playerId"], "1000082")
            self.assertEqual(self.matched(source, "Jonathon Brooks")["playerId"], "108")


if __name__ == "__main__":
    unittest.main()
