import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class AdaptiveCoachingEngineTests(unittest.TestCase):
    def test_deterministic_scenarios(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/adaptive-coaching-engine-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/adaptive-coaching-engine-tests.js','utf8'));
const result=window.AdaptiveCoachingEngineTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Adaptive Coaching: 15 passed, 0 failed", result.stdout)

    def test_live_fight_control_uses_coaching_contract(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        card = app.split("function decisionCardMarkup", 1)[1].split("function alternativeDecisionMarkup", 1)[0]
        self.assertIn("AdaptiveCoachingEngineV1.buildCoachingDecision", app)
        self.assertIn('data-recommendation-renderer="adaptive-coaching-1.0"', card)
        for field in ("phaseLabel", "headline", "targetPlayerName", "confidence", "reason"):
            self.assertIn(f"decision.{field}", card)
        self.assertNotIn('<strong>${safeInsightText(summary.action)}</strong>', card)
        self.assertIn('aria-live="polite"', card)
        self.assertIn("js/adaptive-coaching-engine-v1.js?v=1.0.0", html)

    def test_header_is_condensed_and_accessible(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertEqual(html.count('id="headerDraftContext"'), 1)
        for item in ("headerRound", "headerPick", "headerSlot", "headerMode", "headerLeague"):
            self.assertEqual(html.count(f'id="{item}"'), 1)
            self.assertIn(item, app)
        self.assertIn('aria-label="Current draft context"', html)
        self.assertIn('id="myTeamHeading"', html)

    def test_engine_does_not_rank_or_score_players(self):
        source = (ROOT / "js" / "adaptive-coaching-engine-v1.js").read_text(encoding="utf-8")
        for forbidden in ("recommendations()", "finalPickScore", "mambaScore", "marketPressure", "waitScore", "Math.random", "Date.now", "document."):
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
