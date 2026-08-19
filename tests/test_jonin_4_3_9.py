import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class Jonin439Tests(unittest.TestCase):
    def test_championship_equity_shadow_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/championship-equity-shadow-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (14, 0), payload['failures'])

    def test_shadow_module_is_not_loaded_by_production_browser(self):
        for relative in ('index.html', 'service-worker.js', 'js/app.js'):
            text = (ROOT / relative).read_text(encoding='utf-8')
            self.assertNotIn('championship-equity', text, relative)

    def test_frozen_baseline_covers_two_profiles_and_three_stages(self):
        baseline = json.loads(
            (ROOT / 'tests/fixtures/jonin_4_3_8_championship_equity_baseline.json').read_text(
                encoding='utf-8'
            )
        )
        self.assertEqual(set(baseline['profiles']), {'primary', 'straight-outta-downey'})
        for states in baseline['profiles'].values():
            self.assertEqual(set(states), {'early', 'middle', 'late'})
            for state in states.values():
                self.assertEqual(len(state['ids']), 5)
                self.assertEqual(len(state['scores']), 5)
                self.assertEqual(len(state['labels']), 5)

    def test_inventory_report_matches_reproducible_audit(self):
        result = subprocess.run(
            [str(NODE), 'scripts/audit_championship_equity_data.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        generated = json.loads(result.stdout)
        committed = json.loads(
            (ROOT / 'outputs/player_audit/championship_equity_inventory_2026-08-19.json').read_text(
                encoding='utf-8'
            )
        )
        generated.pop('generatedAt', None)
        committed.pop('generatedAt', None)
        self.assertEqual(generated, committed)


if __name__ == '__main__':
    unittest.main()
