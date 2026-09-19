import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class SeasonHomeYahooConsumptionTests(unittest.TestCase):
    def test_season_home_yahoo_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/season-home-yahoo-consumption-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual((payload['passCount'], payload['failCount']), (8, 0), payload['failures'])

    def test_fixture_remains_sanitized(self):
        text = (ROOT / 'tests/fixtures/yahoo/real_nested_season_2026_sanitized.json').read_text(encoding='utf-8').lower()
        for forbidden in ('access_token', 'refresh_token', 'client_secret', 'authorization_code', 'invite_url', 'invitation_key', 'manager_guid'):
            self.assertNotIn(forbidden, text)


if __name__ == '__main__':
    unittest.main()
