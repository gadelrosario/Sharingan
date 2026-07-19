import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class SharinganVisionTests(unittest.TestCase):
    def test_deterministic_javascript_suite(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/sharingan-vision-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/sharingan-vision-tests.js','utf8'));
const result=window.SharinganVisionTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Sharingan Vision: 11 passed, 0 failed", result.stdout)

    def test_manager_table_columns_and_immediate_refresh_contract(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn('data-position="${pos}"', source)
        self.assertIn('["QB","RB","WR","TE"].map(pos=>', source)
        render_after_pick = source[source.index("function renderAfterPick"):source.index("function selectPlayer")]
        self.assertIn("renderManagerTables();", render_after_pick)


if __name__ == "__main__":
    unittest.main()
