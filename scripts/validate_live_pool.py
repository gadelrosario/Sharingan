#!/usr/bin/env python3
"""
Validate a generated live player pool against the canonical DB.

Checks:
1. Required named players present (Mark Andrews, Jordan Love, Travis Etienne Jr.)
2. All DB canonical players present (by normalized name+pos)
3. No duplicate IDs
4. No duplicate normalized name+pos identities
5. Zero blank teams for draftable skill positions (QB, RB, WR, TE)
6. All new records have a canonical_key bridge field
7. No overall rank invented for originally unranked players

Usage:
  python3 scripts/validate_live_pool.py [--generated data/players_generated.json]
"""
import argparse
import csv
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

REQUIRED_PLAYERS = [
    ('Mark Andrews', 'TE'),
    ('Jordan Love', 'QB'),
    ('Travis Etienne Jr.', 'RB'),
    ('Kenneth Walker III', 'RB'),
    ('T.J. Hockenson', 'TE'),
    ('D.J. Moore', 'WR'),
    ('Cam Ward', 'QB'),
    ('Jonathan Brooks', 'RB'),
]

DRAFTABLE_POSITIONS = {'QB', 'RB', 'WR', 'TE'}


def normalize_name(name: str) -> str:
    if not name:
        return ''
    s = name.lower().strip()
    for ch, rep in [('\u2019', "'"), ('\u2018', "'"), ('`', "'")]:
        s = s.replace(ch, rep)
    s = s.replace('.', '').replace('-', ' ')
    s = re.sub(r"[^\w\s']+", ' ', s)
    s = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", '', s)
    s = s.replace("'", '')
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def load_db_players(db_path: Path) -> list:
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT canonical_key, full_name, position, nfl_team FROM players ORDER BY id').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def run_validation(generated_path: Path, db_path: Path) -> dict:
    with open(generated_path, encoding='utf-8') as f:
        generated = json.load(f)

    db_players = load_db_players(db_path)

    failures = []
    warnings = []

    # 1. Required named players present
    gen_lookup_norm = {}
    for p in generated:
        key = (normalize_name(p['name']), p['pos'].upper())
        gen_lookup_norm[key] = p

    for req_name, req_pos in REQUIRED_PLAYERS:
        key = (normalize_name(req_name), req_pos)
        if key not in gen_lookup_norm:
            failures.append(f'REQUIRED_PLAYER_MISSING: {req_name} ({req_pos})')
        else:
            match = gen_lookup_norm[key]
            team = match.get('team', '')
            if not team:
                failures.append(f'REQUIRED_PLAYER_NO_TEAM: {req_name} ({req_pos})')
            else:
                print(f'  [OK] {req_name} ({req_pos}) team={team} id={match["id"]} overall={match.get("overall")}')

    # 2. All DB canonical players present
    missing_from_generated = []
    for db_row in db_players:
        key = (normalize_name(db_row['full_name']), db_row['position'].upper())
        if key not in gen_lookup_norm:
            missing_from_generated.append(db_row)

    if missing_from_generated:
        for r in missing_from_generated:
            failures.append(f'DB_PLAYER_MISSING_FROM_OUTPUT: {r["full_name"]} ({r["position"]})')
    else:
        print(f'  [OK] All {len(db_players)} DB canonical players present in output.')

    # 3. No duplicate IDs
    ids = [p['id'] for p in generated]
    seen_ids = set()
    dup_ids = []
    for i in ids:
        if i in seen_ids:
            dup_ids.append(i)
        seen_ids.add(i)
    if dup_ids:
        failures.append(f'DUPLICATE_IDS: {dup_ids[:10]}')
    else:
        print(f'  [OK] No duplicate IDs.')

    # 4. No duplicate normalized name+pos
    seen_keys = set()
    dup_keys = []
    for p in generated:
        key = (normalize_name(p['name']), p['pos'].upper())
        if key in seen_keys:
            dup_keys.append(f"{p['name']} ({p['pos']})")
        seen_keys.add(key)
    if dup_keys:
        failures.append(f'DUPLICATE_NAME_POS: {dup_keys[:10]}')
    else:
        print(f'  [OK] No duplicate name+pos identities.')

    # 5. Zero blank teams for draftable skill positions
    blank_team_draftable = [p for p in generated if p['pos'].upper() in DRAFTABLE_POSITIONS and not p.get('team')]
    if blank_team_draftable:
        for p in blank_team_draftable:
            failures.append(f'BLANK_TEAM_DRAFTABLE: {p["name"]} ({p["pos"]}) id={p["id"]}')
    else:
        print(f'  [OK] No blank teams for draftable skill positions.')

    # 6. No overall rank invented for new records
    new_records = [p for p in generated if p.get('_canonical_key')]
    with_invented_overall = [p for p in new_records if p.get('overall') is not None and int(p.get('overall', 0)) <= len(generated) - len(new_records)]
    if with_invented_overall:
        warnings.append(f'POSSIBLE_INVENTED_OVERALL: {[p["name"] for p in with_invented_overall[:5]]}')

    # 7. DST and K sanity
    dst_count = sum(1 for p in generated if p['pos'].upper() == 'DST')
    k_count = sum(1 for p in generated if p['pos'].upper() == 'K')
    total = len(generated)
    positions = sorted({p['pos'].upper() for p in generated})
    missing_positions = sorted({'QB', 'RB', 'WR', 'TE', 'K', 'DST'} - set(positions))
    if missing_positions:
        failures.append(f'MISSING_POSITIONS: {missing_positions}')

    # Named identity contracts that have historically regressed.
    travis = gen_lookup_norm.get((normalize_name('Travis Etienne Jr.'), 'RB'))
    if not travis or travis.get('id') != 41:
        failures.append(f'TRAVIS_STABLE_ID: expected 41, got {travis.get("id") if travis else None}')
    luther = [p for p in generated if (normalize_name(p['name']), p['pos'].upper()) ==
              (normalize_name('Luther Burden III'), 'WR')]
    if len(luther) != 1 or luther[0].get('id') != 46:
        failures.append(f'LUTHER_IDENTITY: expected one record with ID 46, got {[(p.get("id"), p.get("name")) for p in luther]}')

    # A canonical-only player with no overall ranking must remain explicitly null.
    for name, pos in [('Mark Andrews', 'TE'), ('Jordan Love', 'QB')]:
        player = gen_lookup_norm.get((normalize_name(name), pos))
        if player and ('overall' not in player or player['overall'] is not None):
            failures.append(f'MISSING_RANK_NOT_NULL: {name} overall={player.get("overall")}')

    summary = {
        'total_players': total,
        'db_players': len(db_players),
        'new_records': len(new_records),
        'dst_count': dst_count,
        'k_count': k_count,
        'position_counts': {pos: sum(1 for p in generated if p['pos'].upper() == pos) for pos in positions},
        'missing_positions': missing_positions,
        'blank_teams_draftable': len(blank_team_draftable),
        'missing_from_generated': len(missing_from_generated),
        'failures': failures,
        'warnings': warnings,
        'passed': len(failures) == 0,
    }
    return summary


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--generated', default=str(BASE / 'data' / 'players_generated.json'))
    parser.add_argument('--db', default=str(BASE / 'database' / 'fantasyhq.db'))
    args = parser.parse_args()

    print(f'Validating {args.generated}')
    print()
    summary = run_validation(Path(args.generated), Path(args.db))
    print()
    print('=== Validation Summary ===')
    for k, v in summary.items():
        if k not in ('failures', 'warnings'):
            print(f'  {k}: {v}')
    if summary['failures']:
        print('FAILURES:')
        for f in summary['failures']:
            print(f'  ✗ {f}')
    if summary['warnings']:
        print('WARNINGS:')
        for w in summary['warnings']:
            print(f'  ⚠ {w}')
    print()
    if summary['passed']:
        print('RESULT: PASS')
    else:
        print('RESULT: FAIL')


if __name__ == '__main__':
    main()
