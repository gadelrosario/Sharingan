import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class RecommendationHealth422Tests(unittest.TestCase):
    def test_deterministic_health_contracts(self):
        result = subprocess.run([str(NODE), 'tests/recommendation-health-4-2-2-tests.js'], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual((payload['passCount'], payload['failCount']), (13, 0))

    def test_sharingan_scan_and_stage_are_visible_again(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        self.assertIn('SHARINGAN SCAN</button>', html)
        card = app.split('function decisionCardMarkup', 1)[1].split('function recommendationCategoryLabels', 1)[0]
        self.assertIn('sharinganStage(p)', card)
        self.assertIn('sharinganIconMarkup(stage.key)', card)
        self.assertIn('stage.label', card)
        self.assertIn('openFightCardDetails()', html)

    def test_historical_mangekyo_paths_remain_connected(self):
        app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
        self.assertIn("key: 'mangekyo', label: 'MANGEKYŌ'", app)
        self.assertIn("key: 'eternal', label: 'ETERNAL MANGEKYŌ'", app)
        self.assertIn('FlightControlV1.eternalMangekyoActive', app)
        self.assertIn('function openScan(id)', app)

    def test_specialist_snapshot_is_offline_cached(self):
        worker = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
        self.assertIn("'./data/specialist_rankings_2026-08-09.json'", worker)
        self.assertIn("'./js/specialist-rankings-v1.js?v=1.0.0'", worker)

if __name__ == '__main__':
    unittest.main()
