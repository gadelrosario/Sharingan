import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class YahooSeasonPersistenceTests(unittest.TestCase):
    def test_persistence_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/yahoo-season-persistence-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload['failCount'], 0)
        self.assertEqual(payload['passCount'], 12)
        sizes = payload['sizes']
        self.assertLess(sizes['30'], sizes['1'] + 100_000)

    def test_no_raw_private_yahoo_fixture_was_added(self):
        for fixture in (
            ROOT / 'tests/fixtures/yahoo/real_nested_season_2026_sanitized.json',
            ROOT / 'tests/fixtures/yahoo/league_bundle_2026.json',
        ):
            lowered = fixture.read_text(encoding='utf-8').lower()
            for forbidden in ('access_token', 'refresh_token', 'client_secret', 'invite_url', 'invitation_key', 'short_invitation_url', 'manager_guid'):
                self.assertNotIn(forbidden, lowered)


if __name__ == '__main__':
    unittest.main()
