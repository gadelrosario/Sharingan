import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin4312Tests(unittest.TestCase):
    def test_gsis_mapping_and_population_contracts(self):
        result = subprocess.run([str(NODE), 'tests/gsis-historical-population-4-3-12-tests.js'], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload['failCount'], 0)
        self.assertGreaterEqual(payload['passCount'], 16)

    def test_browser_and_production_data_firewall(self):
        sources = '\n'.join((ROOT / path).read_text(encoding='utf-8') for path in ('index.html', 'js/app.js', 'service-worker.js'))
        self.assertNotIn('gsis_identity_mapping_2026.json', sources)
        self.assertNotIn('historical_usage_2023_2025.json', sources)
        self.assertNotIn('refresh_nflverse_historical_usage', sources)

    def test_mapping_artifact_is_auditable_and_honest(self):
        report = json.loads((ROOT / 'outputs/player_audit/gsis_historical_population_2026-08-19.json').read_text(encoding='utf-8'))
        self.assertEqual(report['nflverseLiveAccess'], 'UNAVAILABLE_IN_CODEX_ENVIRONMENT')
        self.assertEqual(report['gsisCoverage']['mapped'], 0)
        self.assertEqual(report['history']['players'], 0)
        self.assertEqual(report['activePlayers'], 330)
        self.assertEqual(report['gsisCoverage']['duplicateProviderIds'], 0)
        self.assertEqual(report['gsisCoverage']['duplicateCanonicalAttachments'], 0)

if __name__ == '__main__':
    unittest.main()
