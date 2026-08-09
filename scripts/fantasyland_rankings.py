"""Safe Fantasyland snapshot reconciliation for the browser player pool.

Source team labels are retained as provenance and never replace canonical teams.
The importer updates existing stable players only; unmatched rows are reported.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.player_data_audit import normalize_name, normalize_team

BASE = Path(__file__).resolve().parents[1]
IDENTITY_REVIEW_PATH = BASE / "data" / "fantasyland_identity_review_2026-08-08.json"
TEAM_REVIEW_PATH = BASE / "data" / "verified_team_assignments_2026-08-08.json"
QUARANTINE_PATH = BASE / "data" / "fantasyland_source_quarantine_2026-08-08.json"


def load_reviews(identity_path: Path = IDENTITY_REVIEW_PATH,
                 team_path: Path = TEAM_REVIEW_PATH,
                 quarantine_path: Path = QUARANTINE_PATH) -> tuple[dict, dict, set]:
    identity_rows = json.loads(identity_path.read_text(encoding="utf-8")) if identity_path.exists() else []
    team_rows = json.loads(team_path.read_text(encoding="utf-8")) if team_path.exists() else []
    quarantine_rows = json.loads(quarantine_path.read_text(encoding="utf-8")) if quarantine_path.exists() else []
    aliases, quarantined = {}, set()
    for row in identity_rows:
        key = identity(row["sourceName"], row["position"])
        aliases[key] = normalize_name(row["canonicalName"])
    for row in quarantine_rows:
        key = identity(row["sourceName"], row["position"])
        quarantined.add((int(row["overallRank"]), *key))
    teams = {identity(row["canonicalName"], row["position"]): row for row in team_rows}
    for row in identity_rows:
        teams.setdefault(identity(row["canonicalName"], row["position"]), {
            "verifiedTeam": row["verifiedTeam"], "verifiedAt": "2026-08-08",
            "sourceUrl": row["sourceUrl"],
        })
    return aliases, teams, quarantined


def identity(name: Any, position: Any) -> tuple[str, str]:
    return normalize_name(name), str(position or "").upper().replace("D/ST", "DST")


def validate_snapshot(snapshot: dict[str, Any]) -> list[str]:
    errors = []
    records = snapshot.get("records") or []
    if snapshot.get("source") != "Fantasyland":
        errors.append("source must be Fantasyland")
    if snapshot.get("hostPlatform") != "Flock Fantasy":
        errors.append("hostPlatform must be Flock Fantasy")
    if snapshot.get("snapshotDate") != "2026-08-08":
        errors.append("unexpected snapshot date")
    ranks = [row.get("overallRank") for row in records]
    if len(records) != 242 or ranks != list(range(1, 243)):
        errors.append("snapshot must contain contiguous overall ranks 1-242")
    return errors


def reconcile(players: list[dict[str, Any]], snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    errors = validate_snapshot(snapshot)
    if errors:
        raise ValueError("; ".join(errors))
    by_identity: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for player in players:
        by_identity.setdefault(identity(player.get("name"), player.get("pos")), []).append(player)
    duplicate_players = [
        {"identity": list(key), "stableIds": [row.get("id") for row in rows]}
        for key, rows in by_identity.items() if len(rows) > 1
    ]
    aliases, verified_teams, quarantined_keys = load_reviews()
    source_counts = Counter(identity(row.get("playerName"), row.get("position")) for row in snapshot["records"])
    duplicate_source = [list(key) for key, count in source_counts.items() if count > 1]
    matched, unmatched, repaired, team_mismatches, verified_team_disagreements, position_mismatches, quarantined = [], [], [], [], [], [], []
    claimed = set()
    for row in snapshot["records"]:
        source_key = identity(row.get("playerName"), row.get("position"))
        quarantine_key = (int(row["overallRank"]), *source_key)
        if quarantine_key in quarantined_keys:
            quarantined.append({**row, "reason": "reviewed source transcription/duplicate record; canonical player preserved"})
            continue
        canonical_key = source_key
        alias_target = aliases.get(source_key)
        if alias_target:
            canonical_key = (alias_target, source_key[1])
        candidates = by_identity.get(canonical_key, [])
        if len(candidates) != 1 or (source_key in duplicate_source and not alias_target):
            unmatched.append({**row, "reason": "ambiguous source identity" if source_key in duplicate_source else "no unique canonical identity"})
            continue
        player = candidates[0]
        if player.get("id") in claimed:
            unmatched.append({**row, "reason": "canonical player already claimed by another source row"})
            continue
        claimed.add(player.get("id"))
        if alias_target:
            repaired.append({"sourceName": row["playerName"], "canonicalName": player["name"], "stableId": player["id"], "method": "reviewed_alias"})
        source_position = source_key[1]
        if source_position != str(player.get("pos") or "").upper():
            position_mismatches.append({"stableId": player["id"], "canonicalName": player["name"], "canonicalPosition": player.get("pos"), "sourcePosition": row.get("position")})
            unmatched.append({**row, "reason": "position mismatch"})
            continue
        team_review = verified_teams.get(canonical_key)
        if team_review:
            player["team"] = team_review["verifiedTeam"]
            player["teamVerifiedAt"] = team_review["verifiedAt"]
            player["teamVerificationSource"] = team_review["sourceUrl"]
        source_team, canonical_team = normalize_team(row.get("sourceTeam")), normalize_team(player.get("team"))
        if source_team and canonical_team and source_team != canonical_team:
            disagreement = {"stableId": player["id"], "canonicalName": player["name"], "canonicalTeam": player.get("team"), "sourceTeam": row.get("sourceTeam")}
            if team_review:
                disagreement.update({"verificationStatus": "independently verified", "verificationSource": team_review["sourceUrl"]})
                verified_team_disagreements.append(disagreement)
            else:
                disagreement["verificationStatus"] = "requires independent review"
                team_mismatches.append(disagreement)
        player.update({
            "overall": row["overallRank"], "overallTier": row["overallTier"],
            "posRank": row["positionRank"], "posTier": row["positionTier"],
            "fantasylandOverallRank": row["overallRank"],
            "fantasylandOverallTier": row["overallTier"],
            "fantasylandPositionRank": row["positionRank"],
            "fantasylandPositionTier": row["positionTier"],
            "fantasylandSourceTeam": row.get("sourceTeam"),
            "fantasylandSource": "Fantasyland", "fantasylandHostPlatform": "Flock Fantasy",
            "fantasylandSnapshotDate": snapshot["snapshotDate"],
            "fantasylandProvenance": snapshot.get("provenanceNote"),
        })
        matched.append({"stableId": player["id"], "canonicalName": player["name"], "sourceName": row["playerName"], "overallRank": row["overallRank"]})
    report = {
        "source": snapshot["source"], "hostPlatform": snapshot["hostPlatform"],
        "snapshotDate": snapshot["snapshotDate"], "sourceRows": len(snapshot["records"]),
        "activeSourceRows": len(snapshot["records"]) - len(quarantined), "quarantinedRows": quarantined,
        "canonicalPoolSize": len(players), "matchedRows": len(matched), "unmatchedRows": unmatched,
        "duplicateCanonicalIdentities": duplicate_players, "duplicateSourceIdentities": duplicate_source,
        "teamMismatches": team_mismatches, "verifiedTeamDisagreements": verified_team_disagreements,
        "positionMismatches": position_mismatches,
        "repairedMappings": repaired,
    }
    return players, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--players", type=Path, default=Path("data/players.json"))
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    with args.players.open(encoding="utf-8") as source:
        players = json.load(source)
    with args.snapshot.open(encoding="utf-8") as source:
        snapshot = json.load(source)
    updated, report = reconcile(players, snapshot)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(updated, indent=2) + "\n", encoding="utf-8")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key not in {"unmatchedRows", "teamMismatches", "repairedMappings"}}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
