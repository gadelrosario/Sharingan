# Historical Usage and Breakout-Signal Intake

Jōnin 4.3.11 adds an offline, shadow-only historical-usage contract. It supplies evidence structures for future Championship Equity research without creating an upside score, assigning breakout labels, or changing production recommendations.

## Source evaluation

Provider: **nflverse**. The official nflverse documentation confirms that `load_player_stats()` supplies player-level weekly or season summaries keyed by GSIS `player_id`, while participation is a separate dataset with distinct licensing and release timing.

Reviewed official resources:

- <https://nflreadr.nflverse.com/reference/load_player_stats.html>
- <https://nflreadr.nflverse.com/articles/dictionary_player_stats.html>
- <https://nflreadr.nflverse.com/reference/load_participation.html>
- <https://github.com/nflverse/nflverse-data>

The local runtime could inspect documentation but could not resolve GitHub for dataset download. Therefore:

`NFLVERSE_LIVE_ACCESS = UNAVAILABLE`

No historical player snapshot was created and no current-player evidence was fabricated.

## Season window

The default window is the three most recent completed seasons: **2023, 2024, and 2025**. Three seasons are sufficient for recent role history without downloading decades of play-by-play. The season list is configurable in the adapter.

## Normalized contract

Each record retains canonical player ID, GSIS/provider ID, position, season, week, source, source dataset, snapshot date, historical basis, aggregation level, identity confidence/status, field-level raw/derived metadata, and sample quality.

Raw supported player-stat fields include passing, rushing, targets, receptions, receiving production, and air yards when actually present. Guarded fields—routes, snaps, scrambles, designed rushes, red-zone usage, goal-line carries—require explicit field provenance. They cannot be inferred from ordinary rushing attempts or narrative context.

Fantasy HQ may derive only transparent calculations from valid inputs:

- total touches and touches per game;
- targets per game;
- yards and receptions per target;
- TPRR/YPRR only when every observed row has reliable routes;
- QB yards per attempt, completion rate, TD rate, and interception rate;
- deterministic previous-window versus recent-window trends.

Every derived metric records its source fields, formula, sample, and Fantasy HQ provenance.

## Identity and failure safety

GSIS/provider ID is primary. Unknown IDs, duplicate source rows, provider IDs mapped to multiple canonical players, multiple provider players attached to one canonical player, and malformed metrics are quarantined. Display-name matching is not the primary path.

Normalization is offline and atomic. Historical data is never downloaded during drafting and is not loaded by the browser. Missing or stale data leaves Championship Equity at `UNKNOWN`/`INSUFFICIENT_DATA` and does not affect player availability.

## Reproducible workflow

Use official `nflreadr::load_player_stats(2023:2025, summary_level = "week")`, export those rows as JSON, then normalize locally:

```sh
node scripts/normalize_nflverse_usage.js \
  --input /path/to/nflverse-player-stats.json \
  --snapshot-date 2026-08-19 \
  --output data/historical_usage_2023_2025.json
```

Only the compact per-player/per-season normalized output is intended for review. Raw play-by-play should not be committed or browser-loaded.

## Current coverage

No live dataset was available locally, and the active pool currently contains **0 GSIS/nflverse IDs**, so all active-pool historical coverage is zero. The normalizer can establish a reviewable fallback attachment only when source name, position, and team uniquely agree; stable GSIS IDs remain primary.

| Position | Active | Passing/rushing | Receiving/targets | Routes | Red zone | Trends/efficiency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| QB | 34 | 0 / 0 | — | — | 0 | 0 |
| RB | 78 | 0 | 0 | 0 | 0 | 0 |
| WR | 107 | — | 0 | 0 | 0 | 0 |
| TE | 46 | — | 0 | 0 | 0 | 0 |

Identity-quality counters are also zero because no source rows were processed; fixture tests, rather than invented production records, verify reconciliation and quarantine behavior.

## Positional gap matrix

| Signal | Contract state | Current active coverage | Source/sample concern | Next source need |
| --- | --- | ---: | --- | --- |
| QB passing/rushing | Available from player-stat contract | 0 | Live snapshot unavailable | nflverse player stats |
| QB scrambles/designed rushes | Source-limited | 0 | Never infer from carries | Explicit charting/participation field |
| QB red-zone rushing | Derivable only from explicit yard-line evidence | 0 | Requires play-level field provenance | nflverse play-by-play normalization |
| RB rushing/receiving | Available from player-stat contract | 0 | Live snapshot unavailable | nflverse player stats |
| RB red-zone/goal-line | Derivable | 0 | Requires defensible yard-line rules | nflverse play-by-play normalization |
| RB/WR/TE routes | Source-limited | 0 | Participation has separate license/timing | Licensed participation snapshot |
| WR/TE targets and production | Available from player-stat contract | 0 | Live snapshot unavailable | nflverse player stats |
| TPRR/YPRR | Derivable | 0 | Only with complete reliable routes | Participation plus player stats |
| First-read share | Missing | 0 | Not supplied by reviewed source | Authorized charting source |
| Weekly role trend | Derivable | 0 | Requires at least four observed weeks | Weekly player stats/participation |
| Final fantasy finish | Missing | 0 | Needed for backtesting outcomes | Scoring-normalized season results |

## Future Championship Equity evidence

With valid source records, the contract can support partial evidence for pass-catching role, workload growth, target earning, basic receiving efficiency, QB rushing, and passing efficiency. Route earning, TPRR/YPRR, goal-line role, scramble/design splits, contingent workload, and low optionality remain source-limited. No archetype is automatically assigned in 4.3.11.

Vegas, Fantasyland, BDGE, projections, ADP, and Sleeper context remain separate layers and were not modified or blended.
