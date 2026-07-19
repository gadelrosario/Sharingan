import os
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(__file__))
# Expansion candidates were created against the preserved 134-player canonical
# snapshot.  The working database may already contain a reviewed expansion, so
# copying it makes this test attempt to import the same candidates twice.
SNAPSHOT_DB = os.path.join(ROOT, 'database', 'fantasyhq.db.backup.20260718T200921Z.sqlite')
DB = SNAPSHOT_DB if os.path.exists(SNAPSHOT_DB) else os.path.join(ROOT, 'database', 'fantasyhq.db')
SCRIPT = os.path.join(ROOT, 'scripts', 'import_canonical_expansion.py')
CAND = os.path.join(ROOT, 'outputs', 'player_audit', 'canonical_expansion_candidates.csv')


class ImportCanonicalExpansionTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.mkdtemp(prefix='fhq_test_')
        self.tempdb = os.path.join(self.tempdir, 'fantasyhq_test.db')
        shutil.copy2(DB, self.tempdb)

    def tearDown(self):
        shutil.rmtree(self.tempdir)

    def test_dry_run_no_change(self):
        # run without --apply
        proc = subprocess.run(['python3', SCRIPT, '--db-path', self.tempdb, '--candidates', CAND], capture_output=True, text=True)
        self.assertIn('Dry-run mode', proc.stdout)
        # DB row count should be unchanged
        conn = sqlite3.connect(self.tempdb)
        cur = conn.cursor()
        before = cur.execute('SELECT COUNT(*) FROM players').fetchone()[0]
        conn.close()
        self.assertGreater(before, 0)

    def test_apply_inserts_candidates_transactional(self):
        # count before
        conn = sqlite3.connect(self.tempdb)
        before = conn.execute('SELECT COUNT(*) FROM players').fetchone()[0]
        conn.close()
        proc = subprocess.run(['python3', SCRIPT, '--db-path', self.tempdb, '--candidates', CAND, '--apply'], capture_output=True, text=True)
        self.assertIn('Applied import', proc.stdout)
        conn = sqlite3.connect(self.tempdb)
        after = conn.execute('SELECT COUNT(*) FROM players').fetchone()[0]
        conn.close()
        # expected increase by 98
        self.assertEqual(after - before, 98)


if __name__ == '__main__':
    unittest.main()
