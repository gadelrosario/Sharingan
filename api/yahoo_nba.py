"""NBA-only read-only bundle; reuses the existing Yahoo transport and OAuth."""
import re
from datetime import datetime, timezone


def records(value, key):
    if isinstance(value, dict):
        for k, item in value.items():
            if k == key:
                yield item
            else:
                yield from records(item, key)
    elif isinstance(value, list):
        for item in value:
            yield from records(item, key)


def merge(value):
    if isinstance(value, dict):
        return value
    result = {}
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                result.update(item)
    return result


def discover(client):
    payload = client.get('users;use_login=1/games;game_keys=nba/leagues')
    result = []
    for parts in records(payload, 'game'):
        game = parts[0]
        if game.get('code') != 'nba':
            continue
        for league in records(parts[1:], 'league'):
            row = league[0]
            result.append({'game': {k: game.get(k) for k in ('code', 'game_key', 'season')},
                           'leagueKey': row['league_key'], 'name': row.get('name'),
                           'teamCount': row.get('num_teams'), 'draftStatus': row.get('draft_status')})
    return result


def bundle(client, selected):
    game, key = selected['game'], selected['leagueKey']
    if game.get('code') != 'nba' or not re.fullmatch(r'\d+\.l\.\d+', key) or not key.startswith(str(game['game_key']) + '.l.'):
        raise ValueError('Verified NBA league required')
    settings = client.get(f'league/{key}/settings')
    teams = client.get(f'league/{key}/teams')
    pages, seen, start = [], set(), 0
    for _ in range(80):
        page = client.get(f'league/{key}/players;start={start};count=25/ownership')
        rows = list(records(page, 'player'))
        if not rows:
            break
        for row in rows:
            player = merge(row[0])
            player_key = player.get('player_key')
            if not player_key or player_key in seen:
                raise ValueError('Duplicate/missing NBA universe player key')
            seen.add(player_key)
        pages.append(page)
        start += len(rows)  # Yahoo count caps must not skip players.
    else:
        raise ValueError('NBA universe pagination limit; incomplete coverage')
    user_teams = [merge(row[0]) for row in records(teams, 'team') if str(merge(row[0]).get('is_owned_by_current_login')) == '1']
    roster, roster_status = None, 'UNRESOLVED_USER_TEAM'
    if len(user_teams) == 1:
        roster = client.get(f"team/{user_teams[0]['team_key']}/roster")
        roster_status = 'AVAILABLE'
    return {'sport': 'nba', 'game': game, 'selection': selected, 'settings': settings,
            'userTeam': {k: user_teams[0].get(k) for k in ('team_key', 'name')} if len(user_teams) == 1 else None,
            'roster': roster, 'rosterStatus': roster_status, 'pages': pages,
            'universeCount': len(seen), 'coverage': 'COMPLETE',
            'fetchedAt': datetime.now(timezone.utc).isoformat()}
