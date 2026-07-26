import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class IntelligenceCoreTests(unittest.TestCase):
    def test_deterministic_architecture_contracts(self):
        result = subprocess.run(
            [str(NODE), "tests/intelligence-core-tests.js"], cwd=ROOT,
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Intelligence Core: 38 passed, 0 failed", result.stdout)

    def test_core_is_not_loaded_by_live_ui(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        for source in (html, app, worker):
            self.assertNotIn("intelligence-core", source)

    def test_core_does_not_reference_stable_algorithms(self):
        core = "\n".join(
            path.read_text(encoding="utf-8")
            for path in sorted((ROOT / "js" / "intelligence-core").glob("*.js"))
        )
        for symbol in (
            "finalPickScore", "mambaScore", "DraftPsychologyEngineV1",
            "AdaptiveCoachingEngineV1", "FlightControlV1", "recommendations(",
        ):
            self.assertNotIn(symbol, core)

    def test_required_documentation_exists(self):
        for name in (
            "ARCHITECTURE.md", "DATA_MODEL.md", "DATA_PIPELINE.md",
            "MISSION_CONTROL.md", "INTELLIGENCE_ENGINE.md",
        ):
            path = ROOT / "docs" / name
            self.assertTrue(path.is_file(), name)
            self.assertGreater(len(path.read_text(encoding="utf-8")), 300, name)


if __name__ == "__main__":
    unittest.main()
