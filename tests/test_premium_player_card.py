import json
import pathlib
import re
import subprocess
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class PremiumPlayerCardTests(unittest.TestCase):
    def test_deterministic_model(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/premium-player-card-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/premium-player-card-tests.js','utf8'));
const result=window.PremiumPlayerCardTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Premium Player Card: 20 passed, 0 failed", result.stdout)

    def test_live_renderer_contract_and_explicit_tier_accessor(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn("PremiumPlayerCardV1.buildPlayerCardModel", app)
        self.assertIn("tier:PlayerTierContract.getDecisionTier(player)", re.sub(r"\s+", "", app))
        self.assertIn("playerCard,", app)
        self.assertIn("card=model.playerCard", re.sub(r"\s+", "", app))
        self.assertIn("js/premium-player-card-v1.js?v=1.1.0", html)
        self.assertRegex(app, r"player\.id\s*!==\s*primary\.id")
        self.assertIn("COMPARING", app)

    def test_portrait_fallback_never_leaves_a_broken_image(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("function handlePlayerPortraitError", app)
        self.assertIn("image.dataset.positionFallback", app)
        self.assertIn("image.dataset.genericFallback", app)
        self.assertRegex(app, r"image\.hidden\s*=\s*true")
        self.assertIn("Player portrait unavailable for", app)
        for name in ("generic", "qb", "rb", "wr", "te", "k", "dst"):
            self.assertTrue((ROOT / "assets" / "player-placeholders" / f"{name}.svg").is_file())

    def test_accessibility_responsive_and_long_name_contracts(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        self.assertIn('<h2>${safeInsightText(card.name)}</h2>', app)
        self.assertIn("['exact-local','provider'].includes(card.imageStatus)", app)
        self.assertIn("Player portrait unavailable for", app)
        self.assertIn('aria-label="Player metrics"', app)
        self.assertRegex(css, r"overflow-wrap\s*:\s*anywhere")
        compact_css = re.sub(r"\s+", "", css)
        self.assertIn("grid-template-columns:minmax(135px,30%)minmax(0,1fr)", compact_css)
        self.assertNotIn("min-width:600px", css)

    def test_service_worker_caches_only_real_card_assets(self):
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn('fantasy-hq-jonin-4-3-4', worker)
        self.assertIn('./js/premium-player-card-v1.js?v=1.1.0', worker)
        self.assertNotIn('assets/players/', worker)
        for name in ("generic", "qb", "rb", "wr", "te", "k", "dst"):
            self.assertIn(f'./assets/player-placeholders/{name}.svg', worker)

    def test_player_ids_remain_unique(self):
        players = json.loads((ROOT / "data" / "players.json").read_text(encoding="utf-8"))
        ids = [player["id"] for player in players]
        self.assertEqual(len(ids), len(set(ids)))

    def test_polished_hierarchy_and_draft_action_remain_presentational(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        card = app.split("function premiumPlayerCardMarkup", 1)[1].split("function comparableQuarterbackDepth", 1)[0]
        self.assertIn("premiumTierBadge", card)
        self.assertIn("premiumMambaBadge", card)
        self.assertIn("playerCardBye", card)
        self.assertIn("playerCardAction", card)
        self.assertIn("selectPlayer(${safeInsightText(card.playerId)},${slot})", card)
        self.assertNotIn("'RECOMMENDED'", card)
        self.assertLess(card.index("playerCardMetrics"), card.index("playerTraits"))
        self.assertLess(card.index("playerTraits"), card.index("playerCardBye"))
        self.assertIn("compactFightCard", css)
        self.assertRegex(css, r"\.fightPlayerContent\s+h2[\s\S]*?font-size")
        self.assertIn(".playerPortrait:after", css)
        self.assertIn(".portraitLight", css)


if __name__ == "__main__":
    unittest.main()
