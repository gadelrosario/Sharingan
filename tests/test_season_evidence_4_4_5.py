import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class SeasonEvidence445Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/season-evidence-4-4-5-tests.js'], cwd=ROOT,
            text=True, capture_output=True, check=False, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('24/24 passed', result.stdout)

    def test_module_precedes_app_and_is_offline_cached(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        worker = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
        self.assertLess(html.index('js/season-evidence-v1.js'), html.index('js/app.js'))
        self.assertIn("'./js/season-evidence-v1.js?v=1.1.0'", worker)
        self.assertIn("'./tests/fixtures/season_evidence_4_4_5.json'", worker)

    def test_shadow_authority_and_domain_firewalls_are_explicit(self):
        source = (ROOT / 'js/season-evidence-v1.js').read_text(encoding='utf-8')
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        self.assertIn('recommendationAuthority:false', source)
        self.assertIn("'CURRENT_YAHOO':'YAHOO_UNAVAILABLE'", source)
        self.assertNotIn('localStorage', source)
        self.assertNotIn('globalThis.fetch', source)
        self.assertIn('Shadow diagnostics only', app)

    def test_existing_decision_engines_do_not_import_evidence(self):
        for path in ('js/waiver-intelligence-v1.js', 'js/start-sit-intelligence-v1.js', 'js/teamfit-v1.js'):
            self.assertNotIn('SeasonEvidence', (ROOT / path).read_text(encoding='utf-8'), path)

    def test_compact_responsive_diagnostic_contract(self):
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        self.assertIn('.seasonEvidenceGrid', css)
        self.assertIn('@media(max-width:900px)', css)
        self.assertIn('@media(max-width:520px)', css)
        self.assertIn("document.createElement('details')", app)
        self.assertIn("summary.textContent='Show evidence provenance'", app)


if __name__ == '__main__':
    unittest.main()
