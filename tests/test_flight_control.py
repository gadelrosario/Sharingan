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
        self.assertIn("Flight Control: 8 passed, 0 failed", result.stdout)

    def test_progressive_disclosure_and_shared_player_renderer(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('class="advancedAnalysis"', app)
        card_source = app.split("function decisionCardMarkup", 1)[1].split("function alternativeDecisionMarkup", 1)[0]
        default_source, advanced_source = card_source.split('class="advancedAnalysis"', 1)
        for conclusion in ("CAN I WAIT?", "OPPORTUNITY WINDOW", "AVAILABILITY FORECAST"):
            self.assertEqual(default_source.count(conclusion), 1)
        for metric in ("Mamba", "Final Pick", "Room Boost", "Roster Fit", "Steal Risk", "Stack", "Handcuff", "Exposure"):
            self.assertNotIn(metric, default_source)
            self.assertIn(metric, advanced_source)
        for ignored_section in ("VALUE", "SCARCITY", "RISK", "TEAM FIT", "SCORE BREAKDOWN"):
            self.assertNotIn(ignored_section, default_source)
        self.assertIn("compactComparison", default_source)
        self.assertIn("Why not ${alternative.name}?", app)
        self.assertIn("sharinganIconMarkup(sharinganStage(p).key)", default_source)
        self.assertIn("summary.confidence.label", default_source)
        self.assertIn("advancedAnalysisExpanded?'open'", app)
        self.assertIn("decisionCardMarkup(model,{recommended:displayed.id===primary.id})", app)
        self.assertNotIn("function recommendationHeroMarkup", app)
        self.assertIn('data-recommendation-renderer="flight-control-1.1"', app)
        self.assertIn("alternativeDecisionMarkup(playerDecisionModel(candidate,recs)", app)
        self.assertIn("recommendation.dataset.renderMs", app)
        self.assertIn('class="card planningDetails"', html)
        self.assertNotIn("mobileVisionCard", html)
        self.assertIn("js/flight-control-v1.js", html)

    def test_deployed_assets_activate_the_flight_control_renderer(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        worker = (ROOT / "service-worker.js").read_text(encoding="utf-8")
        self.assertIn('css/app.css?v=3.4.1', html)
        self.assertIn('js/flight-control-v1.js?v=1.2.1', html)
        self.assertIn('js/app.js?v=3.4.1', html)
        self.assertIn('service-worker.js?v=snake_board_colors_1', app)
        self.assertIn('fantasy-hq-snake-board-colors-1', worker)
        for asset in ('css/app.css?v=3.4.1', 'js/flight-control-v1.js?v=1.2.1', 'js/app.js?v=3.4.1'):
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
        self.assertIn("selectPlayer(${p.id},${slot})", app)
        self.assertIn("renderRecommendation();", app)

    def test_snake_board_uses_position_classes_without_styling_empty_cells(self):
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "css" / "app.css").read_text(encoding="utf-8")
        board = app.split("function renderBoard", 1)[1].split("function teamTierMarkup", 1)[0]
        incremental = app.split("function updateBoardIncremental", 1)[1].split("function scheduleHeavyRefresh", 1)[0]
        self.assertIn("boardPlayerClasses(pl)", board)
        self.assertIn("applyBoardPlayerClasses(used,pl)", incremental)
        self.assertIn("function boardPlayerClasses(player)", app)
        self.assertIn("classList.toggle('drafted-player',Boolean(player))", app)
        undo = app.split("function undoLastPick", 1)[1].split("function syncSearch", 1)[0]
        render_all = app.split("function renderAll", 1)[1].split("function invalidateIntelligence", 1)[0]
        self.assertIn("renderAll()", undo)
        self.assertIn("renderBoard()", render_all)
        for position in ("wr", "rb", "te", "qb", "k", "dst", "unknown"):
            self.assertIn(f".pickCell.board-pos-{position}", css)
        self.assertIn(".pickCell.board-pos-dst", css)
        self.assertNotIn("#ff00ff", css)
        self.assertIn(".pickCell.board-pos-k{background:#d62f45;border-left:4px solid #ffad52", css)


if __name__ == "__main__":
    unittest.main()
