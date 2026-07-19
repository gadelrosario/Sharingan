import hashlib
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "database" / "schema.sql"
CANDIDATES = Path(__file__).parent / "fixtures" / "canonical_candidates.csv"


class CanonicalExpansionImportTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db = Path(self.tempdir.name) / "fixture.db"
        with closing(sqlite3.connect(self.db)) as connection:
            connection.executescript(SCHEMA.read_text(encoding="utf-8"))
            connection.execute(
                "INSERT INTO players(canonical_key,full_name,position,nfl_team) VALUES(?,?,?,?)",
                ("fixture-player-wr", "Fixture Player", "WR", "NE"),
            )
            connection.commit()

    def tearDown(self):
        self.tempdir.cleanup()

    def run_cli(self, *extra):
        return subprocess.run(
            [sys.executable, "-m", "scripts.canonical_expansion", "--db-path", str(self.db),
             "--candidates", str(CANDIDATES), "--expected", "2", *extra],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )

    def test_dry_run_is_byte_for_byte_unchanged(self):
        before = hashlib.sha256(self.db.read_bytes()).hexdigest()
        result = self.run_cli()
        after = hashlib.sha256(self.db.read_bytes()).hexdigest()
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("", result.stderr)
        self.assertIn("dry-run", result.stdout)
        self.assertEqual(before, after)

    def test_apply_inserts_fixture_candidates_transactionally(self):
        result = self.run_cli("--apply")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("", result.stderr)
        with closing(sqlite3.connect(self.db)) as connection:
            rows = connection.execute("SELECT canonical_key,full_name,position,nfl_team FROM players ORDER BY id").fetchall()
        self.assertEqual(
            [("fixture-player-wr", "Fixture Player", "WR", "NE"),
             ("jordan-love-qb", "Jordan Love", "QB", "GB"),
             ("mark-andrews-te", "Mark Andrews", "TE", "BAL")],
            rows,
        )

    def test_invalid_expected_count_returns_error_without_changes(self):
        before = self.db.read_bytes()
        result = subprocess.run(
            [sys.executable, "-m", "scripts.canonical_expansion", "--db-path", str(self.db),
             "--candidates", str(CANDIDATES), "--expected", "3", "--apply"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(2, result.returncode)
        self.assertEqual("", result.stderr)
        self.assertIn("expected 3 candidates, found 2", result.stdout)
        self.assertEqual(before, self.db.read_bytes())


if __name__ == "__main__":
    unittest.main()
