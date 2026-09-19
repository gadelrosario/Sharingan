import json
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NODE = shutil.which("node")


class SeasonLiveIntelligenceRepairTests(unittest.TestCase):
    @unittest.skipUnless(NODE, "node is required")
    def test_deterministic_contracts(self):
        result = subprocess.run(
            [NODE, "tests/season-live-intelligence-repair-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["passCount"], 12)
        self.assertEqual(payload["failCount"], 0)

    def test_bridge_binds_scoreboard_to_current_week(self):
        source = (ROOT / "api/yahoo_auth_bridge.py").read_text(encoding="utf-8")
        self.assertIn('scoreboard_resource += f";week={current_week}"', source)
        self.assertIn('payload["matchups"] = self.get(scoreboard_resource)', source)

    def test_rendering_keeps_yahoo_matchup_primary_and_filters_filler(self):
        source = (ROOT / "js/app.js").read_text(encoding="utf-8")
        self.assertIn("wrap.append(yahoo, seasonMatchupIntelligenceSurface(model, { full: true }))", source)
        self.assertIn("No meaningful new league signals", source)
        self.assertIn("seasonYahooPlayerForId(model, result.playerId)", source)


if __name__ == "__main__":
    unittest.main()
