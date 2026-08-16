import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin435Tests(unittest.TestCase):
    def test_data_hardening_contracts(self):
        result=subprocess.run([str(NODE),'tests/data-hardening-4-3-5-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(11,0))

    def test_compact_status_is_loaded_before_application(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertIn('id="dataHealthReadout"',html)
        self.assertLess(html.index('js/data-health-v1.js'),html.index('js/app.js'))
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        self.assertIn('renderDataHealthStatus()',app)
        self.assertIn('injuryFeedManager?.prime(bundled)',app)

    def test_refresh_path_does_not_reset_draft(self):
        app=(ROOT/'js/app.js').read_text(encoding='utf-8')
        body=app.split('async function refreshInjuryDataNow()',1)[1].split('\nfunction refreshDraftSlotOptions',1)[0]
        for forbidden in ('startDraft(', 'resetDraft(', 'drafted = []', 'history = []', 'draftSessionStore.clear'):
            self.assertNotIn(forbidden,body)

if __name__=='__main__':unittest.main()
