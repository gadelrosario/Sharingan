# Jōnin 4.4.13 Live Player Intelligence

## Authority boundary

Jōnin 4.4.13 populates the existing current-week evidence contract. It does not change recommendation weights, Start/Sit thresholds, waiver weights, Draft logic, rankings, grading, or Championship Equity. All newly refreshed nflverse usage remains `recommendationAuthority: false`.

## Source inventory and decisions

| Evidence class | Selected source | Access and cadence | Identity / scoring semantics | Freshness and failure behavior | Authority |
|---|---|---|---|---|---|
| Yahoo roster and selected slot | Yahoo Fantasy Sports API through the local HTTPS bridge | User refresh; bounded authenticated league bundle | Yahoo player/team IDs; league-specific | Last valid profile snapshot is preserved on provider or storage failure | Authoritative roster state |
| Opponent, kickoff, game state, lock | nflverse public `games.csv` schedule | One week-level request; 10-second timeout; 15-minute in-process cache | NFL team and stable game ID; UTC kickoff normalized from Eastern schedule time | Current within 15 minutes, aging to 60 minutes, then stale. A stale pregame state cannot authorize a move. Failure preserves Yahoo and the prior valid schedule snapshot. | Game fact only; no recommendation authority |
| Player actual fantasy points | Yahoo weekly roster player-stat resource | Batched per fantasy team during the existing league sync | Yahoo-calculated points under the league's scoring settings | Tagged with fantasy week and sync timestamp. Numeric zero is valid; missing remains null. | Authoritative actual scoring |
| Current-week player projection | None promoted | Existing Yahoo Fantasy API responses tested in this milestone did not expose player projected points. The dormant FantasyPros adapter requires unconfigured credentials and was not validated. | No cross-format conversion or inferred projection is permitted | Projection remains unavailable. Wrong-week, wrong-format, stale, or identity-mismatched values fail closed. | None |
| Current-season box-score usage | nflverse weekly player stats | Public season/week batch artifact; refreshed after completed games | GSIS ID reconciled through the Season Player Registry | Artifact provenance and observed/fetched timestamps retained | Context only; recommendation authority false |
| Current-season snaps/routes | nflverse participation data | Public season/week batch artifact; stable once a game finalizes | GSIS ID reconciled through the Season Player Registry | One-game evidence is labeled `ONE_GAME`; two games `DEVELOPING`; stale remains explicit | Context only; recommendation and transaction authority false |
| Injury status | Sleeper public NFL players endpoint | Manual/daily cached snapshot; no token | Sleeper ID mapped to canonical Fantasy HQ ID | Absence remains `UNKNOWN`; stale designations are not presented as current | Context and safety input under existing contract |

## Projection-source gate

No source was granted projection authority in 4.4.13.

- **Yahoo Fantasy Sports API:** the weekly player-stat resource supplies league-scored actual points but the tested live response contains no `player_projected_points` field.
- **FantasyPros adapter:** present as dormant infrastructure, but it requires credentials and its current-week coverage, generated timestamp, rate limits, scoring compatibility, and missing-player behavior were not validated in this environment.
- **HTML scraping:** rejected because it would be brittle and its access/licensing semantics are not appropriate for production authority.

Until a provider can document access method, update frequency, player/position coverage, week semantics, scoring compatibility, generated/fetched timestamps, identity system, rate limits, and failure behavior, Fantasy HQ Current Outlook and Position Battle continue to fail closed when a starter needs a projection.

## Calculation contracts

- Completed starter: authoritative Yahoo actual replaces projection.
- Unstarted starter: a current/aging, identity-safe, correct-week, scoring-compatible projection may contribute.
- Live starter: unavailable unless a source explicitly supplies a supported live expectation.
- The same player can contribute exactly one component; `actual + full projection` is forbidden.
- Bench actuals never enter the starting-lineup outlook.
- Unknown or stale game state never authorizes a lineup move.

## Identity and privacy

Team defenses reconcile through a dedicated team + DST entity path. Newly observed human players prefer stable source IDs plus position/team through the Season Player Registry. Ambiguous identities remain unresolved. NFL game facts are shared across profiles; Yahoo scoring, lineup state, recommendations, and persistence remain profile-specific. No OAuth material or private Yahoo payload belongs in artifacts or QA reports.
