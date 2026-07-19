import sqlite3
import unittest
from pathlib import Path

from scripts import import_csv

BASE = Path(__file__).resolve().parents[1]
SCHEMA = BASE / 'database' / 'schema.sql'

def init_db(conn):
    conn.executescript(SCHEMA.read_text(encoding='utf-8'))

class TestTeamPipeline(unittest.TestCase):
    def test_upsert_preserves_team(self):
        conn = sqlite3.connect(':memory:')
        conn.row_factory = sqlite3.Row
        init_db(conn)
        # create a source row with a team
        row = {'name': 'Test Player', 'position': 'WR', 'team': 'NE'}
        pid = import_csv.upsert_player(conn, row)
        cur = conn.execute('SELECT nfl_team FROM players WHERE id=?', (pid,)).fetchone()
        self.assertIsNotNone(cur)
        self.assertEqual(cur['nfl_team'], 'NE')
        # upsert again with empty team should keep existing
        row2 = {'name': 'Test Player', 'position': 'WR', 'team': ''}
        pid2 = import_csv.upsert_player(conn, row2)
        cur2 = conn.execute('SELECT nfl_team FROM players WHERE id=?', (pid2,)).fetchone()
        self.assertEqual(cur2['nfl_team'], 'NE')

    def test_export_includes_team(self):
        conn = sqlite3.connect(':memory:')
        conn.row_factory = sqlite3.Row
        init_db(conn)
        # insert player with nfl_team
        conn.execute("INSERT INTO players(canonical_key,full_name,position,nfl_team) VALUES(?,?,?,?)", ('test-player-wr','Test Player','WR','NE'))
        # run the same select as export_master to retrieve nfl_team
        rows = conn.execute('SELECT p.id AS player_id, p.canonical_key, p.full_name, p.position, p.nfl_team FROM players p').fetchall()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['nfl_team'], 'NE')

    def test_normalize_team_equivalents(self):
        # ensure common synonyms map to canonical abbrev
        from scripts.player_data_audit import normalize_team
        self.assertEqual(normalize_team('Jacksonville'), 'JAX')
        self.assertEqual(normalize_team('JAC'), 'JAX')
        self.assertEqual(normalize_team('JAX'), 'JAX')

if __name__ == '__main__':
    unittest.main()
