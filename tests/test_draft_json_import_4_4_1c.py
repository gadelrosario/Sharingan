import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class DraftJsonImportTests(unittest.TestCase):
    def test_deterministic_import_and_bootstrap_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/draft-json-import-4-4-1c-tests.js'],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (16, 0), payload)

    def test_browser_import_surface_uses_file_data_only(self):
        html = (ROOT / 'index.html').read_text()
        app = (ROOT / 'js/app.js').read_text()
        self.assertIn('id="importDraftJsonButton"', html)
        self.assertIn('type="file"', html)
        self.assertIn('accept="application/json,.json"', html)
        self.assertIn('validateDraftImport(await file.text()', app)
        self.assertIn('Permanent Draft History verification failed', app)
        self.assertIn('resolveSeasonState({live,demo,entries:discoverRecoverableCompletedDrafts()', app)
        self.assertIn('Season source: ${diagnostic.seasonSource', app)
        self.assertIn('function seasonDraftLeagueRosters(model)', app)
        self.assertIn('DRAFT SNAPSHOT — ALL LEAGUE ROSTERS', app)
        self.assertNotIn('eval(', app[app.index('async function handleDraftJSONFile'):app.index('function renderDraftImportReview')])

    def test_cache_busting_includes_import_modules(self):
        html = (ROOT / 'index.html').read_text()
        worker = (ROOT / 'service-worker.js').read_text()
        for asset in ('js/draft-workflow-v1.js?v=1.3.0', 'js/season-command-center-v1.js?v=1.1.2', 'js/app.js?v=4.4.3'):
            self.assertIn(asset, html)
            self.assertIn(f"'./{asset}'", worker)


if __name__ == '__main__':
    unittest.main()
