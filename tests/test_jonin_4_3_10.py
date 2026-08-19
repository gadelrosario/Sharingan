import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin4310Tests(unittest.TestCase):
    def test_player_context_projection_and_market_contracts(self):
        result=subprocess.run([str(NODE),'tests/player-intake-4-3-10-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'],payload['failCount']),(28,0),payload['failures'])

    def test_intake_remains_outside_browser_and_production_strategy(self):
        browser='\n'.join((ROOT/path).read_text(encoding='utf-8') for path in ('index.html','service-worker.js','js/app.js'))
        self.assertNotIn('player-intake',browser)
        source='\n'.join(path.read_text(encoding='utf-8') for path in (ROOT/'js/intelligence-core/player-intake').glob('*.js'))
        for symbol in ('finalDecisionScore','mambaScore','Best Pick','recommendations('):
            self.assertNotIn(symbol,source)

    def test_no_provider_secret_or_live_projection_snapshot_is_committed(self):
        self.assertFalse((ROOT/'data/projection_market_2026.json').exists())
        self.assertFalse((ROOT/'data/player_context_2026.json').exists())
        for path in (ROOT/'js/intelligence-core/player-intake').glob('*.js'):
            source=path.read_text(encoding='utf-8')
            self.assertNotRegex(source,r'(?i)(api[_-]?key|secret)\s*[:=]\s*["\'][A-Za-z0-9]{16,}')

    def test_updated_inventory_is_reproducible(self):
        result=subprocess.run([str(NODE),'scripts/audit_championship_equity_data.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        generated=json.loads(result.stdout);generated.pop('generatedAt',None)
        committed=json.loads((ROOT/'outputs/player_audit/player_intake_inventory_2026-08-19.json').read_text(encoding='utf-8'));committed.pop('generatedAt',None)
        self.assertEqual(generated['totalPlayers'],committed['totalPlayers'])
        self.assertEqual(generated['positionCounts'],committed['positionCounts'])
        for key,value in committed['coverage'].items():
            self.assertEqual(generated['coverage'][key],value,key)
        for position,expected in committed['byPosition'].items():
            for key,value in expected.items():
                self.assertEqual(generated['byPosition'][position][key],value,f'{position}.{key}')

if __name__=='__main__':unittest.main()
