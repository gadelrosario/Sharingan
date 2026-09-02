import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class SeasonCommandCenterTests(unittest.TestCase):
    def run_node(self, script, expected):
        result = subprocess.run([str(NODE), script], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload.get('failCount', 0)), (expected, 0), payload)

    def test_deterministic_season_contracts(self):
        self.run_node('tests/season-command-center-4-4-1-tests.js', 30)

    def test_bounded_season_ui_smoke(self):
        result = subprocess.run([str(NODE), 'scripts/run_season_ui_smoke_4_4_1.js'], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual(payload['passCount'], 18)
        self.assertTrue(payload['withinTarget'])

    def test_assets_load_before_app_and_are_offline_cached(self):
        html = (ROOT / 'index.html').read_text()
        worker = (ROOT / 'service-worker.js').read_text()
        self.assertLess(html.index('js/season-command-center-v1.js'), html.index('js/app.js'))
        self.assertIn("'./js/season-command-center-v1.js?v=1.1.3'", worker)

    def test_draft_authority_is_not_imported_into_season_module(self):
        source = (ROOT / 'js/season-command-center-v1.js').read_text().lower()
        for forbidden in ('mambascore(', 'finalpickscore(', 'recommendations()', 'championshipequity', 'teamfitscore'):
            self.assertNotIn(forbidden, source)

    def test_accessibility_and_responsive_contracts(self):
        html = (ROOT / 'index.html').read_text()
        css = (ROOT / 'css/app.css').read_text()
        self.assertIn('aria-label="Season navigation"', html)
        self.assertIn('aria-expanded="false"', html)
        self.assertIn('@media(max-width:1100px)', css)
        self.assertIn('@media(max-width:720px)', css)
        self.assertIn('overflow:hidden', css)

    def test_primary_header_exposes_profile_scoped_mode_switch(self):
        html = (ROOT / 'index.html').read_text()
        app = (ROOT / 'js/app.js').read_text()
        self.assertLess(html.index('id="primaryProductModeSwitch"'), html.index('id="setupScreen"'))
        self.assertIn('id="primaryDraftModeButton"', html)
        self.assertIn('id="primarySeasonModeButton"', html)
        self.assertIn('id="primaryHeaderProfileSelect"', html)
        self.assertIn('function selectHeaderLeagueProfile(profileId){selectLeagueProfile(profileId)}', app)
        open_mode = app[app.index('async function openSeasonMode()'):app.index('function exitSeasonMode()')]
        self.assertNotIn('seasonAvailable', open_mode)
        self.assertIn("SeasonCommandCenterV1.saveMode(localStorage,activeLeagueProfile.id,'season')", open_mode)

    def test_draft_return_restores_visible_start_surface(self):
        app = (ROOT / 'js/app.js').read_text()
        exit_mode = app[app.index('function exitSeasonMode()'):app.index('function returnToDraftMode()')]
        self.assertIn("el('setupScreen')?.classList.remove('hidden')", exit_mode)
        self.assertIn("el('primaryDraftModeButton')?.classList.add('active')", exit_mode)
        self.assertIn("saveMode(localStorage,activeLeagueProfile.id,'draft')", exit_mode)


if __name__ == '__main__':
    unittest.main()
