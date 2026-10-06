"""Small synthetic fixtures; no downloaded data or Yahoo payloads."""
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path
from api import nba_sportsdataverse as nba


def sample(**changes):
    row = {column: "0" for column in nba.STATS.values()}
    row.update(athlete_id="3112335", athlete_display_name="Sample Player", game_id="401809237",
               game_date="2025-10-23", team_id="7", team_abbreviation="DEN", season="2026",
               season_type="2", did_not_play="false", minutes="25.5", reason="COACH'S DECISION")
    row.update(changes)
    return row


def payload(*rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue().encode()


class SnapshotTests(unittest.TestCase):
    def parse(self, *rows):
        return nba.parse_snapshot(payload(*(rows or (sample(),))), 2026)

    def test_valid_record(self):
        r = self.parse()["records"][0]
        self.assertEqual((r["providerGameId"], r["gameDate"], r["providerTeamId"], r["minutes"]),
                         ("401809237", "2025-10-23", "7", 25.5))

    def test_espn_identity_no_yahoo(self):
        r = self.parse()["records"][0]
        self.assertEqual(r["canonicalPlayerId"], "nba:espn:3112335")
        self.assertEqual(r["provider"], "espn")
        self.assertNotIn("yahoo", json.dumps(r).lower())

    def test_zero_preserved(self):
        self.assertEqual(self.parse()["records"][0]["points"], 0)

    def test_missing_preserved(self):
        for missing in ["", "-", "NaN", "undefined", "null"]:
            with self.subTest(missing=missing):
                self.assertIsNone(self.parse(sample(points=missing))["records"][0]["points"])

    def test_played(self):
        r = self.parse()["records"][0]
        self.assertEqual(r["participationState"], "PLAYED")
        self.assertTrue(r["didPlay"])
        self.assertIsNone(r["dnpReason"])
        self.assertEqual(r["sourceParticipation"]["reason"], "COACH'S DECISION")

    def test_dnp(self):
        r = self.parse(sample(did_not_play="true", minutes="", points=""))["records"][0]
        self.assertEqual(r["participationState"], "DID_NOT_PLAY")
        self.assertFalse(r["didPlay"])
        self.assertIsNone(r["points"])
        self.assertEqual(r["dnpReason"], "COACH'S DECISION")

    def test_unknown(self):
        for minute in ["", "0"]:
            r = self.parse(sample(minutes=minute))["records"][0]
            self.assertEqual(r["participationState"], "UNKNOWN")
            self.assertIsNone(r["didPlay"])

    def test_season_types_preserved(self):
        for kind in ["1", "2", "3", "5"]:
            self.assertEqual(self.parse(sample(season_type=kind))["records"][0]["seasonType"], kind)

    def test_schema_rejected(self):
        row = sample(); del row["steals"]
        with self.assertRaises(nba.SnapshotError): self.parse(row)

    def test_bad_player_identity(self):
        for player in ["", "0", "01", "3112335.0", "nba:yahoo:1"]:
            with self.subTest(player=player), self.assertRaises(nba.SnapshotError):
                self.parse(sample(athlete_id=player))

    def test_bad_game_date_and_team(self):
        for changes in [{"game_id": "x"}, {"game_date": "2026-02-30"}, {"game_date": "2024-10-23"}, {"team_id": ""}]:
            with self.subTest(changes=changes), self.assertRaises(nba.SnapshotError): self.parse(sample(**changes))

    def test_duplicates_rejected(self):
        for second in [sample(), sample(points="1")]:
            with self.assertRaises(nba.SnapshotError): self.parse(sample(), second)

    def test_identity_conflicts_rejected(self):
        with self.assertRaises(nba.SnapshotError):
            self.parse(sample(), sample(game_id="401809238", athlete_display_name="Another Player"))
        with self.assertRaises(nba.SnapshotError):
            self.parse(sample(), sample(athlete_id="123", game_date="2025-10-24"))

    def test_season_mismatch(self):
        with self.assertRaises(nba.SnapshotError): self.parse(sample(season="2025"))
        self.assertIn("player_box_2027.csv", nba.asset_url(2027))

    def test_attribution(self):
        m = self.parse()["metadata"]
        self.assertEqual(m["license"], "CC BY 4.0")
        self.assertEqual(m["source"], "SportsDataverse / hoopR")
        self.assertEqual(m["nbaSeason"], "2025-26")
        self.assertTrue(m["retrievedAt"])
        self.assertEqual(len(m["sha256"]), 64)

    def test_invalid_numeric(self):
        for value in ["infinity", "-1", "bad", "1.2"]:
            with self.subTest(value=value), self.assertRaises(nba.SnapshotError): self.parse(sample(points=value))

    def test_participation_conflict(self):
        with self.assertRaises(nba.SnapshotError): self.parse(sample(did_not_play="true"))
        with self.assertRaises(nba.SnapshotError): self.parse(sample(did_not_play="maybe"))

    def test_empty_and_bad_width(self):
        for data in [payload(sample()).splitlines()[0] + b'\n', payload(sample()) + b'a,b\n']:
            with self.assertRaises(nba.SnapshotError): nba.parse_snapshot(data, 2026)

    def test_failed_refresh_lkg(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "snapshot.json"
            good = nba.refresh(2026, path, lambda _: (payload(sample()), {"ETag": "v1"}))
            def fail(_): raise OSError("offline")
            for fetch in [fail, lambda _: (b"broken", {})]:
                failed = nba.refresh(2026, path, fetch)
                self.assertEqual(failed["snapshot"], good["snapshot"])
                self.assertTrue(failed["refresh"]["stale"])
                self.assertEqual(json.loads(path.read_text()), failed)
            self.assertEqual(good["snapshot"]["metadata"]["etag"], "v1")

    def test_first_failure_no_snapshot(self):
        with tempfile.TemporaryDirectory() as temp:
            r = nba.refresh(2026, Path(temp) / "cache.json", lambda _: (b"", {}))
            self.assertIsNone(r["snapshot"])
            self.assertEqual(r["refresh"]["status"], "FAILED")

    def test_wrong_season_cache_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "cache.json"
            nba.refresh(2026, path, lambda _: (payload(sample()), {}))
            before = path.read_bytes()
            with self.assertRaises(nba.SnapshotError): nba.refresh(2027, path, lambda _: self.fail("must not fetch"))
            self.assertEqual(before, path.read_bytes())

    def test_late_missing_identity_rejects_entire_snapshot(self):
        with self.assertRaisesRegex(nba.SnapshotError, "CSV line 3"):
            self.parse(sample(), sample(athlete_id="", athlete_display_name=""))

    def test_delayed_season_date(self):
        row = sample(season="2020", game_date="2020-10-11")
        self.assertEqual(nba.parse_snapshot(payload(row), 2020)["records"][0]["season"], 2020)

    def test_atomic_write_failure_preserves_existing_cache(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "cache.json"
            nba.refresh(2026, path, lambda _: (payload(sample()), {}))
            before = path.read_bytes()
            with patch.object(nba.os, "replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    nba.refresh(2026, path, lambda _: (payload(sample(points="1")), {}))
            self.assertEqual(before, path.read_bytes())

    def test_byte_limit(self):
        from unittest.mock import patch
        with patch.object(nba, "MAX_BYTES", 1), self.assertRaises(nba.SnapshotError): self.parse()


if __name__ == "__main__":
    unittest.main()


class RejectedIdentityAuditTests(unittest.TestCase):
    def test_named_short_form_cannot_be_quarantined(self):
        row = sample(athlete_id="", athlete_display_name="", athlete_short_name="Olbrich", minutes="", did_not_play="true")
        with self.assertRaises(nba.SnapshotError):
            nba.parse_snapshot(payload(row), 2026)
        result = nba.audit_rows(payload(row), 2026)
        self.assertEqual(result["rejected"], 1)
        self.assertEqual(result["quarantined"], 0)
        self.assertEqual(result["accepted"], 0)
        self.assertEqual(result["failures"][0]["athleteShortName"], "Olbrich")

    def test_diagnostic_accounting_is_not_partial_acceptance(self):
        rows = [sample(athlete_short_name="Sample"), sample(athlete_id="", athlete_display_name="", athlete_short_name="Olbrich")]
        result = nba.audit_rows(payload(*rows), 2026)
        self.assertEqual(result["sourceRows"], result["candidateRows"] + result["rejected"])
        self.assertEqual(result["accepted"], 0)
        self.assertTrue(result["diagnosticOnly"])
        self.assertEqual(len(result["sha256"]), 64)

    def test_nba_bundle_pagination_uses_actual_count(self):
        from api import yahoo_nba as y
        class Fake:
            def __init__(self): self.paths = []
            def get(self, path):
                self.paths.append(path)
                if '/players;start=0' in path: return {"player": [[{"player_key": "478.p.1"}]]}
                return {}
        client = Fake()
        result = y.bundle(client, {"game": {"code": "nba", "game_key": "478"}, "leagueKey": "478.l.1"})
        self.assertEqual(result["universeCount"], 1)
        self.assertTrue(any('start=1;' in p for p in client.paths))
        self.assertEqual(result["rosterStatus"], 'UNRESOLVED_USER_TEAM')

    def test_nba_bundle_rejects_foreign_game(self):
        from api import yahoo_nba as y
        with self.assertRaises(ValueError):
            y.bundle(None, {"game": {"code": "nfl", "game_key": "461"}, "leagueKey": "461.l.1"})
