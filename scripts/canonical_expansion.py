"""Fixture-friendly canonical-expansion classification and import tooling."""
from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
from collections import Counter
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable

from scripts import import_csv
from scripts.player_data_audit import CANONICAL_POSITIONS, normalize_name, stable_identity

CANDIDATE_FIELDS = (
    "live_player_id", "proposed_canonical_id", "canonical_name", "position",
    "nfl_team", "source", "confidence", "classification",
)


def classify_live_only(master_records: Iterable[dict[str, Any]], live_records: Iterable[dict[str, Any]]):
    master = list(master_records)
    master_names = {normalize_name(row.get("name") or row.get("canonical_full_name")): row for row in master}
    results = []
    for live in live_records:
        name = live.get("name") or live.get("canonical_full_name") or ""
        position = str(live.get("position") or live.get("pos") or "").upper()
        team = live.get("team") or live.get("nfl_team") or ""
        normalized = normalize_name(name)
        if normalized in master_names:
            classification, confidence, reason = "duplicate", 0.95, "normalized name matches canonical record"
        elif position not in CANONICAL_POSITIONS or not team:
            classification, confidence, reason = "unsupported", 0.8, "missing team or unsupported position"
        elif not normalized or normalized.startswith(("unknown", "test")):
            classification, confidence, reason = "manual_review", 0.3, "placeholder or malformed identity"
        else:
            classification, confidence, reason = "candidate", 0.7, "valid position/team with no canonical match"
        results.append({
            "live_player_id": stable_identity(live) or "", "name": name, "position": position,
            "team": team, "classification": classification, "confidence": confidence, "reason": reason,
        })
    return results


def build_candidates(classified: Iterable[dict[str, Any]], existing_keys: Iterable[str]):
    occupied = set(existing_keys)
    candidates = []
    for row in classified:
        if row["classification"] != "candidate":
            continue
        base = import_csv.canonical_key(row["name"], row["position"])
        key, suffix = base, 1
        while key in occupied:
            key, suffix = f"{base}-{suffix}", suffix + 1
        occupied.add(key)
        candidates.append({
            "live_player_id": row["live_player_id"], "proposed_canonical_id": key,
            "canonical_name": row["name"], "position": row["position"], "nfl_team": row["team"],
            "source": "live_fixture", "confidence": str(row["confidence"]), "classification": "candidate",
        })
    return candidates


def load_candidates(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as source:
        return list(csv.DictReader(source))


def validate_candidates(connection: sqlite3.Connection, rows: list[dict[str, str]], expected: int | None = None):
    errors = []
    if expected is not None and len(rows) != expected:
        errors.append(f"expected {expected} candidates, found {len(rows)}")
    keys = [row.get("proposed_canonical_id", "") for row in rows]
    duplicate_keys = sorted(key for key, count in Counter(keys).items() if key and count > 1)
    if duplicate_keys:
        errors.append(f"duplicate candidate keys: {duplicate_keys}")
    existing_keys = {row[0] for row in connection.execute("SELECT canonical_key FROM players")}
    existing_identities = {
        (normalize_name(row[0]), row[1].upper()) for row in connection.execute("SELECT full_name, position FROM players")
    }
    for index, row in enumerate(rows, start=2):
        key, name = row.get("proposed_canonical_id", "").strip(), row.get("canonical_name", "").strip()
        position, team = row.get("position", "").strip().upper(), row.get("nfl_team", "").strip()
        if not key or not name or position not in CANONICAL_POSITIONS or not team:
            errors.append(f"row {index}: missing or invalid required field")
        if key in existing_keys:
            errors.append(f"row {index}: canonical key already exists: {key}")
        if (normalize_name(name), position) in existing_identities:
            errors.append(f"row {index}: canonical identity already exists: {name}|{position}")
    return errors


def import_candidates(db_path: Path, candidate_path: Path, *, expected: int | None = None, apply: bool = False):
    rows = load_candidates(candidate_path)
    with closing(sqlite3.connect(db_path)) as connection:
        errors = validate_candidates(connection, rows, expected)
        if errors:
            return {"status": "invalid", "inserted": 0, "errors": errors}
        if not apply:
            return {"status": "dry-run", "inserted": 0, "errors": []}
        inserted = 0
        try:
            connection.execute("BEGIN")
            for row in rows:
                name = row["canonical_name"].strip()
                parts = name.split()
                connection.execute(
                    "INSERT INTO players(canonical_key,full_name,first_name,last_name,position,nfl_team) VALUES(?,?,?,?,?,?)",
                    (row["proposed_canonical_id"].strip(), name, parts[0], parts[-1] if len(parts) > 1 else None,
                     row["position"].strip().upper(), row["nfl_team"].strip()),
                )
                inserted += 1
            connection.commit()
        except Exception:
            connection.rollback()
            raise
    return {"status": "applied", "inserted": inserted, "errors": []}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", type=Path, required=True)
    parser.add_argument("--candidates", type=Path, required=True)
    parser.add_argument("--expected", type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    result = import_candidates(args.db_path, args.candidates, expected=args.expected, apply=args.apply)
    print(result)
    return 2 if result["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
