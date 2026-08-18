import csv
from contextlib import closing
import json
import pathlib
import sqlite3
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class JonathonBrooksIdentityTests(unittest.TestCase):
    def test_browser_pool_search_draft_photo_and_injury_contract(self):
        result = subprocess.run([str(NODE), 'tests/jonathon-brooks-identity-tests.js'], cwd=ROOT,
                                text=True, capture_output=True, check=False)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn('Jonathon Brooks identity: 6 passed, 0 failed', result.stdout)

    def test_database_and_export_have_one_authoritative_canonical_record(self):
        with closing(sqlite3.connect(ROOT / 'database/fantasyhq.db')) as connection:
            rows = connection.execute(
                "SELECT id, canonical_key, full_name, position FROM players WHERE lower(last_name)='brooks' AND position='RB'"
            ).fetchall()
        self.assertEqual([(68, 'jonathan-brooks-rb', 'Jonathon Brooks', 'RB')], rows)
        with (ROOT / 'database/player_master_export.csv').open(newline='', encoding='utf-8') as source:
            exported = [row for row in csv.DictReader(source) if row['canonical_key'] == 'jonathan-brooks-rb']
        self.assertEqual(1, len(exported))
        self.assertEqual('Jonathon Brooks', exported[0]['full_name'])

    def test_source_spelling_and_reviewed_legacy_alias_are_explicit(self):
        source = json.loads((ROOT / 'data/sources/fantasyland_2026-08-08.json').read_text())
        source_rows = [row for row in source['records'] if row['overallRank'] == 77]
        self.assertEqual([('Jonathon Brooks', 'RB', 'CAR')],
                         [(row['playerName'], row['position'], row['sourceTeam']) for row in source_rows])
        reviews = json.loads((ROOT / 'data/fantasyland_identity_review_2026-08-08.json').read_text())
        aliases = [row for row in reviews if row['sourceName'] == 'Jonathan Brooks']
        self.assertEqual(1, len(aliases))
        self.assertEqual(('Jonathon Brooks', 'jonathan-brooks-rb'),
                         (aliases[0]['canonicalName'], aliases[0]['canonicalKey']))

    def test_active_ranking_snapshot_has_one_retained_identity(self):
        snapshot = json.loads((ROOT / 'data/rankings/fantasyland_2026-08-08.normalized.json').read_text())
        rows = [row for row in snapshot['records'] if str(row['playerId']) in {'108', '1000068'}]
        self.assertEqual(1, len(rows))
        self.assertEqual(('108', 77, 'jonathan-brooks-rb'),
                         (rows[0]['playerId'], rows[0]['overallRank'], rows[0]['provenance']['canonicalKey']))


if __name__ == '__main__':
    unittest.main()
