import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


class SeasonHomeV3Tests(unittest.TestCase):
    @unittest.skipUnless(NODE, "node is required")
    def test_thirty_eight_deterministic_contracts(self):
        result = subprocess.run(
            [NODE, "tests/season-home-v3-tests.js"], cwd=ROOT, text=True, capture_output=True
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["passCount"], 38)
        self.assertEqual(payload["failCount"], 0)

    def test_v3_is_the_active_final_home_renderer(self):
        source = (ROOT / "js/app.js").read_text(encoding="utf-8")
        marker = "renderSeasonHome = function (model, content)"
        v3_renderer = source[source.rfind(marker, 0, source.rindex(marker)):source.index("function seasonManualPlayerOptions")]
        final_renderer = source[source.rindex(marker):]
        self.assertIn("seasonV3Matchup(model)", v3_renderer)
        self.assertIn("seasonV3Decisions(plan, model)", v3_renderer)
        self.assertIn("seasonRosterCard(model)", v3_renderer)
        self.assertIn("seasonHomeRenderer44113(model, content)", final_renderer)

    def test_matchup_and_recommendation_authorities_stay_separate(self):
        source = (ROOT / "js/app.js").read_text(encoding="utf-8")
        self.assertIn("facts = model.homeMatchup || {}", source)
        self.assertIn("const plan = seasonWeeklyPlan(model)", source)
        self.assertNotIn("homeMatchup.finalScore", source)

    def test_new_surface_has_no_inline_untrusted_markup(self):
        source = (ROOT / "js/app.js").read_text(encoding="utf-8")
        start = source.index("function seasonV3MetricValue")
        end = source.index("function seasonManualPlayerOptions", start)
        surface = source[start:end]
        self.assertNotIn("innerHTML", surface)
        self.assertNotIn("insertAdjacentHTML", surface)

    def test_responsive_contract_and_module_order(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        css = (ROOT / "css/app.css").read_text(encoding="utf-8")
        self.assertLess(html.index("js/season-home-v3.js"), html.index("js/app.js"))
        self.assertIn("@media(max-width:620px)", css)
        self.assertIn(".seasonV3Dashboard{grid-template-columns:1fr}", css)
        self.assertIn("max-width:100%;overflow:hidden", css)

    def test_final_visual_hierarchy_and_adaptive_decision_contracts(self):
        source = (ROOT / "js/app.js").read_text(encoding="utf-8")
        css = (ROOT / "css/app.css").read_text(encoding="utf-8")
        self.assertIn("seasonV3HoldState", source)
        for count in range(4):
            self.assertIn(f".seasonV3DecisionGrid.count-{count}", css)
        self.assertIn("seasonV3ActionHeader", source)
        self.assertIn("seasonV3SecondaryHeader", source)
        self.assertIn("--season-v3-gold:#fdb927", css)
        self.assertIn(".seasonV3ActionHeader h2,.seasonV3SecondaryHeader h2{color:#fff}", css)
        self.assertIn("seasonV3BattleUnavailable", source)
        self.assertIn("seasonV3ActualScore", source)
        self.assertIn("seasonV3ProjectedScore", source)


if __name__ == "__main__":
    unittest.main()
