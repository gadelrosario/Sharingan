import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class WaiverIntelligenceTests(unittest.TestCase):
    def test_deterministic_waiver_contracts(self):
        result = subprocess.run([str(NODE), 'tests/waiver-intelligence-4-4-2-tests.js'], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual((payload['passCount'], payload['failCount']), (14, 0), payload)

    def test_waiver_module_does_not_reference_draft_authority(self):
        source = (ROOT / 'js/waiver-intelligence-v1.js').read_text().lower()
        for forbidden in ('mambascore(', 'finalpickscore(', 'recommendations()', 'bestpick', 'highestupside'):
            self.assertNotIn(forbidden, source)

    def test_shadow_mode_and_unknown_contracts_are_explicit(self):
        source = (ROOT / 'js/waiver-intelligence-v1.js').read_text()
        self.assertIn('INSUFFICIENT_VALIDATED_SEASON_DATA', source)
        self.assertIn('FAAB: Not yet scored', source)
        self.assertIn('Waiver intelligence awaiting current Yahoo roster and availability data.', source)
        self.assertIn("!model.demo&&sharinganPick", source)

    def test_ui_and_asset_contracts(self):
        app = (ROOT / 'js/app.js').read_text()
        html = (ROOT / 'index.html').read_text()
        css = (ROOT / 'css/app.css').read_text()
        worker = (ROOT / 'service-worker.js').read_text()
        for contract in ('seasonWaiverEvaluation', 'seasonWaiverRow', 'renderSeasonWaivers', 'SHARINGAN WAIVER PICK', 'CHIDORI ALERT', 'FAAB: Not yet scored'):
            self.assertIn(contract, app)
        self.assertLess(html.index('js/waiver-intelligence-v1.js?v=1.0.0'), html.index('js/app.js?v=4.4.4.1'))
        self.assertIn("'./js/waiver-intelligence-v1.js?v=1.0.0'", worker)
        self.assertIn('.seasonWaiverDecisionRow', css)
        self.assertIn('@media(max-width:720px)', css)

    def test_season_ux_convergence_contracts_are_progressive_and_deduplicated(self):
        app = (ROOT / 'js/app.js').read_text()
        css = (ROOT / 'css/app.css').read_text()
        engine = (ROOT / 'js/waiver-intelligence-v1.js').read_text()
        for contract in ('seasonWaiverRecommendationCards', 'seasonWaiverDecisionCard', 'seasonWaiverRosterImpact', 'seasonWaiverTimingCopy', 'PRIMARY DECISIONS', 'WATCHLIST / MONITOR', 'OTHER CANDIDATES', "kind:'waiver'", 'DECISION ANALYSIS'):
            self.assertIn(contract, app)
        self.assertIn('used.has(pair.canonicalPlayerId)', app)
        self.assertIn('disclosedIds', app)
        for selector in ('.seasonDecisionHero', '.seasonDecisionCard', '.seasonDecisionGrid', '.seasonRosterImpact', '.seasonDecisionPhoto'):
            self.assertIn(selector, css)
        for presentation_only in ('seasonDecisionCard', 'PRIMARY DECISIONS', 'View Analysis'):
            self.assertNotIn(presentation_only, engine)

    def test_final_polish_keeps_strategy_card_and_analysis_distinct(self):
        app = (ROOT / 'js/app.js').read_text()
        css = (ROOT / 'css/app.css').read_text()
        card_source = app[app.index('function seasonWaiverDecisionCard'):app.index('function seasonWaiverRow')]
        self.assertNotIn("seasonRosterImpact", card_source)
        for contract in ('seasonWaiverFlightSummary', 'Best current opportunity:', 'seasonHomeDecision', 'DECISION WINDOW'):
            self.assertIn(contract, app)
        self.assertIn('.seasonHomeDecision', css)
        self.assertIn('.seasonDecisionWindow', css)
        self.assertIn('.seasonDecisionHero .seasonWatch.seasonDecisionWindow{display:flex', css)

    def test_bounded_smoke(self):
        result = subprocess.run([str(NODE), 'scripts/run_waiver_intelligence_smoke_4_4_2.js'], cwd=ROOT, text=True, capture_output=True, check=False, timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout.splitlines()[-1])
        self.assertEqual(payload['status'], 'PASS', payload)
        self.assertLess(payload['elapsedMs'], 30000)


if __name__ == '__main__':
    unittest.main()
