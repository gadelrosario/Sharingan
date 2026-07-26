import pathlib
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class ExpertIntelligenceTests(unittest.TestCase):
    def test_deterministic_expert_registry(self):
        result = subprocess.run([str(NODE), "tests/expert-intelligence-tests.js"], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Expert Intelligence: 31 passed, 0 failed", result.stdout)

    def test_live_application_does_not_load_registry(self):
        for path in (ROOT / "index.html", ROOT / "js" / "app.js", ROOT / "service-worker.js"):
            source = path.read_text(encoding="utf-8")
            self.assertNotIn("expert-signals", source)
            self.assertNotIn("intelligence-core", source)

    def test_seed_files_contain_no_provider_ids_or_player_examples(self):
        source = "\n".join(path.read_text(encoding="utf-8") for path in sorted((ROOT / "js" / "intelligence-core" / "expert-signals").glob("*.js")))
        for provider_field in ("yahooId", "sleeperId", "fantasyProsId"):
            self.assertNotIn(provider_field, source)
        self.assertNotIn("recommendationScore", source)

    def test_required_expert_documentation_exists(self):
        for name in ("EXPERT_INTELLIGENCE.md", "BDGE_RULES.md", "FANTASYLAND_RULES.md", "FLOCK_RULES.md"):
            path = ROOT / "docs" / name
            self.assertTrue(path.is_file(), name)
            self.assertGreater(len(path.read_text(encoding="utf-8")), 300, name)


if __name__ == "__main__":
    unittest.main()
