import json,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1];NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
class DraftStrategyEngineTests(unittest.TestCase):
 def test_strategy_and_golden_contracts(self):
    result=subprocess.run([str(NODE),'tests/draft-strategy-engine-tests.js'],cwd=ROOT,text=True,capture_output=True);self.assertEqual(result.returncode,0,result.stdout+result.stderr);payload=json.loads(result.stdout);self.assertEqual((payload['passCount'],payload['failCount']),(24,0))
if __name__=='__main__':unittest.main()
