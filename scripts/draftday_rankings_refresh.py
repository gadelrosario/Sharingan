"""Validate and reconcile immutable, source-specific draft-day ranking snapshots."""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.player_data_audit import normalize_name

EXPECTED_SOURCE = {"Fantasyland": "Flock Fantasy", "Flock": "Flock Fantasy"}
POSITIONS = {"QB", "RB", "WR", "TE"}


def tier_for_engine(value: Any) -> str | None:
    """Map repeated source tier tokens onto the existing single-letter tier domain."""
    token = str(value or "").strip().upper()
    if not token or len(set(token)) != 1 or token[0] not in "SABCDEFGHIJKLMNO":
        return None
    return token[0]


def identity(name: Any, position: Any) -> tuple[str, str]:
    return normalize_name(name), str(position or "").strip().upper()


def validate_source(snapshot: dict[str, Any], manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    source = snapshot.get("source")
    rows = snapshot.get("rows") or []
    expected = (manifest.get("validation") or {}).get(source) or {}
    if source not in EXPECTED_SOURCE:
        errors.append("unsupported creator/source")
    elif snapshot.get("host_platform") != EXPECTED_SOURCE[source]:
        errors.append(f"{source}: host_platform must be {EXPECTED_SOURCE[source]}")
    if snapshot.get("capture_date") != manifest.get("capture_date"):
        errors.append(f"{source}: capture date differs from manifest")
    if snapshot.get("source_snapshot_date") is not None:
        errors.append(f"{source}: source_snapshot_date must remain null")
    expected_count = int(expected.get("row_count") or 0)
    if len(rows) != expected_count:
        errors.append(f"{source}: expected {expected_count} rows, found {len(rows)}")
    ranks = [row.get("overall_rank") for row in rows]
    if ranks != list(range(1, expected_count + 1)):
        errors.append(f"{source}: overall ranks must be contiguous 1-{expected_count}")
    for index, row in enumerate(rows, 1):
        if row.get("creator_source") != source or row.get("host_platform") != EXPECTED_SOURCE.get(source):
            errors.append(f"{source} rank {index}: source provenance mismatch")
        if row.get("capture_date") != snapshot.get("capture_date") or row.get("source_snapshot_date") is not None:
            errors.append(f"{source} rank {index}: date provenance mismatch")
        if not row.get("player") or tier_for_engine(row.get("overall_tier")) is None:
            errors.append(f"{source} rank {index}: malformed identity or overall tier")
        positional_rank = row.get("positional_rank")
        if positional_rank is not None:
            if row.get("position") not in POSITIONS or not isinstance(positional_rank, int) or positional_rank < 1:
                errors.append(f"{source} rank {index}: invalid positional rank")
            if tier_for_engine(row.get("positional_tier")) is None:
                errors.append(f"{source} rank {index}: numbered positional rank lacks a valid positional tier")
    for position in POSITIONS:
        numbered = [row["positional_rank"] for row in rows if row.get("position") == position and row.get("positional_rank") is not None]
        if len(numbered) != len(set(numbered)):
            errors.append(f"{source}: duplicate numbered {position} positional rank")
    return errors


def alias_map(players: list[dict[str, Any]], reviewed_aliases: list[dict[str, Any]],
              historical_aliases: list[dict[str, Any]]) -> dict[tuple[str, str], tuple[str, str]]:
    aliases: dict[tuple[str, str], tuple[str, str]] = {}
    for player in players:
        target = identity(player.get("name"), player.get("pos"))
        for alias in player.get("identityAliases") or []:
            aliases[identity(alias, player.get("pos"))] = target
    for row in historical_aliases:
        aliases[identity(row.get("sourceName"), row.get("position"))] = identity(row.get("canonicalName"), row.get("position"))
    for row in reviewed_aliases:
        aliases[identity(row.get("sourceName"), row.get("position"))] = identity(row.get("canonicalName"), row.get("position"))
    return aliases


def reconcile(snapshot: dict[str, Any], players: list[dict[str, Any]], aliases: dict[tuple[str, str], tuple[str, str]]) -> tuple[dict[str, Any], dict[str, Any]]:
    source = snapshot["source"]
    canonical: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for player in players:
        canonical.setdefault(identity(player.get("name"), player.get("pos")), []).append(player)
    claimed: dict[str, int] = {}
    records: list[dict[str, Any]] = []
    reasons: Counter[str] = Counter()
    mappings: list[dict[str, Any]] = []
    for row in snapshot["rows"]:
        source_identity = identity(row.get("player"), row.get("position"))
        canonical_identity = aliases.get(source_identity, source_identity)
        candidates = canonical.get(canonical_identity) or []
        player = candidates[0] if len(candidates) == 1 else None
        status, reason = "MATCHED", None
        player_id = str(player["id"]) if player else None
        if not player:
            status, reason = "UNMATCHED", "no unique canonical identity"
        elif player_id in claimed:
            status, reason = "QUARANTINED", f"canonical player already claimed by source rank {claimed[player_id]}"
            player_id = None
        else:
            claimed[player_id] = row["overall_rank"]
        if reason:
            reasons[reason] += 1
        if player and canonical_identity != source_identity and status == "MATCHED":
            mappings.append({"sourceName": row["player"], "canonicalName": player["name"], "playerId": player_id, "position": player["pos"]})
        records.append({
            "sourceRecordId": f"{source.lower()}:{row['overall_rank']}",
            "playerId": player_id,
            "canonicalKey": player.get("canonicalKey") if player and status == "MATCHED" else None,
            "canonicalPlayerName": player.get("name") if player and status == "MATCHED" else None,
            "sourcePlayerName": row.get("player"),
            "sourceTeam": row.get("team"),
            "position": row.get("position"),
            "overallRank": row.get("overall_rank"),
            "overallTier": row.get("overall_tier"),
            "decisionOverallTier": tier_for_engine(row.get("overall_tier")),
            "positionRank": row.get("positional_rank"),
            "positionTier": row.get("positional_tier"),
            "decisionPositionTier": tier_for_engine(row.get("positional_tier")),
            "creatorSource": row.get("creator_source"),
            "hostPlatform": row.get("host_platform"),
            "captureDate": row.get("capture_date"),
            "sourceSnapshotDate": row.get("source_snapshot_date"),
            "importStatus": status,
            "importReason": reason,
            "provenance": {"sourceFile": f"data/sources/{source.lower()}_draftday_2026-08-23.json", "sourceOverallRank": row.get("overall_rank")},
        })
    normalized = {
        "schemaVersion": "2.0",
        "snapshotId": f"{source.lower()}-draftday-2026-08-23",
        "season": 2026,
        "source": source,
        "hostPlatform": snapshot["host_platform"],
        "captureDate": snapshot["capture_date"],
        "sourceSnapshotDate": snapshot["source_snapshot_date"],
        "rankingScope": "overall-and-position",
        "immutable": True,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "records": records,
    }
    matched = [row for row in records if row["importStatus"] == "MATCHED"]
    unresolved = [row for row in records if row["importStatus"] != "MATCHED"]
    report = {
        "source": source,
        "sourceRows": len(records),
        "matchedRows": len(matched),
        "unresolvedRows": len(unresolved),
        "unresolvedTop180": sum(row["overallRank"] <= 180 for row in unresolved),
        "duplicateActivePlayerIds": len(matched) - len({row["playerId"] for row in matched}),
        "reasonCounts": dict(sorted(reasons.items())),
        "reviewedAliasMappings": mappings,
        "unresolved": [{key: row[key] for key in ("overallRank", "sourcePlayerName", "position", "importStatus", "importReason")} for row in unresolved],
    }
    return normalized, report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--fantasyland", type=Path, required=True)
    parser.add_argument("--flock", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "data" / "rankings")
    parser.add_argument("--report", type=Path, default=ROOT / "outputs" / "player_audit" / "draftday_rankings_refresh_2026-08-23.json")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    sources = [json.loads(args.fantasyland.read_text(encoding="utf-8")), json.loads(args.flock.read_text(encoding="utf-8"))]
    players = json.loads((ROOT / "data" / "players.json").read_text(encoding="utf-8"))
    reviewed = json.loads((ROOT / "data" / "rankings" / "draftday_identity_aliases_2026-08-23.json").read_text(encoding="utf-8"))
    historical = json.loads((ROOT / "data" / "fantasyland_identity_review_2026-08-08.json").read_text(encoding="utf-8"))
    aliases = alias_map(players, reviewed, historical)
    validation = {source["source"]: validate_source(source, manifest) for source in sources}
    report: dict[str, Any] = {"snapshotId": "2026-draftday-2026-08-23", "captureDate": manifest.get("capture_date"), "validationErrors": validation, "sources": {}}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    if any(validation.values()):
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 1
    for source in sources:
        normalized, source_report = reconcile(source, players, aliases)
        filename = f"{source['source'].lower()}_draftday_2026-08-23.normalized.json"
        (args.output_dir / filename).write_text(json.dumps(normalized, indent=2) + "\n", encoding="utf-8")
        report["sources"][source["source"]] = source_report
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"snapshotId": report["snapshotId"], "sources": {key: {field: value for field, value in item.items() if field != "unresolved"} for key, item in report["sources"].items()}}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
