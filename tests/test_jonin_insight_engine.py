import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class JoninInsightEngineTests(unittest.TestCase):
    def test_deterministic_javascript_suite(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/jonin-insight-engine-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/jonin-insight-tests.js','utf8'));
const result=window.JoninInsightTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Jonin Insight: 14 passed, 0 failed", result.stdout)

    def test_visible_confidence_label_is_explicitly_heuristic(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("['Heuristic confidence',insight.sections.confidence]", source)
        self.assertIn("Heuristic • ${safeInsightText(c.label)}", source)


if __name__ == "__main__":
    unittest.main()
