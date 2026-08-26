import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class StartSitIntelligence443Tests(unittest.TestCase):
    def run_node(self, script):
        result = subprocess.run([str(NODE), script], cwd=ROOT, text=True, capture_output=True, check=False, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_deterministic_contracts(self):
        result = self.run_node('tests/start-sit-intelligence-4-4-3-tests.js')
        self.assertEqual(result['failCount'], 0)
        self.assertEqual(result['passCount'], 17)

    def test_browser_integration_is_progressive_and_fail_closed(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.assertIn("startsit:'⚡ Start/Sit'", app)
        self.assertIn("showSeasonPage('startsit')", html)
        self.assertIn('renderSeasonStartSit', app)
        self.assertIn('INSUFFICIENT_VALIDATED_SEASON_DATA', app)
        self.assertIn('View Analysis', app)
        self.assertIn('START/SIT ANALYSIS', app)

    def test_default_cards_do_not_dump_internal_components(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        segment = app.split('function seasonStartSitCard', 1)[1].split('function seasonStartSitRow', 1)[0]
        for raw_metric in ('riskAdjustment', 'roleStability', 'recentUsage', 'component scores'):
            self.assertNotIn(raw_metric, segment)

    def test_responsive_contract(self):
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        self.assertIn('.seasonStartSitGrid', css)
        self.assertIn('.seasonStartSitCard', css)
        self.assertIn('@media(max-width:720px)', css)
        self.assertIn('minmax(0,1fr)', css)


if __name__ == '__main__':
    unittest.main()
