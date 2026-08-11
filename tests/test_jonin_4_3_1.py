import json,pathlib,subprocess,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
class Jonin431Tests(unittest.TestCase):
 def test_deterministic_mid_late_contracts(self):
  result=subprocess.run([str(NODE),'tests/jonin-4-3-1-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False,timeout=180)
  self.assertEqual(result.returncode,0,result.stdout+result.stderr);payload=json.loads(result.stdout);self.assertEqual(payload['failCount'],0);self.assertEqual(payload['passCount'],5)
if __name__=='__main__':unittest.main()
