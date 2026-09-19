# Season Current-Week Evidence

Jōnin 4.4.12 adds a normalized, fail-closed current-week evidence layer between provider snapshots and Season Mode presentation. It enriches the existing Yahoo roster without replacing Yahoo authority or changing recommendation scoring.

## Authority and identity

- Yahoo remains authoritative for roster ownership, lineup slots, opponent identity, game state, and any player points or projections Yahoo actually supplies.
- Players are joined through stable canonical identity. Unresolved or ambiguous identities stay unresolved and cannot acquire evidence by display-name guesswork.
- Source team and canonical team remain separate when a player changes teams.
- Historical usage and breakout evidence are context only and retain `recommendationAuthority: false`.

## Current-week semantics

- A final game's actual points replace that player's projection.
- A not-started player's projection is usable only when its source, week, scoring format, and freshness are supported.
- A live player's future total is not reconstructed from actual plus projection. Without an authoritative live expectation, the combined current outlook is unavailable.
- Numeric zero is valid data.
- Missing or stale evidence produces an explicit unavailable state rather than a fallback number.
- Lineup locks follow explicit Yahoo editability/game state first, then use kickoff time only as a conservative lock fallback.

## Freshness

Freshness is evaluated by evidence type. Roster, game, injury, projection, and usage observations have separate current/aging/stale windows. A stale projection or injury report cannot silently present as current.

## Current Outlook

`Fantasy HQ Current Outlook` is a derived display value, not a provider fact. It is available only when every starter has exactly one safe component:

- final starter: authoritative actual points;
- pregame starter: supported current projection.

The value is unavailable when a starter is live without a trustworthy live expectation, has unknown game state, or lacks a supported projection. This prevents actual-plus-projection double counting.

## Known limitations

- No external projection feed was added in 4.4.12. Yahoo player projections are used only when present in the current snapshot.
- Historical nflverse participation/usage artifacts remain context-only and may be stale for the current season.
- Opponent defensive matchup grades, weather, betting markets, and live expected-final scores are unavailable unless an authoritative provider supplies them.
- Current-season usage trends require multiple completed games; one-game samples are labeled insufficient and two-game samples developing.
