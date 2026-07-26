import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class UnifiedDecisionEngineTests(unittest.TestCase):
    def test_deterministic_decision_engine_contracts(self):
        result = subprocess.run([str(NODE), "tests/decision-engine-tests.js"], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Unified Decision Engine: 39 passed, 0 failed", result.stdout)

    def test_decision_engine_is_absent_from_browser_runtime(self):
        for path in (ROOT / "index.html", ROOT / "js" / "app.js", ROOT / "service-worker.js"):
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("decision-engine", source)
            self.assertNotIn("UnifiedDecisionEngine", source)

    def test_decision_engine_does_not_import_stable_implementations(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in sorted((ROOT / "js" / "decision-engine").glob("*.js")))
        for implementation in (
            "draft-psychology-engine-v1", "flight-control-v1", "adaptive-coaching-engine-v1",
            "app.js", "fantasy-hq-core", "mambaScore", "finalPickScore", "recommendations(",
        ):
            self.assertNotIn(implementation, source)
        self.assertNotIn("Math.random", source)

    def test_required_documentation_exists(self):
        for name in ("DECISION_ENGINE.md", "BEST_PATH.md", "DECISION_PIPELINE.md", "ACTION_EVALUATION.md"):
            path = ROOT / "docs" / name
            self.assertTrue(path.is_file(), name)
            self.assertGreater(len(path.read_text(encoding="utf-8")), 300, name)


if __name__ == "__main__":
    unittest.main()
