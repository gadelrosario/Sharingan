import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class YahooSeasonRealNestedTests(unittest.TestCase):
    def test_real_nested_yahoo_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/yahoo-season-real-nested-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload['failCount'], 0)
        self.assertEqual(payload['passCount'], 18)

    def test_fixture_is_sanitized_and_does_not_contain_oauth_material(self):
        fixture = (ROOT / 'tests/fixtures/yahoo/real_nested_season_2026_sanitized.json').read_text(encoding='utf-8')
        lowered = fixture.lower()
        for forbidden in ('access_token', 'refresh_token', 'client_secret', 'authorization_code', 'invite_url', 'manager_guid'):
            self.assertNotIn(forbidden, lowered)

    def test_browser_consumes_team_side_values_without_fabricating_missing_record(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        season = (ROOT / 'js/season-command-center-v1.js').read_text(encoding='utf-8')
        self.assertIn('userMatchupSide', season)
        self.assertIn('opponentMatchupSide', season)
        self.assertIn('getSnapshotMatchups', season)
        self.assertIn("standing.wins == null || standing.losses == null", app)
        self.assertIn("number == null ? 'Not provided'", app)
        self.assertIn('Yahoo win probability', app)
        self.assertIn('pointsAgainst', app)


if __name__ == '__main__':
    unittest.main()
