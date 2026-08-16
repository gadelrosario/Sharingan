import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class DraftPsychologyTests(unittest.TestCase):
    def test_42_deterministic_scenarios(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/draft-psychology-engine-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/draft-psychology-tests.js','utf8'));
const result=window.DraftPsychologyTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Draft Psychology: 42 passed, 0 failed", result.stdout)

    def test_live_renderer_consumes_primary_recommendation_only(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertRegex(app, r"function\s+draftPsychologyFor\s*\(\s*primary\s*,\s*recs\s*\)")
        self.assertRegex(app, r"const\s+psychology\s*=\s*draftPsychologyFor\s*\(\s*primary\s*,\s*recs\s*\)")
        self.assertIn("draftPsychologyMarkup(psychology)", app)
        self.assertNotIn("DraftPsychologyEngineV1.analyze({player", app)

    def test_canonical_tier_contract_and_read_only_score_inputs(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        module = (ROOT / "js" / "draft-psychology-engine-v1.js").read_text(encoding="utf-8")
        compact = re.sub(r"\s+", "", app)
        self.assertIn("tier:PlayerTierContract.getDecisionTier(candidate)", compact)
        self.assertIn("tier:PlayerTierContract.getDecisionTier(primary)", compact)
        self.assertIn("recommendationMamba:mambaScore(primary)", compact)
        self.assertNotIn("finalPickScore", module)
        self.assertNotIn("recommendations(", module)

    def test_accessible_compact_responsive_surface(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        self.assertIn('aria-label="Room Intelligence" aria-live="off"', app)
        self.assertIn("<details><summary>Next-turn outlook</summary>", app)
        self.assertRegex(css, r"\.draftPsychology\s+li\s*\{\s*max-width:\s*48%")
        compact = re.sub(r"\s+", "", css)
        self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))", compact)
        self.assertNotIn("min-width:600px", css)

    def test_offline_asset_and_version_contract(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn('js/draft-psychology-engine-v1.js?v=1.0.0', html)
        self.assertIn('js/draft-psychology-engine-v1.js?v=1.0.0', worker)
        self.assertIn('fantasy-hq-jonin-4-3-5', worker)
        self.assertIn('service-worker.js?v=jonin_4_3_5', app)


if __name__ == "__main__":
    unittest.main()
