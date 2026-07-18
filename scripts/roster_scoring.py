"""
Roster scoring utilities for Draft Lab
- Uses only available data
- Produces a provisional score labeled as requested
"""
from collections import Counter

def score_roster(roster, all_players=None, label="Provisional Draft Lab Score"):
    # roster: list of player dicts
    # all_players: unused currently but accepted for future expansion
    # Basic score: sum of 'overall' where available
    base = 0
    for p in roster:
        base += p.get('overall') or 0
    # penalize positional imbalances (simple)
    pos_counts = Counter([p.get('pos') for p in roster])
    penalty = 0
    # Encourage at least 1 QB, 2 RB, 2 WR
    if pos_counts.get('QB',0) < 1:
        penalty += 15
    if pos_counts.get('RB',0) < 2:
        penalty += 10
    if pos_counts.get('WR',0) < 2:
        penalty += 8
    score = base - penalty
    return {
        'score': score,
        'label': label,
        'components': {
            'base_sum': base,
            'penalty': penalty,
            'pos_counts': dict(pos_counts)
        }
    }
