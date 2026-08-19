import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin4311Tests(unittest.TestCase):
    def test_historical_usage_contracts(self):
        result=subprocess.run([str(NODE),'tests/historical-usage-4-3-11-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'],payload['failCount']),(26,0),payload['failures'])

    def test_historical_usage_is_not_browser_loaded(self):
        browser='\n'.join((ROOT/path).read_text(encoding='utf-8') for path in ('index.html','service-worker.js','js/app.js'))
        self.assertNotIn('historical-usage',browser)
        source='\n'.join(path.read_text(encoding='utf-8') for path in (ROOT/'js/intelligence-core/historical-usage').glob('*.js'))
        for symbol in ('finalDecisionScore','mambaScore','recommendations(','DraftPsychology'):
            self.assertNotIn(symbol,source)

    def test_no_large_live_historical_snapshot_was_fabricated(self):
        self.assertFalse((ROOT/'data/historical_usage_2023_2025.json').exists())

    def test_historical_inventory_is_reproducible(self):
        result=subprocess.run([str(NODE),'scripts/audit_championship_equity_data.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        generated=json.loads(result.stdout);generated.pop('generatedAt',None)
        committed=json.loads((ROOT/'outputs/player_audit/historical_usage_inventory_2026-08-19.json').read_text(encoding='utf-8'));committed.pop('generatedAt',None)
        self.assertEqual(generated,committed)

    def test_normalizer_is_atomic_and_refuses_zero_safe_matches(self):
        source=(ROOT/'scripts/normalize_nflverse_usage.js').read_text(encoding='utf-8')
        self.assertIn('zero safe canonical matches',source)
        self.assertIn('fs.renameSync(temporary,target)',source)
        self.assertIn('existing output was preserved',source)

if __name__=='__main__':unittest.main()
