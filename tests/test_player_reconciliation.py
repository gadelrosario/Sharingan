"""Unit tests for full player reconciliation and search identity behavior."""
import json
import os
import sqlite3
import unittest
from pathlib import Path

from scripts import player_data_audit as audit

BASE_DIR = Path(__file__).resolve().parents[1]

class TestPlayerReconciliation(unittest.TestCase):
    def test_master_source_selected_and_documented(self):
        manifest = audit.SOURCE_MANIFEST['master']
        self.assertIn('trusted_master', manifest['type'])
        self.assertIn('stable', manifest['description'].lower())
        self.assertIn('ids', manifest['description'].lower())
        self.assertTrue(os.path.exists(manifest['path']))

    def test_master_and_live_counts(self):
        master = audit.load_master_records()
        live = audit.load_live_records()
        with sqlite3.connect(BASE_DIR / 'database' / 'fantasyhq.db') as connection:
            canonical_count = connection.execute('SELECT COUNT(*) FROM players').fetchone()[0]
        self.assertEqual(len(master), canonical_count)
        self.assertGreaterEqual(len(live), canonical_count)

    def test_duplicate_stable_ids_detected(self):
        live = audit.load_live_records()
        duplicates = audit.detect_exact_duplicates(live)
        self.assertEqual(duplicates, [])

    def test_probable_name_duplicates_reported(self):
        master = audit.load_master_records()
        live = audit.load_live_records()
        probable = audit.probable_duplicates(master + live)
        self.assertTrue(isinstance(probable, list))
        # dataset may change; assert there is at least one probable duplicate reported
        self.assertGreaterEqual(len(probable), 1)

    def test_name_mismatch_suffix_detected(self):
        mismatch = audit.name_mismatch_type('Chris Godwin', 'Chris Godwin Jr.')
        self.assertEqual(mismatch, 'suffix_difference')

    def test_search_matches_suffix_and_punctuation(self):
        self.assertEqual(audit.normalize_search_name('Kenneth Walker III', keep_suffix=True), 'kenneth walker iii')
        self.assertEqual(audit.normalize_search_name('Kenneth Walker III', keep_suffix=False), 'kenneth walker')
        self.assertEqual(audit.normalize_search_name('Chris Godwin Jr.', keep_suffix=True), 'chris godwin jr')
        self.assertEqual(audit.normalize_search_name('DJ Moore', keep_suffix=True), 'dj moore')
        self.assertEqual(audit.normalize_search_name('D.J. Moore', keep_suffix=True), 'dj moore')
        self.assertEqual(audit.normalize_search_name("Ja'Marr Chase", keep_suffix=True), 'jamarr chase')

    def test_split_name_components_suffix_preserved(self):
        components = audit.split_name_components('Chris Godwin Jr.')
        self.assertEqual(components['canonical_full_name'], 'Chris Godwin Jr.')
        self.assertEqual(components['suffix'].lower(), 'jr')

    def test_search_index_contains_canonical_forms(self):
        live = audit.load_live_records()
        self.assertTrue(any('ja marr chase' in record['search_index'] or 'jamarr chase' in record['search_index'] for record in live if record['canonical_full_name'].lower().startswith("ja'marr chase")))

    def test_player_identity_is_stable(self):
        live = audit.load_live_records()
        for record in live:
            self.assertIsNotNone(record['identity_key'])

    def test_drafting_removes_player_by_stable_id_placeholder(self):
        # High-level contract: player should be identified by stable ID, not display name.
        record = {'stable_id': '123', 'canonical_full_name': 'Chris Godwin Jr.', 'team': 'TB', 'position': 'WR'}
        self.assertEqual(audit.stable_identity(record), '123')

    def test_team_assignments_same_team_are_consistent(self):
        db = {'identity_key': '100', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'NE', 'team_display': 'NE', 'refresh_date': '2026-07-18', 'source_label': 'DB', 'source_key': 'db_roster'}
        master = {'identity_key': '100', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'NE', 'team_display': 'NE', 'refresh_date': '2026-07-18', 'source_label': 'Master', 'source_key': 'master'}
        rows = audit.resolve_team_assignments([master], [], [db])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'consistent')

    def test_team_assignments_different_team_are_mismatches(self):
        db = {'identity_key': '101', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'NE', 'team_display': 'NE', 'refresh_date': '2026-07-18', 'source_label': 'DB', 'source_key': 'db_roster'}
        master = {'identity_key': '101', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'MIA', 'team_display': 'MIA', 'refresh_date': '2026-07-18', 'source_label': 'Master', 'source_key': 'master'}
        rows = audit.resolve_team_assignments([master], [], [db])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'mismatch')
        self.assertEqual(rows[0]['db_team'], 'NE')
        self.assertEqual(rows[0]['master_team'], 'MIA')

    def test_team_assignments_missing_db_team(self):
        db = {'identity_key': '102', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': '', 'team_display': '', 'refresh_date': '2026-07-18', 'source_label': 'DB', 'source_key': 'db_roster'}
        master = {'identity_key': '102', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'MIA', 'team_display': 'MIA', 'refresh_date': '2026-07-18', 'source_label': 'Master', 'source_key': 'master'}
        rows = audit.resolve_team_assignments([master], [], [db])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'missing_db')
        self.assertEqual(rows[0]['db_team'], '')
        self.assertEqual(rows[0]['master_team'], 'MIA')

    def test_team_assignments_missing_master_team(self):
        db = {'identity_key': '103', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': 'NE', 'team_display': 'NE', 'refresh_date': '2026-07-18', 'source_label': 'DB', 'source_key': 'db_roster'}
        master = {'identity_key': '103', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': '', 'team_display': '', 'refresh_date': '2026-07-18', 'source_label': 'Master', 'source_key': 'master'}
        rows = audit.resolve_team_assignments([master], [], [db])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'missing_master')
        self.assertEqual(rows[0]['db_team'], 'NE')
        self.assertEqual(rows[0]['master_team'], '')

    def test_team_assignments_missing_both(self):
        db = {'identity_key': '104', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': '', 'team_display': '', 'refresh_date': '2026-07-18', 'source_label': 'DB', 'source_key': 'db_roster'}
        master = {'identity_key': '104', 'canonical_full_name': 'Test Player', 'position': 'WR', 'team': '', 'team_display': '', 'refresh_date': '2026-07-18', 'source_label': 'Master', 'source_key': 'master'}
        rows = audit.resolve_team_assignments([master], [], [db])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'missing_both')

if __name__ == '__main__':
    unittest.main()
