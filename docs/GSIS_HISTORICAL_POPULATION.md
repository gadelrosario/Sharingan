# GSIS identity mapping and historical population

Jōnin 4.3.12 adds the reviewable identity bridge and refresh workflow needed to attach official nflverse weekly player summaries to Fantasy HQ canonical players. This layer is offline and shadow-only. It does not load in the browser and has no recommendation, grading, CPU, or league-profile authority.

## Current acquisition status

`NFLVERSE_LIVE_ACCESS = UNAVAILABLE`

The bounded acquisition attempt on 2026-08-19 could not resolve `github.com`. No official mapping snapshot or weekly-stat payload was available, so Fantasy HQ created no inferred GSIS mappings and populated no historical records. The empty mapping artifact explicitly records this state; it is not a claim that the active players lack GSIS identities.

Run the first official refresh from a network-enabled checkout:

```sh
node scripts/refresh_nflverse_historical_usage.js --snapshot-date 2026-08-19T00:00:00Z
```

The command downloads the official nflverse player release and 2023–2025 weekly player-stat releases, reconciles identity, validates all normalized records, and atomically replaces the compact mapping and historical outputs only after both validate. A download, parse, identity, or zero-match failure preserves the last-valid files.

For deterministic/offline operation, reviewed local JSON or CSV exports may be supplied with `--players-input PATH --stats-input 2023.csv,2024.csv,2025.csv`. They pass through the same normalization and validation path.

## Identity contract

Every mapping row contains the canonical Fantasy HQ ID/key, display name, canonical position/team, GSIS ID, source, source snapshot date, match method, confidence, and review status. Matching order is:

1. an exact GSIS ID already reviewed on the canonical player;
2. a unique provider external-ID bridge;
3. an existing canonical alias plus exact normalized position and team;
4. a unique normalized name + position + team fallback, marked medium confidence and reviewable.

Display name alone is never accepted. Ambiguous matches, duplicate GSIS rows, multiple GSIS IDs for one canonical player, position conflicts, and current-team conflicts are quarantined. Existing punctuation, suffix, corrected-spelling, and legacy-name aliases are considered without creating a second active player.

## Historical contract

Only regular-season weekly rows for 2023, 2024, and 2025 are eligible. Season boundaries remain explicit for later leakage-safe backtesting. Official provider values remain raw; Fantasy HQ transparently derives only arithmetic supported by present fields:

- RB: touches, touches/game, targets/game.
- WR/TE: targets/game, yards/target, receptions/target.
- QB: completion rate, yards/attempt, TD rate, interception rate.
- Weekly trends: recent-window minus prior-window averages with sample size and provenance.

The official player-stats dictionary supports the core passing, rushing, receiving, target, reception, and air-yard families used by this adapter. The selected weekly summary does not directly provide route counts, red-zone carries/targets, goal-line attempts, or the QB scramble/designed-run split. Those fields are therefore `MISSING` in this intake, not derived. Routes, TPRR, and YPRR remain null unless a later reviewed source supplies real route counts. Scrambles and designed runs are never inferred from rushing attempts.

## Participation and route audit

The nflverse participation dataset is optional and deferred in 4.3.12. It is play-level rather than a compact player summary; its `route` field describes the primary receiver on a play rather than a complete, ready-made route count for every player. Its 2023+ FTN data is released after the postseason under CC-BY-SA 4.0 and requires attribution. With no accessible snapshot, season/player completeness could not be established, so no route adapter is added merely to increase nominal coverage.

## Honest current coverage

The active pool contains 330 players and 265 QB/RB/WR/TE players. Current GSIS mappings and historical records are both zero. Six true rookies are `NO_HISTORY_EXPECTED`; the remaining 259 skill players are `HISTORY_MISSING` until official identity and stat snapshots can be processed. Detailed counts are in `outputs/player_audit/gsis_historical_population_2026-08-19.json`.

## Championship Equity firewall

Historical records can be referenced as evidence by a shadow Championship Equity record. They do not auto-assign archetypes, compute an upside or league-winner score, or change any production output. `recommendationAuthority` remains `false`, and the evidence is global rather than duplicated per league profile.
