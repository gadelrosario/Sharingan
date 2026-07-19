import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class JoninUXPolishTests(unittest.TestCase):
    def test_deterministic_presentation_model(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/jonin-ux-polish.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/jonin-ux-polish-tests.js','utf8'));
const result=window.JoninUXPolishTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Jonin UX Polish: 5 passed, 0 failed", result.stdout)

    def test_single_render_path_and_no_strategy_selector(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotIn('id="strategyPreset"', html)
        self.assertIn('js/jonin-ux-polish.js', html)
        self.assertIn("recommendationHeroMarkup(p,insight,vision,breakdown,state)", app)
        self.assertIn("renderTeamBuild()", app)
        self.assertIn('strategy:"auto"', app)


if __name__ == "__main__":
    unittest.main()
