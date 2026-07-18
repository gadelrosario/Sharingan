from __future__ import annotations
import argparse
import csv
import re
import sqlite3
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database" / "fantasyhq.db"

def canonical_key(name: str, position: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", name.lower().replace("’", "'")).strip("-")
    return f"{normalized}-{position.lower()}"

def to_float(value: Optional[str]):
    if value is None or str(value).strip() == "":
        return None
    return float(value)

def get_source_id(conn, source_key: str) -> int:
    row = conn.execute("SELECT id FROM ranking_sources WHERE source_key=?", (source_key,)).fetchone()
    if not row:
        raise ValueError(f"Unknown source: {source_key}")
    return row[0]

def upsert_player(conn, row):
    name = row["name"].strip()
    position = row["position"].strip().upper()
    key = canonical_key(name, position)
    conn.execute(
        """INSERT INTO players(canonical_key, full_name, position, nfl_team)
           VALUES(?,?,?,?)
           ON CONFLICT(canonical_key) DO UPDATE SET
             full_name=excluded.full_name,
             nfl_team=COALESCE(excluded.nfl_team, players.nfl_team),
             updated_at=CURRENT_TIMESTAMP""",
        (key, name, position, row.get("team") or None),
    )
    return conn.execute("SELECT id FROM players WHERE canonical_key=?", (key,)).fetchone()[0]

def import_csv(source: str, csv_path: Path):
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA foreign_keys=ON")
    source_id = get_source_id(conn, source)
    inserted = updated = skipped = errors = 0
    run_id = conn.execute(
        "INSERT INTO import_runs(source_key,filename) VALUES(?,?)",
        (source, csv_path.name),
    ).lastrowid
    try:
        with csv_path.open(newline="", encoding="utf-8-sig") as f:
            for line_no, row in enumerate(csv.DictReader(f), start=2):
                try:
                    if not row.get("name") or not row.get("position"):
                        skipped += 1
                        continue
                    player_id = upsert_player(conn, row)
                    season = int(row.get("season") or 2026)
                    scoring = row.get("scoring_format") or "half_ppr"

                    if source in {"bdge", "flock", "fantasyland"}:
                        conn.execute(
                            """INSERT INTO expert_rankings
                               (player_id,source_id,season,scoring_format,overall_rank,position_rank,tier,source_updated_at)
                               VALUES(?,?,?,?,?,?,?,?)
                               ON CONFLICT(player_id,source_id,season,scoring_format) DO UPDATE SET
                                 overall_rank=excluded.overall_rank,
                                 position_rank=excluded.position_rank,
                                 tier=excluded.tier,
                                 source_updated_at=excluded.source_updated_at,
                                 imported_at=CURRENT_TIMESTAMP""",
                            (player_id, source_id, season, scoring,
                             to_float(row.get("overall_rank")), to_float(row.get("position_rank")),
                             row.get("tier") or None, row.get("source_updated_at") or None),
                        )
                        conn.execute(
                            """INSERT INTO projections
                               (player_id,source_id,season,scoring_format,fantasy_points,fantasy_points_per_game,
                                passing_yards,passing_tds,rushing_yards,rushing_tds,targets,receptions,
                                receiving_yards,receiving_tds,source_updated_at)
                               VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                               ON CONFLICT(player_id,source_id,season,scoring_format) DO UPDATE SET
                                fantasy_points=excluded.fantasy_points,
                                fantasy_points_per_game=excluded.fantasy_points_per_game,
                                passing_yards=excluded.passing_yards,
                                passing_tds=excluded.passing_tds,
                                rushing_yards=excluded.rushing_yards,
                                rushing_tds=excluded.rushing_tds,
                                targets=excluded.targets,
                                receptions=excluded.receptions,
                                receiving_yards=excluded.receiving_yards,
                                receiving_tds=excluded.receiving_tds,
                                source_updated_at=excluded.source_updated_at,
                                imported_at=CURRENT_TIMESTAMP""",
                            (player_id, source_id, season, scoring,
                             to_float(row.get("fantasy_points")), to_float(row.get("fantasy_points_per_game")),
                             to_float(row.get("passing_yards")), to_float(row.get("passing_tds")),
                             to_float(row.get("rushing_yards")), to_float(row.get("rushing_tds")),
                             to_float(row.get("targets")), to_float(row.get("receptions")),
                             to_float(row.get("receiving_yards")), to_float(row.get("receiving_tds")),
                             row.get("source_updated_at") or None),
                        )
                        if row.get("season_sos_rank") or row.get("playoff_sos_rank"):
                            conn.execute(
                                """INSERT INTO schedule_context
                                   (player_id,source_id,season,season_sos_rank,playoff_sos_rank,source_updated_at)
                                   VALUES(?,?,?,?,?,?)
                                   ON CONFLICT(player_id,source_id,season) DO UPDATE SET
                                     season_sos_rank=excluded.season_sos_rank,
                                     playoff_sos_rank=excluded.playoff_sos_rank,
                                     source_updated_at=excluded.source_updated_at,
                                     imported_at=CURRENT_TIMESTAMP""",
                                (player_id, source_id, season,
                                 to_float(row.get("season_sos_rank")),
                                 to_float(row.get("playoff_sos_rank")),
                                 row.get("source_updated_at") or None),
                            )
                    else:
                        conn.execute(
                            """INSERT INTO market_adp
                               (player_id,source_id,season,scoring_format,adp,position_adp,sample_size,
                                seven_day_change,source_updated_at)
                               VALUES(?,?,?,?,?,?,?,?,?)
                               ON CONFLICT(player_id,source_id,season,scoring_format) DO UPDATE SET
                                 adp=excluded.adp,
                                 position_adp=excluded.position_adp,
                                 sample_size=excluded.sample_size,
                                 seven_day_change=excluded.seven_day_change,
                                 source_updated_at=excluded.source_updated_at,
                                 imported_at=CURRENT_TIMESTAMP""",
                            (player_id, source_id, season, scoring,
                             to_float(row.get("adp")), to_float(row.get("position_adp")),
                             int(float(row["sample_size"])) if row.get("sample_size") else None,
                             to_float(row.get("seven_day_change")),
                             row.get("source_updated_at") or None),
                        )
                        ext = row.get("external_id")
                        if ext:
                            conn.execute(
                                """INSERT INTO external_ids(player_id,provider,external_id,external_key)
                                   VALUES(?,?,?,?)
                                   ON CONFLICT(player_id,provider) DO UPDATE SET
                                     external_id=excluded.external_id,
                                     external_key=excluded.external_key,
                                     updated_at=CURRENT_TIMESTAMP""",
                                (player_id, source, ext, row.get("external_key") or None),
                            )
                    updated += 1
                except Exception as exc:
                    errors += 1
                    print(f"Line {line_no}: {exc}")
        conn.execute(
            """UPDATE import_runs SET completed_at=CURRENT_TIMESTAMP, inserted_count=?,
               updated_count=?, skipped_count=?, error_count=?, status=?
               WHERE id=?""",
            (inserted, updated, skipped, errors, "completed" if errors == 0 else "completed_with_errors", run_id),
        )
        conn.commit()
    except Exception as exc:
        conn.execute(
            "UPDATE import_runs SET completed_at=CURRENT_TIMESTAMP,status='failed',error_message=? WHERE id=?",
            (str(exc), run_id),
        )
        conn.commit()
        raise
    finally:
        conn.close()
    print(f"Imported {updated} rows; skipped {skipped}; errors {errors}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", choices=["bdge","flock","sleeper","yahoo","consensus","fantasyland"])
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    import_csv(args.source, args.csv_path)
