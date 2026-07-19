"""Unit tests for the player data audit tools."""
import os
import tempfile
import unittest

from scripts import player_data_audit as audit


class TestPlayerDataAudit(unittest.TestCase):
    def test_normalize_name_removes_punctuation_and_suffixes(self):
        self.assertEqual(audit.normalize_name("Mark Andrews"), "mark andrews")
        self.assertEqual(audit.normalize_name("Chris Godwin Jr."), "chris godwin")
        self.assertEqual(audit.normalize_name("D.J. Moore"), "dj moore")
        self.assertEqual(audit.normalize_name("T.J. Hockenson"), "tj hockenson")

    def test_audit_players_detects_required_names(self):
        players = [
            {'id': '1', 'name': 'Mark Andrews', 'pos': 'TE', 'team': 'BAL'},
            {'id': '2', 'name': 'Jordan Love', 'pos': 'QB', 'team': 'GB'},
            {'id': '3', 'name': 'D.J. Moore', 'pos': 'WR', 'team': 'CAR'},
        ]
        results = audit.audit_players(players)
        required = {item['name']: item['found'] for item in results['required_presence']}
        self.assertTrue(required['Mark Andrews'])
        self.assertTrue(required['Jordan Love'])
        self.assertFalse(required['Justin Jefferson'])

    def test_compare_sources_flags_missing_names(self):
        json_players = [
            {'name': 'Mark Andrews'},
            {'name': 'Justin Jefferson'},
        ]
        csv_players = [
            {'full_name': 'Mark Andrews'},
            {'full_name': 'Jordan Love'},
        ]
        comparison = audit.compare_sources(json_players, csv_players)
        self.assertIn('jordan love', comparison['missing_in_json'])
        self.assertIn('justin jefferson', comparison['missing_in_csv'])

    def test_audit_players_reports_duplicate_ids(self):
        players = [
            {'id': '1', 'name': 'Player One', 'pos': 'RB', 'team': 'NYJ'},
            {'id': '1', 'name': 'Player One Alt', 'pos': 'RB', 'team': 'NYJ'},
        ]
        results = audit.audit_players(players)
        self.assertEqual(results['duplicate_ids'], ['1'])


if __name__ == '__main__':
    unittest.main()
