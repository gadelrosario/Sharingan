import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class SleeperInjuryAdapterTests(unittest.TestCase):
    def test_adapter_contracts(self):
        result=subprocess.run([str(NODE),'tests/sleeper-injury-adapter-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(12,0))

    def test_runtime_loads_adapter_before_application(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertLess(html.index('js/sleeper-injury-adapter-v1.js'),html.index('js/app.js'))
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        self.assertIn('refreshDaily(players)',app)
        self.assertIn('refreshInjuryDataNow',app)
        self.assertIn('applyInjurySnapshot(result.snapshot',app)

    def test_refresh_script_is_atomic_and_fail_safe(self):
        script=(ROOT/'scripts/refresh_sleeper_injuries.js').read_text(encoding='utf-8')
        self.assertIn('fs.renameSync(temporary,output)',script)
        self.assertIn('existing snapshot was preserved',script)

if __name__=='__main__':unittest.main()
