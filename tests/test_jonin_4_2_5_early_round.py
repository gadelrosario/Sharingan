import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin425EarlyRoundTests(unittest.TestCase):
    def test_early_round_contracts(self):
        result=subprocess.run([str(NODE),'tests/jonin-4-2-5-early-round-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False,timeout=180)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(10,0))

    def test_canonical_score_is_unrounded_ordering_input(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        boundary=app.split('function recommendations()',1)[1].split('function rationale',1)[0]
        self.assertIn('finalDecisionScore:trace.finalDecisionScore',boundary)
        self.assertNotIn('finalDecisionScore:finalPickScore',boundary)

if __name__=='__main__':unittest.main()
