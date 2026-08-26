import json
import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class TeamFit444Tests(unittest.TestCase):
    def test_deterministic_contracts(self):
        result = subprocess.run([str(NODE), 'tests/teamfit-4-4-4-tests.js'], cwd=ROOT, text=True, capture_output=True, check=False, timeout=15)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload['passCount'], 13)
        self.assertEqual(payload['failCount'], 0)

    def test_shadow_interfaces_do_not_modify_decision_scoring(self):
        waiver = (ROOT / 'js/waiver-intelligence-v1.js').read_text(encoding='utf-8')
        start_sit = (ROOT / 'js/start-sit-intelligence-v1.js').read_text(encoding='utf-8')
        teamfit = (ROOT / 'js/teamfit-v1.js').read_text(encoding='utf-8')
        self.assertNotIn('FantasyHQTeamFitV1', waiver)
        self.assertNotIn('FantasyHQTeamFitV1', start_sit)
        self.assertIn('evaluateCandidate', teamfit)
        self.assertIn('compareRosters', teamfit)

    def test_ui_contract_is_compact_and_progressive(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        self.assertIn('seasonTeamFitSummaryCard', app)
        self.assertIn('TEAMFIT — ROSTER CONTEXT', app)
        self.assertIn('seasonTeamFitGrid', css)
        self.assertIn('@media(max-width:720px)', css)

    def test_analysis_hierarchy_interprets_before_disclosing_raw_evidence(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        shell = app.split('function seasonDecisionAnalysisShell', 1)[1].split('function seasonInsertPrimaryAnalysis', 1)[0]
        for heading in ('KEY TAKEAWAYS', 'TEAMFIT — ROSTER CONTEXT', 'RISK & UNCERTAINTY', 'SHOW ADVANCED EVIDENCE', 'SHOW SOURCES & PROVENANCE'):
            self.assertIn(heading, app)
        self.assertLess(shell.index('seasonAnalysisTakeaways'), shell.index("seasonAnalysisDisclosure('SHOW ADVANCED EVIDENCE'"))
        self.assertLess(shell.index('seasonTeamFitAnalysisGroup'), shell.index("seasonAnalysisDisclosure('SHOW SOURCES & PROVENANCE'"))
        self.assertIn('disclosure.open=false', app)

    def test_waiver_and_start_sit_share_hierarchy_without_changing_engines(self):
        app = (ROOT / 'js/app.js').read_text(encoding='utf-8')
        waiver_engine = (ROOT / 'js/waiver-intelligence-v1.js').read_text(encoding='utf-8')
        start_sit_engine = (ROOT / 'js/start-sit-intelligence-v1.js').read_text(encoding='utf-8')
        waiver_view = app.split('const seasonPlayerDetailsRenderer441', 1)[1].split('const seasonPlayerDetailsRenderer443', 1)[0]
        start_sit_view = app.split('function openSeasonStartSitAnalysis', 1)[1].split('function seasonStartSitFlightHero', 1)[0]
        self.assertIn("kind:'waiver'", waiver_view)
        self.assertIn("kind:'start-sit'", start_sit_view)
        self.assertIn('Waiver positional demand', waiver_view)
        self.assertIn('TeamFit roster need', waiver_view)
        self.assertIn('Preferred starter', start_sit_view)
        self.assertIn('Main uncertainty', start_sit_view)
        self.assertNotIn('seasonDecisionAnalysisShell', waiver_engine)
        self.assertNotIn('seasonDecisionAnalysisShell', start_sit_engine)

    def test_analysis_responsive_contract_prevents_equal_weight_mobile_wall(self):
        css = (ROOT / 'css/app.css').read_text(encoding='utf-8')
        for selector in ('.seasonDecisionAnalysis', '.seasonAnalysisTakeawayGrid', '.seasonAnalysisDisclosure', '.seasonAnalysisEvidenceGrid'):
            self.assertIn(selector, css)
        mobile = css.split('@media(max-width:720px)', 1)[1]
        self.assertIn('.seasonAnalysisTakeawayGrid{grid-template-columns:1fr}', mobile)
        self.assertIn('max-width:100%;overflow:hidden', mobile)


if __name__ == '__main__':
    unittest.main()
