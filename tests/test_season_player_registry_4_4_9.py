import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class SeasonPlayerRegistry449Tests(unittest.TestCase):
    def run_node(self, script):
        completed = subprocess.run(["node", script], cwd=ROOT, text=True, capture_output=True, check=False)
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)
        return completed.stdout

    def test_registry_deterministic_contracts(self):
        output = self.run_node("tests/season-player-registry-4-4-9-tests.js")
        report = json.loads(output.strip().splitlines()[-1])
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["passCount"], 32)
        self.assertEqual(report["draftContamination"], 0)
        self.assertFalse(report["recommendationAuthority"])

    def test_browser_registry_is_season_scoped(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("seasonPlayerRegistry.evidencePlayers()", source)
        self.assertIn("players:[...players,...registryPlayers]", source)
        self.assertNotIn("players.push(...seasonPlayerRegistry", source)
        self.assertNotIn("players=players.concat(seasonPlayerRegistry", source)

    def test_draft_search_and_recommendations_still_use_draft_players(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("function available() {\n  return players.filter", source)
        self.assertIn("const availablePlayers=available()", source)
        self.assertNotIn("seasonPlayerRegistry.evidencePlayers().filter(recommendationEligible", source)

    def test_registry_artifact_is_profile_independent_and_shadow_only(self):
        artifact = json.loads((ROOT / "data" / "season_evidence" / "season_player_registry.json").read_text(encoding="utf-8"))
        self.assertEqual(artifact["schemaVersion"], "fantasy-hq-season-player-registry-1")
        self.assertTrue(artifact["profileIndependent"])
        self.assertFalse(artifact["recommendationAuthority"])
        self.assertFalse(artifact["draftAuthority"])
        self.assertTrue(all(not player["draftUniverseMember"] and player["seasonUniverseMember"] for player in artifact["players"]))

    def test_quality_report_contains_registry_metrics(self):
        report = json.loads((ROOT / "outputs" / "season_evidence" / "nflverse_quality_report.json").read_text(encoding="utf-8"))
        for key in ("existingCanonicalMatches", "existingSeasonRegistryMatches", "newSeasonIdentitiesCreated", "autoVerifiedIdentities", "reviewRequiredIdentities", "quarantinedIdentities", "unsupportedPositions", "registryCollisions", "evidenceAcceptedAfterRegistration", "newSeasonIdentitiesByPosition"):
            self.assertIn(key, report)

    def test_demo_path_never_loads_registry(self):
        source = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        demo_segment = source.split("const [evidenceResponse,intelligenceResponse,discoveryResponse]", 1)[1].split("function seasonStateForActiveProfile", 1)[0]
        self.assertIn("seasonPlayerRegistry=null", demo_segment)

    def test_registry_module_precedes_adapter_and_app(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertLess(html.index("js/season-player-registry-v1.js"), html.index("js/nflverse-evidence-adapter-v1.js"))
        self.assertLess(html.index("js/season-player-registry-v1.js"), html.index("js/app.js"))


if __name__ == "__main__":
    unittest.main()
