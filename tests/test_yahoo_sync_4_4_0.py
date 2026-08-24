import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class YahooSyncFoundationTests(unittest.TestCase):
    def run_node(self, script, expected):
        result = subprocess.run([str(NODE), script], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (expected, 0), payload['failures'])

    def test_season_model_contracts(self):
        self.run_node('tests/yahoo-season-4-4-0-tests.js', 21)

    def test_sync_controller_contracts(self):
        self.run_node('tests/yahoo-sync-4-4-0-tests.js', 7)

    def test_modules_load_before_app_and_are_cached(self):
        html = (ROOT / 'index.html').read_text()
        worker = (ROOT / 'service-worker.js').read_text()
        self.assertLess(html.index('js/yahoo-season-v1.js'), html.index('js/app.js'))
        self.assertLess(html.index('js/yahoo-sync-v1.js'), html.index('js/app.js'))
        self.assertLess(html.index('js/season-command-center-v1.js'), html.index('js/app.js'))
        self.assertIn("'./js/yahoo-season-v1.js?v=1.0.0'", worker)
        self.assertIn("'./js/yahoo-sync-v1.js?v=1.0.0'", worker)
        self.assertIn("'./js/season-command-center-v1.js?v=1.1.2'", worker)

    def test_browser_transport_targets_https_local_bridge(self):
        source = (ROOT / 'js/yahoo-sync-v1.js').read_text()
        self.assertIn("DEFAULT_BRIDGE='https://localhost:8787'", source)
        self.assertNotIn("DEFAULT_BRIDGE='http://", source)

    def test_no_recommendation_or_scoring_authority(self):
        source = ((ROOT / 'js/yahoo-season-v1.js').read_text() + (ROOT / 'js/yahoo-sync-v1.js').read_text()).lower()
        for forbidden in ('mambascore(', 'finalpickscore(', 'recommendations()', 'championshipequity'):
            self.assertNotIn(forbidden, source)

    def test_minimal_ui_exposes_connection_mapping_sync_and_season_overview(self):
        html = (ROOT / 'index.html').read_text()
        for element_id in ('yahooConnectBtn', 'yahooDiscoverBtn', 'yahooLeagueSelect', 'yahooSyncBtn', 'yahooDisconnectBtn', 'yahooSeasonOverview'):
            self.assertIn(f'id="{element_id}"', html)

    def test_browser_assets_do_not_contain_secret_or_token_storage_contracts(self):
        browser_source = '\n'.join((ROOT / path).read_text() for path in ('index.html', 'js/app.js', 'js/yahoo-season-v1.js', 'js/yahoo-sync-v1.js'))
        self.assertNotIn('YAHOO_CLIENT_SECRET', browser_source)
        self.assertNotIn('refresh_token', browser_source)
        self.assertNotIn('access_token', browser_source)


if __name__ == '__main__':
    unittest.main()
