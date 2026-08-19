import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path("/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node")


class FlightControlTests(unittest.TestCase):
    def test_deterministic_decision_model(self):
        command = """
global.window={};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/flight-control-v1.js','utf8'));
vm.runInThisContext(fs.readFileSync('tests/flight-control-tests.js','utf8'));
const result=window.FlightControlTests.run();if(result.failCount)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("Fight Control: 10 passed, 0 failed", result.stdout)

    def test_current_jahmyr_gibbs_pick_10_eternal_scenario(self):
        players = json.loads((ROOT / "data" / "players.json").read_text(encoding="utf-8"))
        gibbs = next(player for player in players if player["name"] == "Jahmyr Gibbs")
        self.assertEqual((gibbs["overall"], gibbs["overallTier"], gibbs["posTier"]), (2, "S", "S"))
        command = f"""
global.window={{}};const fs=require('fs'),vm=require('vm');
vm.runInThisContext(fs.readFileSync('js/flight-control-v1.js','utf8'));
const active=window.FlightControlV1.eternalMangekyoActive({{tier:{json.dumps(gibbs['posTier'])},overall:{gibbs['overall']},pick:10,score:85}});
if(!active)process.exit(1);
"""
        result = subprocess.run([str(NODE), "-e", command], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_progressive_disclosure_and_shared_player_renderer(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        card_source = app.split("function decisionCardMarkup", 1)[1].split("function alternativeDecisionMarkup", 1)[0]
        for metric in ("Player Value", "Roster Fit", "Opportunity Cost", "Future Value", "Final Pick", "Room Boost", "Steal Risk", "Stack", "Handcuff", "Exposure"):
            self.assertNotIn(metric, card_source)
        self.assertIn('class="compactFightCard', card_source)
        self.assertIn('class="fightTags"', card_source)
        self.assertIn("confidenceIndicator(confidence)", card_source)
        self.assertRegex(app, r"decisionCardMarkup\(model,\s*\{\s*recommended:\s*displayed\.id\s*===\s*primary\.id,?\s*\}\s*\)")
        self.assertNotIn("function recommendationHeroMarkup", app)
        self.assertIn("recs.slice(0,5).map(candidate=>playerDecisionModel(candidate,recs))", app)
        self.assertRegex(app, r"alternativeDecisionMarkup\(candidateModel,index\+1,categoryLabels\.get\(candidateModel\.player\.id\)\)")
        self.assertIn("recommendation.dataset.renderMs", app)
        self.assertIn('class="card planningDetails"', html)
        self.assertNotIn("mobileVisionCard", html)
        self.assertIn("js/flight-control-v1.js", html)

    def test_deployed_assets_activate_the_flight_control_renderer(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn('css/app.css?v=4.3.10', html)
        self.assertIn('js/flight-control-v1.js?v=1.3.0', html)
        self.assertIn('js/adaptive-coaching-engine-v1.js?v=1.0.0', html)
        self.assertIn('js/premium-player-card-v1.js?v=1.1.0', html)
        self.assertIn('js/draft-psychology-engine-v1.js?v=1.0.0', html)
        self.assertIn('js/app.js?v=4.3.10', html)
        self.assertIn('service-worker.js?v=jonin_4_3_10', app)
        self.assertIn('fantasy-hq-jonin-4-3-10', worker)
        for asset in ('css/app.css?v=4.3.10', 'js/app-version.js?v=1.0.13', 'js/flight-control-v1.js?v=1.3.0', 'js/adaptive-coaching-engine-v1.js?v=1.0.0', 'js/premium-player-card-v1.js?v=1.1.0', 'js/draft-psychology-engine-v1.js?v=1.0.0', 'js/app.js?v=4.3.10'):
            self.assertIn(asset, worker)

    def test_planning_removes_redundant_pressure_and_room_intel_rows(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        render_room = app.split("function renderRoomScan", 1)[1].split("function openRoomScan", 1)[0]
        self.assertIn("peekAheadMarkup()", render_room)
        self.assertNotIn("marketBoxMarkup", render_room)
        self.assertNotIn("roomIntelMarkup", render_room)
        self.assertNotIn('id="desktopRoomAlert"', html)
        self.assertNotIn('id="desktopRoomInsight"', html)

    def test_decision_surface_preserves_required_controls(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        for control in ("simulateBtn", "recommendation", "alternatives", "desktopTeamBuild", "round", "pickLabel"):
            self.assertIn(f'id="{control}"', html)
        self.assertIn("recordCurrentPick(${p.id})", app)
        self.assertIn("renderRecommendation();", app)

    def test_snake_board_uses_position_classes_without_styling_empty_cells(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        board = app.split("function renderBoard", 1)[1].split("function teamTierMarkup", 1)[0]
        incremental = app.split("function updateBoardIncremental", 1)[1].split("function scheduleHeavyRefresh", 1)[0]
        self.assertIn("boardPlayerClasses(pl)", board)
        self.assertRegex(incremental, r"applyBoardPlayerClasses\(used,\s*pl\)")
        self.assertIn("function boardPlayerClasses(player)", app)
        self.assertRegex(app, r"classList\.toggle\('drafted-player',\s*Boolean\(player\)\)")
        undo = app.split("function undoLastPick", 1)[1].split("function syncSearch", 1)[0]
        render_all = app.split("function renderAll", 1)[1].split("function invalidateIntelligence", 1)[0]
        self.assertIn("renderAll()", undo)
        self.assertIn("renderBoard()", render_all)
        for position in ("wr", "rb", "te", "qb", "k", "dst", "unknown"):
            self.assertIn(f".pickCell.board-pos-{position}", css)
        self.assertIn(".pickCell.board-pos-dst", css)
        self.assertNotIn("#ff00ff", css)
        self.assertRegex(css, r"(?s)\.pickCell\.board-pos-k\s*\{.*?background:\s*#d62f45;.*?border-left:\s*4px solid #ffad52")

if __name__ == "__main__":
    unittest.main()
