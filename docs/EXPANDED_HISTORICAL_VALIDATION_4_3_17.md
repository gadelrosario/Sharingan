# Jōnin 4.3.17 Expanded Historical Validation

## Scope and decision

This milestone is an offline, research-only validation gate. It expands the approved nflverse historical-usage contract to 2019–2025 and joins it to the frozen 4.3.16 preseason-ADP outcomes. It does not create a Championship Equity composite, score current players, enter the browser bundle, or acquire recommendation authority.

Decision: **GO — BUILD CHAMPIONSHIP EQUITY SHADOW COMPOSITE**. The evidence supports a guarded, position-specific shadow composite in a later milestone. It does not support a universal production model.

## Source access and contracts

- Weekly usage: official nflverse `nflverse-data/releases/download/player_stats/player_stats.csv` season assets for 2019–2025, acquired on 2026-08-19.
- Static player metadata: official nflverse `players.csv`, acquired on 2026-08-19.
- Market outcome: the frozen Fantasy Football Calculator half-PPR, 12-team preseason ADP snapshots already normalized in 4.3.16.
- Snapshot date used by the deterministic research artifacts: `2026-08-19T00:00:00.000Z`.

The ingestion retains GSIS identity, season/week, source provenance, signed receiving air yards, non-negative count validation, duplicate protection, quarantine reasons, and fail-closed mapping. No missing source field is silently fabricated. Core count and yardage fields used here are present in every source season. Routes, snaps, scrambles, designed runs, red-zone targets, and goal-line carries are explicitly unavailable in this source window and are excluded.

## Coverage

| Measure | Result |
| --- | ---: |
| Raw weekly source rows | 129,812 |
| Normalized weekly QB/RB/WR/TE records | 40,330 |
| Player-season usage records | 4,191 |
| Research identities | 1,352 |
| Production-canonical identities bridged for research | 233 |
| Historical-only GSIS research identities | 1,119 |
| Usage identities represented | 1,349 |
| Unmatched / ambiguous / quarantined usage rows | 0 / 0 / 0 |
| Market transitions | 677 |
| Usage/market paired examples | 631 |
| Production-comparable paired examples | 365 |

Historical-only IDs use the isolated `fhq_hist_gsis_*` namespace and never enter `data/players.json`. The single ADP ambiguity is Fantasy Football Calculator source ID `437` (`Frank Gore`), which can refer to two GSIS identities; it remains quarantined rather than guessed.

Development metadata covers all 1,352 research identities and all 4,191 player-season records for birth date/age. NFL entry year, rookie season, and year in league are available for 870 identities and 2,952 player-season records. Unknown entry years remain null and are not inferred from a player's first observed statistics season.

## Leakage-safe transition sample

| Evidence → outcome | Paired N |
| --- | ---: |
| 2019 → 2020 | 116 |
| 2020 → 2021 | 114 |
| 2021 → 2022 | 89 |
| 2022 → 2023 | 97 |
| 2023 → 2024 | 110 |
| 2024 → 2025 | 105 |

Predictors use only Season N usage and static development information valid for Season N. The outcome is Season N preseason ADP minus Season N+1 preseason ADP. The frozen appreciation thresholds remain meaningful at 24 picks, major at 48, and elite at 72. Season N+1 usage, development, and production are never predictors.

Market-appreciation base rates are RB 48/219 (21.92%), WR 59/253 (23.32%), TE 15/69 (21.74%), and QB 22/90 (24.44%).

## Predeclared signal results

The following table summarizes pooled market-appreciation AUC and the conservative stability result. Detailed transition metrics, eligible counts, positives, base rates, missing rates, rank correlations, current/historical slices, and headroom strata are preserved in `outputs/historical_breakout/expanded_market_validation_4_3_17.json`.

| Position | Signal | N / positives | Pooled AUC | Classification |
| --- | --- | ---: | ---: | --- |
| RB | Yards per carry | 219 / 48 | 0.6228 | READY_FOR_SHADOW_COMPOSITE |
| RB | Late rushing attempts | 219 / 48 | 0.5442 | CONTRADICTORY |
| RB | Rushing-attempt growth | 219 / 48 | 0.5408 | CONTRADICTORY |
| RB | Target growth | 219 / 48 | 0.5237 | WEAK |
| RB | Receiving yards/game | 219 / 48 | 0.4917 | WEAK |
| RB | Targets/game | 219 / 48 | 0.4805 | WEAK |
| RB | Touches/game | 219 / 48 | 0.3941 | WEAK |
| WR | Late targets | 253 / 59 | 0.5899 | READY_FOR_SHADOW_COMPOSITE |
| WR | Target growth | 253 / 59 | 0.5433 | WEAK |
| WR | Yards/target | 253 / 59 | 0.5363 | WEAK |
| WR | Catch rate | 253 / 59 | 0.4914 | CONTRADICTORY |
| WR | Receiving yards/game | 253 / 59 | 0.4902 | WEAK |
| WR | Targets/game | 253 / 59 | 0.4647 | WEAK |
| TE | All five predeclared usage signals | 69 / 15 | 0.4963–0.6593 | INSUFFICIENT_SAMPLE |
| QB | Six predeclared usage signals | 90 / 22 | 0.4736–0.5922 | WEAK or CONTRADICTORY |

RB yards per carry remained directionally useful in all six transitions: 0.6413, 0.5909, 0.5886, 0.5943, 0.6827, and 0.7328. Its current-player slice AUC was 0.6800 and historical-only slice AUC was 0.5593.

WR late targets remained useful in all six transitions: 0.5301, 0.6169, 0.6014, 0.5701, 0.5373, and 0.5877. Its current-player slice AUC was 0.5453 and historical-only slice AUC was 0.6600. The effect therefore is not a current-player survivorship artifact.

## Development and interactions

RB age (AUC 0.6665) and year in league (0.7373), plus WR age (0.7735) and year in league (0.7926), meet the stability contract. TE development remains insufficient and QB development remains weak.

Only predeclared interactions were tested, using the frozen 4.3.15 weighting of 75% usage rank plus 25% development rank. WR late targets × age (AUC 0.6553) and WR target growth × age (0.6086) are ready. WR receiving yards/game × age is promising (0.5798). The remaining RB/WR interactions are weak or contradictory; TE late targets × year in league is insufficient.

## Deterministic stability rule

A transition is adequate only with at least 15 examples, 3 positives, and 3 negatives. AUC at least 0.55 is useful; AUC at most 0.45 is adverse.

`READY_FOR_SHADOW_COMPOSITE` requires at least 180 total examples, 30 positives, 4 adequate transitions, 4 useful transitions, pooled AUC at least 0.58, no adverse transition, and AUC at least 0.52 in both current-player and historical-only slices when a slice has at least 30 examples. `PROMISING_NEEDS_MORE_DATA` requires at least 100 examples, 20 positives, 3 adequate transitions, 3 useful transitions, pooled AUC at least 0.55, and at most one adverse transition. Two useful and two adverse eras, or a maximum AUC of at least 0.62 paired with a minimum no greater than 0.42, is contradictory. Fewer than 60 total examples, 12 positives, or 3 adequate transitions is insufficient.

These rules and thresholds were declared before evaluating the expanded result and were not optimized against outcomes.

## Market headroom

The predeclared bands are picks 1–24, 25–60, 61–120, and 121+. Top-24 strata have zero positive ≥24-pick appreciation outcomes by mathematical construction, so their AUC is honestly null.

The two ready usage signals retain discrimination within comparable acquisition-cost bands:

- RB yards per carry: AUC 0.6604 at picks 25–60, 0.6297 at 61–120, and 0.7143 at 121+.
- WR late targets: AUC 0.6148 at picks 25–60, 0.8073 at 61–120, and 0.6495 at 121+.

Market headroom explains part of the outcome structure but not all observed discrimination.

## Production versus market value

RB yards per carry is market-only under the conservative contract (market AUC 0.6228; production AUC 0.4976, contradictory). WR late targets is also market-only (market AUC 0.5899; production AUC 0.3371, weak). No predeclared usage signal currently qualifies as production-only or both. This is a material limitation: the future shadow composite must label market appreciation separately and must not claim demonstrated fantasy-production breakout prediction.

## Case review

Supported predeclared signal hits include Brian Thomas Jr. (late targets), Bucky Irving (yards per carry), Nico Collins (late targets), De'Von Achane (yards per carry), and Chuba Hubbard's 2024 evidence season (yards per carry). Chase Brown remains an available-signals miss.

Bijan Robinson, Christian McCaffrey, CeeDee Lamb, Derrick Henry, and Jahmyr Gibbs include observed limited-headroom cases when their evidence ADP was already inside the top 24. Available-signal misses include Sam LaPorta, Brock Purdy, Jayden Daniels, Dalton Kincaid, Jordan Love, and Brock Bowers. The report assigns no unsupported narrative cause.

## Go/no-go gate and limitations

The gate requires at least one ready usage signal plus either two ready usage/interaction signals or ready coverage across two positions, and at least one ready signal that retains AUC of 0.55 or better within a headroom band containing at least 30 examples and 5 positives.

The gate passes because RB yards per carry and WR late targets are ready, both survive all six transitions and both identity slices, and both retain within-band discrimination. Two WR development interactions are also ready. The result justifies building a guarded RB/WR-focused shadow composite in 4.3.18, not a production recommendation input. TE and QB evidence is not ready; production-breakout support is not established; one Frank Gore ADP identity remains safely quarantined; unsupported source fields remain unavailable.

`recommendationAuthority` remains `false`. No production Intelligence Core export or browser entrypoint imports this research module, no current players are scored, and no 2026 watchlist or composite is created.
