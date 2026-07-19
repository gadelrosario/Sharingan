#!/usr/bin/env python3
"""Build the live draft pool from the canonical database.

The existing JSON is an enrichment source, not the population source.  Every
active canonical player at a supported position is emitted even when one or all
ranking sources have no row for that player.  Existing live IDs and Fantasy HQ
analysis fields are retained.  Canonical-only records use a deterministic ID
namespace so later exports cannot renumber them.

The default output is a review artifact.  Promoting it to data/players.json is a
separate, explicit deployment action.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from collections import Counter
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parents[1]
DB_PATH = BASE / "database" / "fantasyhq.db"
LIVE_PATH = BASE / "data" / "players.json"
OUTPUT_PATH = BASE / "outputs" / "player_audit" / "players_review.json"
TEAM_PATCH_PATH = BASE / "data" / "team_patch_2026.csv"
SUPPORTED_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DST"}
CANONICAL_ID_OFFSET = 1_000_000


def normalize_name(name: str) -> str:
    value = (name or "").lower().replace("’", "'").replace("`", "'")
    value = value.replace(".", "").replace("-", " ").replace("'", "")
    value = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", value)
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def identity(name: str, position: str) -> tuple[str, str]:
    return normalize_name(name), (position or "").upper()


def load_canonical_players(db_path: Path) -> list[dict[str, Any]]:
    """Use LEFT JOINs so source coverage can never define the player set."""
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT p.id AS canonical_id, p.canonical_key, p.full_name, p.position,
               p.nfl_team, p.bye_week, p.status,
               MAX(CASE WHEN rs.source_key = 'bdge' THEN er.position_rank END) AS bdge_rank,
               MAX(CASE WHEN rs.source_key = 'bdge' THEN er.tier END) AS bdge_tier,
               MAX(CASE WHEN rs.source_key = 'flock' THEN er.position_rank END) AS flock_rank,
               MAX(CASE WHEN rs.source_key = 'flock' THEN er.tier END) AS flock_tier,
               MAX(CASE WHEN rs2.source_key = 'sleeper' THEN ma.adp END) AS sleeper_adp,
               MAX(CASE WHEN rs2.source_key = 'yahoo' THEN ma.adp END) AS yahoo_adp,
               MAX(CASE WHEN rs2.source_key = 'consensus' THEN ma.adp END) AS consensus_adp,
               hs.hq_grade, hs.expert_agreement, hs.market_value,
               hs.tier_scarcity, hs.wait_probability, hs.upside, hs.risk,
               hs.replacement_value, hs.league_winner_score
          FROM players p
          LEFT JOIN expert_rankings er
            ON er.player_id = p.id AND er.season = 2026
           AND er.scoring_format = 'half_ppr'
          LEFT JOIN ranking_sources rs ON rs.id = er.source_id
          LEFT JOIN market_adp ma
            ON ma.player_id = p.id AND ma.season = 2026
           AND ma.scoring_format = 'half_ppr'
          LEFT JOIN ranking_sources rs2 ON rs2.id = ma.source_id
          LEFT JOIN hq_scores hs
            ON hs.player_id = p.id AND hs.season = 2026
           AND hs.scoring_format = 'half_ppr'
           AND hs.model_version = 'v1-expert-only'
         GROUP BY p.id
         ORDER BY p.id
        """
    ).fetchall()
    connection.close()
    return [dict(row) for row in rows]


def load_live_players(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as source:
        records = json.load(source)
    if not isinstance(records, list):
        raise ValueError(f"{path} must contain a JSON array")
    return records


def load_team_patch(path: Path) -> dict[str, dict[str, Any]]:
    """Load documented patch rows; incomplete provenance is not eligible."""
    patch = {}
    if not path.exists():
        return patch
    with path.open(encoding="utf-8") as source:
        reader = csv.DictReader(source)
        for row in reader:
            canonical_key = row.get("canonical_key", "").strip()
            if canonical_key:
                patch[canonical_key] = {
                    "nfl_team": row.get("nfl_team", "").strip(),
                    "confidence": row.get("confidence", "").strip(),
                    "notes": row.get("notes", "").strip(),
                    "source": str(path),
                }
    return patch


def apply_team_patch(records: list[dict[str, Any]], patch: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Fill blank teams only from rows carrying team, confidence, and notes."""
    resolutions = []
    for record in records:
        canonical_key = record.get("canonicalKey", "")
        team_data = patch.get(canonical_key, {})
        documented = all(team_data.get(key) for key in ("nfl_team", "confidence", "notes", "source"))
        if not record.get("team") and documented:
            record["team"] = team_data["nfl_team"]
            resolutions.append({
                "canonical_key": canonical_key,
                "name": record.get("name"),
                "team": team_data["nfl_team"],
                "confidence": team_data["confidence"],
                "source": team_data["source"],
                "notes": team_data["notes"],
            })
    return resolutions


def is_missing(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def analysis_score(record: dict[str, Any]) -> tuple[int, int, int]:
    """Prefer the identity carrying real analysis, then earlier rank and ID."""
    populated = sum(not is_missing(value) for key, value in record.items()
                    if key not in {"id", "name", "pos", "team"})
    coverage = sum(bool(value) for value in (record.get("sourceCoverage") or {}).values())
    overall = record.get("overall") if isinstance(record.get("overall"), (int, float)) else 10**9
    return populated + coverage, -int(overall), -int(record["id"])


def merge_missing_fields(keeper: dict[str, Any], duplicate: dict[str, Any]) -> list[str]:
    """Copy only non-conflicting information; never overwrite keeper analysis."""
    merged = []
    for key, value in duplicate.items():
        if is_missing(keeper.get(key)) and not is_missing(value) and key not in {"id", "name"}:
            keeper[key] = value
            merged.append(key)
        elif isinstance(keeper.get(key), dict) and isinstance(value, dict):
            for child_key, child_value in value.items():
                if child_key not in keeper[key]:
                    keeper[key][child_key] = child_value
                    merged.append(f"{key}.{child_key}")
    return merged


def reconcile_duplicate_identities(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Collapse normalized identities using analysis richness, not list order."""
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for record in records:
        groups.setdefault(identity(record.get("name", ""), record.get("pos", "")), []).append(record)

    output = []
    resolutions = []
    for key, group in groups.items():
        if len(group) == 1:
            output.append(group[0])
            continue
        keeper = max(group, key=analysis_score)
        merged_fields = []
        removed_ids = []
        for duplicate in group:
            if duplicate is keeper:
                continue
            removed_ids.append(duplicate["id"])
            merged_fields.extend(merge_missing_fields(keeper, duplicate))
        output.append(keeper)
        resolutions.append({
            "identity": f"{key[0]}|{key[1]}",
            "name": keeper.get("name"),
            "preserved_id": keeper["id"],
            "removed_ids": removed_ids,
            "merged_non_conflicting_fields": sorted(set(merged_fields)),
            "reason": "record with the richest rankings/analysis; ties prefer earlier overall rank then lower ID",
        })
    return output, resolutions


def classify_canonical(canonical: list[dict[str, Any]], live: list[dict[str, Any]]) -> list[dict[str, Any]]:
    live_keys = {identity(p.get("name", ""), p.get("pos", "")) for p in live}
    classifications = []
    for player in canonical:
        key = identity(player["full_name"], player["position"])
        if key in live_keys:
            classification, reason = "present", "canonical identity is present"
        elif player["position"] not in SUPPORTED_POSITIONS:
            classification, reason = "unsupported_position", player["position"]
        elif (player.get("status") or "active").lower() != "active":
            classification, reason = "inactive", player.get("status")
        else:
            coverage = [player.get("bdge_rank"), player.get("flock_rank"),
                        player.get("sleeper_adp"), player.get("yahoo_adp"),
                        player.get("consensus_adp")]
            classification = "missing_legitimate_draftable"
            reason = "partial ranking coverage" if any(v is not None for v in coverage) else "no ranking coverage"
        classifications.append({
            "canonical_id": player["canonical_id"],
            "canonical_key": player["canonical_key"],
            "name": player["full_name"],
            "position": player["position"],
            "classification": classification,
            "reason": reason,
        })
    return classifications


def canonical_only_record(player: dict[str, Any]) -> dict[str, Any]:
    """Create a record without synthesizing rankings, tiers, or analysis."""
    return {
        "id": CANONICAL_ID_OFFSET + int(player["canonical_id"]),
        "canonicalId": int(player["canonical_id"]),
        "canonicalKey": player["canonical_key"],
        "overall": None,
        "name": player["full_name"],
        "pos": player["position"],
        "team": player.get("nfl_team"),
        "bye": player.get("bye_week"),
        "overallTier": None,
        "posRank": None,
        "posTier": None,
        "bdgeRank": player.get("bdge_rank"),
        "bdgeTier": player.get("bdge_tier"),
        "flockRank": player.get("flock_rank"),
        "flockTier": player.get("flock_tier"),
        "sleeperAdp": player.get("sleeper_adp"),
        "yahooAdp": player.get("yahoo_adp"),
        "consensusAdp": player.get("consensus_adp"),
        "hqGrade": player.get("hq_grade"),
        "expertAgreement": player.get("expert_agreement"),
        "marketValue": player.get("market_value"),
        "tierScarcity": player.get("tier_scarcity"),
        "waitProbability": player.get("wait_probability"),
        "upside": player.get("upside"),
        "risk": player.get("risk"),
        "replacementValue": player.get("replacement_value"),
        "leagueWinnerScore": player.get("league_winner_score"),
        "sourceCoverage": {
            "bdge": player.get("bdge_rank") is not None,
            "flock": player.get("flock_rank") is not None,
            "sleeper": player.get("sleeper_adp") is not None,
            "yahoo": player.get("yahoo_adp") is not None,
            "consensus": player.get("consensus_adp") is not None,
        },
    }


def generate(db_path: Path = DB_PATH, live_path: Path = LIVE_PATH,
             out_path: Path = OUTPUT_PATH, patch_path: Path = TEAM_PATCH_PATH) -> dict[str, Any]:
    canonical = load_canonical_players(db_path)
    live = load_live_players(live_path)
    classifications = classify_canonical(canonical, live)

    duplicate_ids = [value for value, count in Counter(p.get("id") for p in live).items() if count > 1]
    if duplicate_ids:
        raise ValueError(f"duplicate live IDs: {duplicate_ids}")

    canonical_by_identity = {identity(p["full_name"], p["position"]): p for p in canonical}
    output = []
    matched = set()
    for live_player in live:
        record = dict(live_player)
        key = identity(record.get("name", ""), record.get("pos", ""))
        canonical_player = canonical_by_identity.get(key)
        if canonical_player:
            matched.add(key)
            # Keep the live ID and analysis, but add a durable DB bridge and the
            # canonical display identity (e.g. Travis Etienne Jr.).
            record["canonicalId"] = int(canonical_player["canonical_id"])
            record["canonicalKey"] = canonical_player["canonical_key"]
            record["name"] = canonical_player["full_name"]
        output.append(record)

    included = 0
    excluded = []
    for player in canonical:
        key = identity(player["full_name"], player["position"])
        if key in matched:
            continue
        if player["position"] not in SUPPORTED_POSITIONS or (player.get("status") or "active").lower() != "active":
            excluded.append(next(row for row in classifications if row["canonical_id"] == player["canonical_id"]))
            continue
        output.append(canonical_only_record(player))
        included += 1

    ids = [p["id"] for p in output]
    if len(ids) != len(set(ids)):
        raise ValueError("generated ID collision")

    output, duplicate_resolutions = reconcile_duplicate_identities(output)

    team_patch = load_team_patch(patch_path)
    team_resolutions = apply_team_patch(output, team_patch)

    ids = [record["id"] for record in output]
    if len(ids) != len(set(ids)):
        raise ValueError("generated ID collision after identity reconciliation")

    active_canonical_keys = {
        player["canonical_key"] for player in canonical
        if player["position"] in SUPPORTED_POSITIONS
        and (player.get("status") or "active").lower() == "active"
    }
    emitted_canonical_keys = {record.get("canonicalKey") for record in output}
    unexplained = sorted(active_canonical_keys - emitted_canonical_keys)
    missing_teams = [
        {"canonical_key": record.get("canonicalKey"), "name": record.get("name"),
         "position": record.get("pos"), "team": None}
        for record in output
        if record.get("canonicalKey") in active_canonical_keys and not record.get("team")
    ]
    canonical_missing_teams = [
        {"canonical_id": player["canonical_id"], "canonical_key": player["canonical_key"],
         "name": player["full_name"], "position": player["position"], "team": None}
        for player in canonical
        if player["canonical_key"] in active_canonical_keys and not player.get("nfl_team")
    ]
    position_counts = dict(sorted(Counter(record.get("pos") for record in output).items()))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as destination:
        json.dump(output, destination, indent=2, ensure_ascii=False)
        destination.write("\n")

    missing = [row for row in classifications if row["classification"].startswith("missing_")]
    return {
        "canonical_count": len(canonical),
        "before_count": len(live),
        "after_count": len(output),
        "canonical_missing_before": len(missing),
        "canonical_added": included,
        "unresolved_exclusions": excluded,
        "unexplained_canonical_exclusions": unexplained,
        "position_counts": position_counts,
        "missing_team_players": missing_teams,
        "canonical_missing_team_players": canonical_missing_teams,
        "team_patch_resolutions": team_resolutions,
        "duplicate_resolutions": duplicate_resolutions,
        "classifications": classifications,
        "output": str(out_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=DB_PATH)
    parser.add_argument("--live", type=Path, default=LIVE_PATH)
    parser.add_argument("--out", type=Path, default=OUTPUT_PATH)
    parser.add_argument("--patch", type=Path, default=TEAM_PATCH_PATH)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    summary = generate(args.db, args.live, args.out, args.patch)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in summary.items() if key != "classifications"}, indent=2))


if __name__ == "__main__":
    main()
