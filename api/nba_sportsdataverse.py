"""One-season SportsDataverse evidence snapshots; no fantasy identity joins."""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import os
import re
import tempfile
import unicodedata
import urllib.request
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

SOURCE = "SportsDataverse / hoopR"
DATASET = "https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/espn_nba_player_boxscores"
LICENSE_SOURCE = "https://github.com/sportsdataverse/hoopR-nba-data/blob/main/LICENSE.md"
VERSION = 1
MAX_BYTES = 40 * 1024 * 1024
MAX_ROWS = 100000
STATS = {
    "minutes": "minutes", "points": "points", "rebounds": "rebounds",
    "assists": "assists", "steals": "steals", "blocks": "blocks",
    "turnovers": "turnovers", "threePointersMade": "three_point_field_goals_made",
    "fieldGoalsMade": "field_goals_made", "fieldGoalsAttempted": "field_goals_attempted",
    "freeThrowsMade": "free_throws_made", "freeThrowsAttempted": "free_throws_attempted",
}
REQUIRED = set(STATS.values()) | {
    "athlete_id", "athlete_display_name", "game_id", "game_date", "team_id",
    "team_abbreviation", "season", "season_type", "did_not_play",
}
MISSING = {"", "-", "nan", "null", "none", "undefined", "na", "n/a"}


class SnapshotError(ValueError):
    pass


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def season_year(value):
    if not re.fullmatch(r"[0-9]{4}", str(value)) or not 2002 <= int(value) <= 2100:
        raise SnapshotError("Invalid SportsDataverse season ending year")
    return int(value)


def asset_url(season):
    return DATASET.replace("/tag/", "/download/") + f"/player_box_{season_year(season)}.csv"


def text(value):
    return str(value or "").strip()


def identifier(value):
    value = text(value)
    if not re.fullmatch(r"[1-9][0-9]*", value):
        raise SnapshotError("Invalid provider identity")
    return value


def number(value, integer=False):
    value = text(value)
    if value.lower() in MISSING:
        return None
    try:
        n = float(value)
    except ValueError as exc:
        raise SnapshotError("Malformed numeric value") from exc
    if not math.isfinite(n) or n < 0 or (integer and not n.is_integer()):
        raise SnapshotError("Unsafe numeric value")
    return int(n) if integer else n


def boolean(value):
    value = text(value).lower()
    if value in MISSING:
        return None
    if value not in {"true", "false"}:
        raise SnapshotError("Invalid participation flag")
    return value == "true"


def normalize(row, season):
    player, game, team = (identifier(row[k]) for k in ("athlete_id", "game_id", "team_id"))
    name, abbreviation = text(row["athlete_display_name"]), text(row["team_abbreviation"])
    if not name or not abbreviation:
        raise SnapshotError("Missing player/team metadata")
    if text(row["season"]) != str(season):
        raise SnapshotError("Season mismatch")
    day = text(row["game_date"])
    try:
        parsed = date.fromisoformat(day)
    except ValueError as exc:
        raise SnapshotError("Invalid game date") from exc
    if parsed.isoformat() != day or not date(season - 1, 7, 1) <= parsed <= date(season, 12, 31):
        raise SnapshotError("Game date outside requested NBA season")
    kind = identifier(row["season_type"])  # Keep source codes; do not invent play-in taxonomy.
    stats = {key: number(row[column], key != "minutes") for key, column in STATS.items()}
    for made, attempted in [("fieldGoalsMade", "fieldGoalsAttempted"), ("freeThrowsMade", "freeThrowsAttempted")]:
        if stats[made] is not None and stats[attempted] is not None and stats[made] > stats[attempted]:
            raise SnapshotError("Made shots exceed attempts")
    dnp = boolean(row["did_not_play"])
    minutes = stats["minutes"]
    if dnp is True and minutes is not None and minutes > 0:
        raise SnapshotError("Conflicting participation evidence")
    state = "DID_NOT_PLAY" if dnp is True else "PLAYED" if minutes is not None and minutes > 0 else "UNKNOWN"
    return {
        "provider": "espn", "providerPlayerId": player, "canonicalPlayerId": f"nba:espn:{player}",
        "playerName": name, "providerGameId": game, "gameDate": day,
        "providerTeamId": team, "teamAbbreviation": abbreviation,
        "season": season, "seasonType": kind, **stats,
        "participationState": state, "didPlay": {"PLAYED": True, "DID_NOT_PLAY": False, "UNKNOWN": None}[state],
        "dnpReason": (text(row.get("reason")) or None) if state == "DID_NOT_PLAY" else None,
        "sourceParticipation": {"didNotPlay": dnp, "reason": text(row.get("reason")) or None,
                                "active": text(row.get("active")) or None},
    }


def parse_snapshot(payload, season, headers=None, retrieved_at=None):
    season = season_year(season)
    if len(payload) > MAX_BYTES:
        raise SnapshotError("Snapshot exceeds byte limit")
    try:
        reader = csv.DictReader(io.StringIO(payload.decode("utf-8-sig")), strict=True)
        fields = reader.fieldnames or []
        if len(fields) != len(set(fields)) or not REQUIRED.issubset(fields):
            raise SnapshotError("Missing or duplicate required schema columns")
        records, keys, names, games = [], set(), {}, {}
        for line, row in enumerate(reader, 2):
            if None in row or any(v is None for v in row.values()):
                raise SnapshotError("Malformed CSV row width")
            try:
                record = normalize(row, season)
            except SnapshotError as exc:
                raise SnapshotError(f"CSV line {line}: {exc}") from exc
            key = (record["providerGameId"], record["providerPlayerId"])
            if key in keys:
                raise SnapshotError("Duplicate player-game key (including identical duplicates)")
            keys.add(key)
            name = unicodedata.normalize("NFKD", record["playerName"]).casefold()
            name = "".join(c for c in name if not unicodedata.combining(c))
            pid = record["providerPlayerId"]
            if pid in names and names[pid] != name:
                raise SnapshotError("Conflicting names for one ESPN identity")
            names[pid] = name
            game_context = (record["gameDate"], record["seasonType"])
            gid = record["providerGameId"]
            if gid in games and games[gid] != game_context:
                raise SnapshotError("Conflicting game identity")
            games[gid] = game_context
            records.append(record)
            if len(records) > MAX_ROWS:
                raise SnapshotError("Snapshot exceeds row limit")
        if not records:
            raise SnapshotError("Empty snapshot")
    except (UnicodeError, csv.Error) as exc:
        raise SnapshotError("Invalid CSV encoding or structure") from exc
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    return {"metadata": {
        "source": SOURCE, "datasetUrl": DATASET, "assetUrl": asset_url(season), "format": "csv",
        "sportsDataverseSeasonEndingYear": season, "nbaSeason": f"{season-1}-{str(season)[2:]}",
        "retrievedAt": retrieved_at or timestamp(), "etag": headers.get("etag"),
        "lastModified": headers.get("last-modified"), "sha256": hashlib.sha256(payload).hexdigest(),
        "downloadedBytes": len(payload), "recordCount": len(records),
        "latestGameDate": max(r["gameDate"] for r in records),
        "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "licenseDeclarationUrl": LICENSE_SOURCE, "attribution": SOURCE,
        "transformationVersion": VERSION, "transformation": "Selected fields; typed values; ESPN identity; participation classification",
    }, "records": records}


def audit_rows(payload, season):
    """Diagnostic accounting only. Never returns a partially accepted snapshot."""
    season = season_year(season)
    rows = list(csv.DictReader(io.StringIO(payload.decode("utf-8-sig"))))
    rejected, candidates = [], []
    for line, row in enumerate(rows, 2):
        try:
            candidates.append(normalize(row, season))
        except (SnapshotError, KeyError) as exc:
            rejected.append({"line": line, "gameId": row.get("game_id"),
                             "team": row.get("team_abbreviation"),
                             "athleteShortName": row.get("athlete_short_name"),
                             "reason": str(exc), "classification": "POSSIBLE_PLAYER_RECORD"})
    return {"sourceRows": len(rows), "accepted": 0 if rejected else len(candidates),
            "candidateRows": len(candidates), "quarantined": 0, "rejected": len(rejected),
            "diagnosticUniquePlayers": len({r["providerPlayerId"] for r in candidates}),
            "diagnosticUniqueGames": len({r["providerGameId"] for r in candidates}),
            "failures": rejected, "source": asset_url(season),
            "sha256": hashlib.sha256(payload).hexdigest(), "diagnosticOnly": True}


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "FantasyHQ-NBA-Snapshot/1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise SnapshotError("Snapshot exceeds byte limit")
        return payload, dict(response.headers)


def atomic_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as f:
            temporary = f.name
            json.dump(value, f, allow_nan=False, separators=(",", ":"))
            f.flush()
            os.fsync(f.fileno())
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def refresh(season, cache_path, fetch=download):
    """One explicit refresh. Serialize callers; no server or background scheduling."""
    season = season_year(season)
    path = Path(cache_path)
    previous = None
    if path.exists():
        previous = json.loads(path.read_text())
        old = previous.get("snapshot")
        if old and old["metadata"]["sportsDataverseSeasonEndingYear"] != season:
            raise SnapshotError("Cache belongs to another season")
    attempted = timestamp()
    try:
        payload, headers = fetch(asset_url(season))
        snapshot = parse_snapshot(payload, season, headers)
    except Exception as exc:
        result = {"snapshot": previous.get("snapshot") if previous else None,
                  "refresh": {"status": "FAILED", "attemptedAt": attempted,
                              "stale": True, "error": type(exc).__name__ + ": " + str(exc)[:300]}}
        atomic_write(path, result)
        return result
    result = {"snapshot": snapshot, "refresh": {"status": "SUCCESS", "attemptedAt": attempted, "stale": False, "error": None}}
    atomic_write(path, result)
    return result


def summary(result):
    snapshot = result["snapshot"]
    if not snapshot:
        return {"refresh": result["refresh"]}
    rows = snapshot["records"]
    return {"refresh": result["refresh"], "metadata": snapshot["metadata"],
            "uniquePlayers": len({r["providerPlayerId"] for r in rows}),
            "uniqueGames": len({r["providerGameId"] for r in rows}),
            "participationCounts": dict(Counter(r["participationState"] for r in rows)),
            "seasonTypeCounts": dict(Counter(r["seasonType"] for r in rows)),
            "missingStats": {k: sum(r[k] is None for r in rows) for k in STATS},
            "duplicates": 0, "identityConflicts": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--season-ending-year", type=int, required=True)
    parser.add_argument("--cache", type=Path, help="Single-season cache path; defaults outside repository")
    args = parser.parse_args()
    cache = args.cache or Path.home() / ".fantasyhq" / "nba" / f"sportsdataverse-{args.season_ending_year}.json"
    result = refresh(args.season_ending_year, cache)
    print(json.dumps(summary(result), indent=2))
    raise SystemExit(0 if result["refresh"]["status"] == "SUCCESS" else 1)
