import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from scripts.generate_live_pool import CANONICAL_ID_OFFSET, generate


SCHEMA = """
CREATE TABLE players (id INTEGER PRIMARY KEY, canonical_key TEXT, full_name TEXT,
 position TEXT, nfl_team TEXT, bye_week INTEGER, status TEXT);
CREATE TABLE ranking_sources (id INTEGER PRIMARY KEY, source_key TEXT);
CREATE TABLE expert_rankings (player_id INTEGER, source_id INTEGER, season INTEGER,
 scoring_format TEXT, position_rank REAL, tier TEXT);
CREATE TABLE market_adp (player_id INTEGER, source_id INTEGER, season INTEGER,
 scoring_format TEXT, adp REAL);
CREATE TABLE hq_scores (player_id INTEGER, season INTEGER, scoring_format TEXT,
 model_version TEXT, hq_grade REAL, expert_agreement REAL, market_value REAL,
 tier_scarcity REAL, wait_probability REAL, upside REAL, risk REAL,
 replacement_value REAL, league_winner_score REAL);
"""


class GenerateLivePoolTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        root = Path(self.tempdir.name)
        self.db = root / "canonical.db"
        self.live = root / "players.json"
        self.out = root / "generated.json"
        self.patch = root / "team_patch.csv"
        connection = sqlite3.connect(self.db)
        connection.executescript(SCHEMA)
        connection.executemany("INSERT INTO ranking_sources VALUES (?, ?)", [(1, "bdge"), (2, "flock")])
        connection.executemany(
            "INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                (17, "jordan-love-qb", "Jordan Love", "QB", "GB", 5, "active"),
                (47, "travis-etienne-jr-rb", "Travis Etienne Jr.", "RB", "JAX", 8, "active"),
                (89, "mark-andrews-te", "Mark Andrews", "TE", "BAL", 7, "active"),
            ],
        )
        connection.execute("INSERT INTO expert_rankings VALUES (17, 1, 2026, 'half_ppr', 16, 'B')")
        connection.execute("INSERT INTO expert_rankings VALUES (47, 2, 2026, 'half_ppr', 15, 'C')")
        connection.commit()
        connection.close()
        self.live.write_text(json.dumps([{
            "id": 41, "overall": 41, "name": "Travis Etienne", "pos": "RB",
            "team": "JAX", "customAnalysis": "keep me", "sourceCoverage": {"fantasyland": True},
        }]), encoding="utf-8")

    def tearDown(self):
        self.tempdir.cleanup()

    def test_partial_or_absent_source_coverage_never_excludes_players(self):
        summary = generate(self.db, self.live, self.out, self.patch)
        players = json.loads(self.out.read_text(encoding="utf-8"))
        by_name = {player["name"]: player for player in players}
        self.assertEqual({"Jordan Love", "Travis Etienne Jr.", "Mark Andrews"}, set(by_name))
        self.assertEqual(3, summary["after_count"])
        self.assertEqual([], summary["unresolved_exclusions"])
        self.assertIsNone(by_name["Mark Andrews"]["overall"])
        self.assertIsNone(by_name["Mark Andrews"]["bdgeRank"])
        self.assertIsNone(by_name["Mark Andrews"]["flockRank"])

    def test_existing_stable_id_and_analysis_fields_are_preserved(self):
        generate(self.db, self.live, self.out, self.patch)
        player = next(p for p in json.loads(self.out.read_text()) if p["name"] == "Travis Etienne Jr.")
        self.assertEqual(41, player["id"])
        self.assertEqual("keep me", player["customAnalysis"])
        self.assertEqual({"fantasyland": True}, player["sourceCoverage"])
        self.assertEqual(47, player["canonicalId"])

    def test_new_ids_are_deterministic_and_do_not_depend_on_rank_order(self):
        generate(self.db, self.live, self.out, self.patch)
        players = {p["name"]: p for p in json.loads(self.out.read_text())}
        self.assertEqual(CANONICAL_ID_OFFSET + 17, players["Jordan Love"]["id"])
        self.assertEqual(CANONICAL_ID_OFFSET + 89, players["Mark Andrews"]["id"])

    def test_luther_burden_duplicate_preserves_rich_analysis_id(self):
        connection = sqlite3.connect(self.db)
        connection.execute(
            "INSERT INTO players VALUES (?, ?, ?, ?, ?, ?, ?)",
            (122, "luther-burden-iii-wr", "Luther Burden III", "WR", "CHI", 5, "active"),
        )
        connection.commit()
        connection.close()
        live = json.loads(self.live.read_text(encoding="utf-8"))
        live.extend([
            {"id": 46, "overall": 46, "name": "Luther Burden", "pos": "WR", "team": "CHI",
             "bdgeRank": 23, "bdgeLabels": ["Breakout candidate"],
             "sourceCoverage": {"bdge": True, "flock": True}},
            {"id": 155, "overall": 113, "name": "Luther Burden III", "pos": "WR", "team": "CHI",
             "bdgeRank": None, "depthNote": "FantasyPros depth extension",
             "sourceCoverage": {"fantasyPros": True}},
        ])
        self.live.write_text(json.dumps(live), encoding="utf-8")

        summary = generate(self.db, self.live, self.out, self.patch)
        matches = [p for p in json.loads(self.out.read_text()) if p["name"] == "Luther Burden III"]
        self.assertEqual(1, len(matches))
        self.assertEqual(46, matches[0]["id"])
        self.assertEqual(23, matches[0]["bdgeRank"])
        self.assertEqual("FantasyPros depth extension", matches[0]["depthNote"])
        self.assertEqual({"bdge": True, "flock": True, "fantasyPros": True}, matches[0]["sourceCoverage"])
        resolution = next(r for r in summary["duplicate_resolutions"] if r["name"] == "Luther Burden III")
        self.assertEqual([155], resolution["removed_ids"])


if __name__ == "__main__":
    unittest.main()
