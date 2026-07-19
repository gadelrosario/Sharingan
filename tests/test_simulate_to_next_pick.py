import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
NODE = pathlib.Path(
    "/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
)


class SimulateToNextPickTests(unittest.TestCase):
    def test_mock_control_is_shared_and_clickable(self):
        markup = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertEqual(markup.count('id="simulateBtn"'), 1)
        self.assertIn(
            'id="simulateBtn" class="primary greenBtn" style="width:100%" '
            'onclick="simulateToMe()">Simulate To My Next Pick</button>',
            markup,
        )
        self.assertLess(markup.index('id="practiceControls"'), markup.index('class="appgrid"'))

    def test_cpu_simulation_stops_at_user_and_refreshes_recommendations(self):
        app_source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertTrue(app_source.rstrip().endswith("init();"))
        app_source = app_source.rstrip()[: -len("init();")]
        harness = r"""
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, {
    id, textContent: '', innerHTML: '', value: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {} }, focus() {}, select() {}
  });
  return nodes.get(id);
}
global.window = {
  addEventListener() {}, FantasyHQCore: null,
  matchMedia() { return { matches: false }; }
};
global.document = {
  getElementById: node,
  querySelectorAll() { return []; },
  querySelector() { return { classList: { add() {}, remove() {} } }; },
  createElement() { return node('created'); }
};
global.navigator = {};
global.requestAnimationFrame = callback => callback();
global.alert = () => {};
"""
        assertions = r"""
(async () => {
  mode = 'practice'; slot = 3; pick = 1; TOTAL_PICKS = 30;
  players = Array.from({length: 30}, (_, index) => ({
    id: index + 1, name: `Player ${index + 1}`, pos: 'WR', team: 'TST',
    overall: index + 1
  }));
  drafted = []; history = []; aiProfiles = {1: 'Balanced', 2: 'Balanced'};
  let recommendationRefreshes = 0;
  renderAfterPick = () => { recommendationRefreshes += 1; };
  renderRoomScan = renderWaitMeter = renderPlayers = renderRoster =
    renderLiveRoster = renderExposure = renderDraftPlan = () => {};
  node('simulateBtn').textContent = 'Simulate To My Next Pick';

  await simulateToMe();
  const afterSimulation = {
    pick, drafted: drafted.length, owner: teamForPick(pick),
    refreshes: recommendationRefreshes, disabled: node('simulateBtn').disabled,
    label: node('simulateBtn').textContent
  };
  const manualWorked = recordCurrentPick(available()[0].id);
  process.stdout.write(JSON.stringify({afterSimulation, manualWorked, finalPick: pick}));
})().catch(error => { console.error(error); process.exit(1); });
"""
        result = subprocess.run(
            [str(NODE), "-e", harness + app_source + assertions],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["afterSimulation"]["pick"], 3)
        self.assertEqual(payload["afterSimulation"]["drafted"], 2)
        self.assertEqual(payload["afterSimulation"]["owner"], 3)
        self.assertEqual(payload["afterSimulation"]["refreshes"], 2)
        self.assertFalse(payload["afterSimulation"]["disabled"])
        self.assertEqual(
            payload["afterSimulation"]["label"], "Simulate To My Next Pick"
        )
        self.assertTrue(payload["manualWorked"])
        self.assertEqual(payload["finalPick"], 4)


if __name__ == "__main__":
    unittest.main()
