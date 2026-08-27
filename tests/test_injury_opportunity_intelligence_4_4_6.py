import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class InjuryOpportunityIntelligence446Tests(unittest.TestCase):
    def test_deterministic_intelligence_contracts(self):
        result = subprocess.run(
            [str(NODE), 'tests/injury-opportunity-intelligence-4-4-6-tests.js'],
            cwd=ROOT, text=True, capture_output=True, check=False, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (25, 0), payload)

    def test_module_is_loaded_after_evidence_and_before_app(self):
        html = (ROOT / 'index.html').read_text(encoding='utf-8')
        worker = (ROOT / 'service-worker.js').read_text(encoding='utf-8')
        evidence = html.index('js/season-evidence-v1.js')
        intelligence = html.index('js/injury-opportunity-intelligence-v1.js')
        app = html.index('js/app.js')
        self.assertLess(evidence, intelligence)
        self.assertLess(intelligence, app)
        self.assertIn("'./js/injury-opportunity-intelligence-v1.js?v=1.0.0'", worker)

    def test_scoring_and_activation_firewalls_remain_explicit(self):
        source = (ROOT / 'js/injury-opportunity-intelligence-v1.js').read_text(encoding='utf-8')
        self.assertIn('recommendationAuthority:false', source)
        self.assertIn('transactionAuthority:false', source)
        self.assertIn('sharinganActivation:false', source)
        self.assertIn('chidoriActivation:false', source)
        self.assertNotIn('finalPickScore', source)
        self.assertNotIn('mambaScore', source)

    def test_existing_engines_do_not_consume_new_intelligence(self):
        for path in ('js/waiver-intelligence-v1.js', 'js/start-sit-intelligence-v1.js', 'js/teamfit-v1.js', 'js/sharingan-vision-v1.js'):
            self.assertNotIn('InjuryOpportunityIntelligence', (ROOT / path).read_text(encoding='utf-8'), path)

    def test_ui_is_contextual_and_progressively_disclosed(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        for text in ('ROLE & OPPORTUNITY WATCH', 'INJURY & OPPORTUNITY INTELLIGENCE', 'Advanced Evidence', 'Sources & Provenance'):
            self.assertIn(text, app)
        self.assertIn('.seasonNflIntelligence', css)
        self.assertIn('recommendationAuthority', app)


if __name__ == '__main__':
    unittest.main()
