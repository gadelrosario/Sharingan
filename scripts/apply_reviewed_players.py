"""Apply independently reviewed canonical additions without changing existing IDs."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def apply(db_path: Path, additions_path: Path, *, commit: bool = False) -> dict:
    additions = json.loads(additions_path.read_text(encoding="utf-8"))
    connection = sqlite3.connect(db_path)
    try:
        before = connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        inserted, existing, team_updates, skipped = [], [], [], []
        connection.execute("BEGIN")
        for row in additions:
            canonical_key = row.get("canonicalKey")
            if canonical_key:
                found = connection.execute("SELECT id,full_name,position,nfl_team FROM players WHERE canonical_key=?", (canonical_key,)).fetchone()
            else:
                found = connection.execute("SELECT id,full_name,position,nfl_team FROM players WHERE lower(full_name)=lower(?) AND position=?", (row["canonicalName"], row["position"])).fetchone()
                if not found:
                    skipped.append({"canonicalName": row["canonicalName"], "position": row["position"], "reason": "live-only identity; no canonical database row"})
                    continue
                canonical_key = connection.execute("SELECT canonical_key FROM players WHERE id=?", (found[0],)).fetchone()[0]
            if found:
                existing.append({"canonicalKey": canonical_key, "id": found[0]})
                if row.get("verifiedTeam") and found[3] != row["verifiedTeam"]:
                    connection.execute("UPDATE players SET nfl_team=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (row["verifiedTeam"], found[0]))
                    team_updates.append({"canonicalKey": canonical_key, "id": found[0], "from": found[3], "to": row["verifiedTeam"]})
                continue
            name = row["canonicalName"].split()
            cursor = connection.execute(
                "INSERT INTO players(canonical_key,full_name,first_name,last_name,position,nfl_team,status) VALUES(?,?,?,?,?,?,?)",
                (row["canonicalKey"], row["canonicalName"], name[0], name[-1], row["position"], row["verifiedTeam"], "active"),
            )
            inserted.append({"canonicalKey": row["canonicalKey"], "id": cursor.lastrowid})
        after = connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        if commit:
            connection.commit()
        else:
            connection.rollback()
            after = before
        return {"status": "applied" if commit else "dry-run", "before": before, "after": after, "inserted": inserted, "existing": existing, "teamUpdates": team_updates, "skipped": skipped}
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("database/fantasyhq.db"))
    parser.add_argument("--additions", type=Path, default=Path("data/reviewed_player_additions_2026-08-08.json"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print(json.dumps(apply(args.db, args.additions, commit=args.apply), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
