import json
import pathlib
import subprocess
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class NflverseParticipationContracts(unittest.TestCase):
    def test_participation_contracts(self):
        result = subprocess.run(
            ["node", "tests/nflverse-participation-4-4-10-1-tests.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('"passCount":21', result.stdout)

    def test_retained_artifact_is_bounded_historical_and_non_authoritative(self):
        path = ROOT / "data/season_evidence/nflverse_participation_latest.json"
        artifact = json.loads(path.read_text())
        self.assertLess(path.stat().st_size, 5 * 1024 * 1024)
        self.assertEqual(artifact["recordCount"], 1317)
        self.assertEqual(artifact["weeks"], [16, 17, 18])
        self.assertEqual(artifact["evidenceStatus"], "HISTORICAL_STALE")
        self.assertFalse(artifact["currentActionableEvidence"])
        self.assertFalse(artifact["recommendationAuthority"])
        self.assertFalse(artifact["transactionAuthority"])
        self.assertFalse(artifact["routeDataAvailable"])

    def test_retained_quality_report_has_stable_identity_counts(self):
        report = json.loads(
            (ROOT / "outputs/season_evidence/nflverse_participation_quality_report.json").read_text()
        )
        self.assertEqual(report["recordsReceived"], 1320)
        self.assertEqual(report["recordsAccepted"], 1317)
        self.assertEqual(report["recordsRejected"], 3)
        self.assertEqual(report["playersResolved"], 522)
        self.assertEqual(report["ambiguousIdentities"], 0)
        self.assertEqual(report["reasons"], {"identityUnresolved": 3})

    def test_new_registry_identities_remain_season_only(self):
        registry = json.loads(
            (ROOT / "data/season_evidence/season_player_registry.json").read_text()
        )
        self.assertEqual(len(registry["players"]), 303)
        for player in registry["players"]:
            self.assertFalse(player["draftUniverseMember"])
            self.assertFalse(player["draftEligible"])
            self.assertFalse(player["recommendationEligible"])

    def test_runtime_loads_normalized_artifact_not_raw_provider_data(self):
        source = (ROOT / "js/app.js").read_text()
        self.assertIn("data/season_evidence/nflverse_participation_latest.json", source)
        self.assertNotIn("snap_counts_2025.csv", source)
        self.assertNotIn("github.com/nflverse", source)


if __name__ == "__main__":
    unittest.main()
