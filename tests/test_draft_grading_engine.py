import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class DraftGradingEngineTests(unittest.TestCase):
    def test_deterministic_grading_suite(self):
        result = subprocess.run(
            ["node", "tests/draft-grading-engine-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("8/8 passed", result.stdout)

    def test_single_unified_completion_path(self):
        app = (ROOT / "js" / "app.js").read_text()
        self.assertIn("DraftGradingEngineV1.evaluateDraft(gradingInput())", app)
        self.assertIn("function finishDraft()", app)
        self.assertNotIn("function evaluateTeam(team)", app)
        self.assertNotIn("Projected Champion", app)

    def test_all_modes_share_the_same_finish_function(self):
        app = (ROOT / "js" / "app.js").read_text()
        finish = app[app.index("function finishDraft()"):app.index("function yahooArchive()")]
        self.assertIn("renderDraftReport()", finish)
        self.assertNotIn("evaluateTeam", finish)
        self.assertNotIn("gradeLeague", finish)

    def test_report_exposes_required_categories_and_estimates(self):
        source = (ROOT / "js" / "draft-grading-engine-v1.js").read_text()
        for label in (
            "Draft Value", "Roster Construction", "Positional Timing",
            "Risk Management", "Bench Upside", "League Fit",
            "championshipOdds", "projectedFinishRange", "draftPercentile",
        ):
            self.assertIn(label, source)


if __name__ == "__main__":
    unittest.main()
