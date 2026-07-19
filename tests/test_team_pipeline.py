import sqlite3
import unittest
from pathlib import Path

from scripts import import_csv
from scripts.player_data_audit import normalize_team

SCHEMA = Path(__file__).resolve().parents[1] / "database" / "schema.sql"


class TeamPipelineTests(unittest.TestCase):
    def setUp(self):
        self.connection = sqlite3.connect(":memory:")
        self.connection.row_factory = sqlite3.Row
        self.connection.executescript(SCHEMA.read_text(encoding="utf-8"))

    def tearDown(self):
        self.connection.close()

    def test_upsert_preserves_existing_team_when_update_is_blank(self):
        player_id = import_csv.upsert_player(self.connection, {"name": "Test Player", "position": "WR", "team": "NE"})
        import_csv.upsert_player(self.connection, {"name": "Test Player", "position": "WR", "team": ""})
        team = self.connection.execute("SELECT nfl_team FROM players WHERE id=?", (player_id,)).fetchone()["nfl_team"]
        self.assertEqual("NE", team)

    def test_export_shape_includes_team(self):
        self.connection.execute(
            "INSERT INTO players(canonical_key,full_name,position,nfl_team) VALUES(?,?,?,?)",
            ("test-player-wr", "Test Player", "WR", "NE"),
        )
        row = self.connection.execute("SELECT canonical_key,full_name,position,nfl_team FROM players").fetchone()
        self.assertEqual(("test-player-wr", "Test Player", "WR", "NE"), tuple(row))

    def test_team_aliases_are_canonical(self):
        self.assertEqual("JAX", normalize_team("Jacksonville"))
        self.assertEqual("JAX", normalize_team("JAC"))


if __name__ == "__main__":
    unittest.main()
