"""Pure player identity and reconciliation helpers.

This module deliberately has no repository-data paths or import-time I/O. Callers
must provide records explicitly, which keeps audits and tests reproducible.
"""
from __future__ import annotations

import re
from collections import defaultdict
from typing import Any, Iterable

SUFFIX_PATTERN = re.compile(r"\b(?:jr|sr|senior|ii|iii|iv|v)\b", re.I)
CANONICAL_POSITIONS = {"QB", "RB", "WR", "TE", "K", "DST"}


def normalize_search_name(value: Any, *, keep_suffix: bool = True) -> str:
    text = str(value or "").strip().replace("’", "'").replace("‘", "'").replace("`", "'")
    text = text.replace(".", "").replace("-", " ")
    text = re.sub(r"[^\w\s']+", " ", text, flags=re.U).lower().replace("'", "")
    text = re.sub(r"\s+", " ", text).strip()
    if not keep_suffix:
        text = SUFFIX_PATTERN.sub("", text)
        text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_name(value: Any) -> str:
    return normalize_search_name(value, keep_suffix=False)


def normalize_team(value: Any) -> str:
    candidate = re.sub(r"[^A-Z0-9]+", "", str(value or "").upper())
    aliases = {
        "ARIZONA": "ARI", "ATLANTA": "ATL", "BALTIMORE": "BAL", "BUFFALO": "BUF",
        "CAROLINA": "CAR", "CINCINNATI": "CIN", "CLEVELAND": "CLE", "DALLAS": "DAL",
        "DENVER": "DEN", "DETROIT": "DET", "GREENBAY": "GB", "HOUSTON": "HOU",
        "INDIANAPOLIS": "IND", "JAC": "JAX", "JACKSONVILLE": "JAX",
        "KANSASCITY": "KC", "LASVEGAS": "LV", "MIAMI": "MIA", "MINNESOTA": "MIN",
        "NEWENGLAND": "NE", "NEWORLEANS": "NO", "PHILADELPHIA": "PHI",
        "PITTSBURGH": "PIT", "SANFRANCISCO": "SF", "SEATTLE": "SEA",
        "TAMPABAY": "TB", "TENNESSEE": "TEN", "WASHINGTON": "WAS",
    }
    return aliases.get(candidate, candidate)


def split_name_components(name: str) -> dict[str, str]:
    canonical = str(name or "").strip().replace("’", "'")
    suffix_match = SUFFIX_PATTERN.search(canonical)
    suffix = suffix_match.group(0) if suffix_match else ""
    base = SUFFIX_PATTERN.sub("", canonical).strip() if suffix_match else canonical
    tokens = base.split()
    return {
        "canonical_full_name": canonical,
        "first_name": tokens[0] if tokens else "",
        "middle_name": " ".join(tokens[1:-1]) if len(tokens) > 2 else "",
        "last_name": tokens[-1] if len(tokens) > 1 else "",
        "suffix": suffix,
    }


def stable_identity(record: dict[str, Any]) -> str | None:
    for key in ("stable_id", "id", "canonical_key"):
        if record.get(key) not in (None, ""):
            return str(record[key])
    name = record.get("canonical_full_name") or record.get("name")
    position = record.get("position") or record.get("pos")
    if name and position:
        return f"{normalize_name(name)}|{str(position).upper()}"
    return None


def alias_key(record: dict[str, Any]) -> str:
    name = record.get("canonical_full_name") or record.get("name")
    position = record.get("position") or record.get("pos")
    team = record.get("team") or record.get("nfl_team")
    return "|".join((normalize_name(name), str(position or "").upper(), normalize_team(team)))


def detect_exact_duplicates(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        identity = stable_identity(record)
        if identity:
            groups[identity].append(record)
    return [
        {"identity_key": identity, "count": len(items), "names": [i.get("name") or i.get("canonical_full_name") for i in items]}
        for identity, items in sorted(groups.items()) if len(items) > 1
    ]


def probable_duplicates(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        groups[alias_key(record)].append(record)
    matches = []
    for alias, items in sorted(groups.items()):
        for index, left in enumerate(items):
            for right in items[index + 1:]:
                left_id, right_id = stable_identity(left), stable_identity(right)
                if left_id and right_id and left_id != right_id:
                    matches.append({"identity_a": left_id, "identity_b": right_id, "evidence": alias})
    return matches


def match_records(master: Iterable[dict[str, Any]], live: Iterable[dict[str, Any]]):
    master_rows, live_rows = list(master), list(live)
    live_by_id = {stable_identity(row): row for row in live_rows if stable_identity(row)}
    matched, missing = [], []
    used = set()
    for row in master_rows:
        identity = stable_identity(row)
        if identity in live_by_id:
            matched.append((row, live_by_id[identity], "stable_id"))
            used.add(identity)
            continue
        aliases = [candidate for candidate in live_rows if stable_identity(candidate) not in used and alias_key(candidate) == alias_key(row)]
        if len(aliases) == 1:
            matched.append((row, aliases[0], "alias"))
            used.add(stable_identity(aliases[0]))
        else:
            missing.append(row)
    extra = [row for row in live_rows if stable_identity(row) not in used]
    return matched, missing, extra


def resolve_team_assignments(master_records, live_records, db_records):
    groups: dict[str, dict[str, Any]] = defaultdict(lambda: {"name": "", "position": "", "sources": {}})
    for source_key, records in (("db_roster", db_records), ("master", master_records), ("live", live_records)):
        for record in records:
            identity = stable_identity(record) or alias_key(record)
            entry = groups[identity]
            entry["name"] = entry["name"] or record.get("canonical_full_name") or record.get("name") or ""
            entry["position"] = entry["position"] or record.get("position") or record.get("pos") or ""
            entry["sources"][source_key] = normalize_team(record.get("team") or record.get("nfl_team"))
    output = []
    for identity, entry in sorted(groups.items()):
        db_team = entry["sources"].get("db_roster", "")
        master_team = entry["sources"].get("master", "")
        live_team = entry["sources"].get("live", "")
        if db_team and master_team:
            status = "consistent" if db_team == master_team else "mismatch"
        elif master_team:
            status = "missing_db"
        elif db_team:
            status = "missing_master"
        else:
            status = "missing_both"
        output.append({
            "stable_id": identity, "canonical_name": entry["name"], "position": entry["position"],
            "db_team": db_team, "master_team": master_team, "live_team": live_team,
            "selected_current_team": db_team or master_team or live_team, "status": status,
        })
    return output


def preserve_non_null_fields(original: dict[str, Any], replacement: dict[str, Any]) -> dict[str, Any]:
    """Return replacement data without losing populated fields from original."""
    merged = dict(replacement)
    for key, value in original.items():
        if value not in (None, "", [], {}) and merged.get(key) in (None, "", [], {}):
            merged[key] = value
    return merged
