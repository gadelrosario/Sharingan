# Jōnin 4.3.13 Historical Breakout Backtest

## Status and firewall

This is an offline, exploratory research layer. It is not exported by the production Intelligence Core or loaded by the browser. Every report declares `recommendationAuthority: false`. It does not alter Mamba, Best Pick, recommendation order, archetypes, grading, CPU behavior, rankings, tiers, or player values.

No composite score was created. The two available historical transitions support signal-level investigation, not stable coefficient estimation. No current-player watchlist was generated.

## Outcome contract

Outcomes use explicitly documented half-PPR scoring with four-point passing touchdowns:

- 0.04 points per passing yard
- 4 points per passing touchdown
- −2 points per interception
- 0.1 points per rushing or receiving yard
- 6 points per rushing or receiving touchdown
- 0.5 points per reception

Fumbles are unavailable and are not inferred. Fantasy points per active observed week are ranked within position and season. Both the evidence season and outcome season require at least eight observed weeks.

The position-aware percentile thresholds are:

| Position | Elite | Starter |
|---|---:|---:|
| QB | 85th percentile | 60th percentile |
| RB | 90th percentile | 65th percentile |
| WR | 90th percentile | 65th percentile |
| TE | 85th percentile | 60th percentile |

Labels are mutually exclusive:

- `ELITE_OUTCOME`: crosses into the elite band with at least a 10-percentile-point gain.
- `STARTER_BREAKOUT`: crosses into the starter band with at least a 10-point gain.
- `MEANINGFUL_ASCENT`: gains at least 20 points and finishes at or above the 40th percentile.
- `NON_BREAKOUT`: does not satisfy one of those ascent contracts.

Prior elite seasons are excluded from breakout-candidate signal analysis. This prevents established elite players who remain elite from being mislabeled as failed breakout calls.

## Leakage controls and feature windows

Feature extraction accepts exactly one declared evidence season. The outcome builder requires the same canonical player and the immediately following season. Team changes do not change identity.

- `FULL_SEASON`: Season N aggregates only.
- `LATE_SEASON`: mean of the final two active observations in Season N.
- `EARLY_VS_LATE_GROWTH`: final-two mean minus the preceding-two mean, using the final four active Season N observations.

No Season N+1 record is passed to feature extraction. Trends and aggregates remain season-specific.

## Sample sizes

Maximum canonical paired seasons before the eight-week outcome and prior-elite filters:

| Position | 2023→2024 | 2024→2025 |
|---|---:|---:|
| QB | 24 | 29 |
| RB | 43 | 50 |
| WR | 60 | 75 |
| TE | 29 | 33 |

Eligible breakout-candidate samples:

| Position | 2023→2024 | 2024→2025 | Discipline |
|---|---:|---:|---|
| QB | 17 | 19 | Limited |
| RB | 33 | 36 | Exploratory |
| WR | 46 | 58 | Exploratory |
| TE | 21 | 26 | Limited |

These samples are directional, not production-grade.

## Methods

Each supported feature is evaluated separately in both transitions using:

- aligned univariate AUC;
- Spearman rank correlation with next-season positional percentile;
- top-third versus bottom-third breakout-rate lift;
- explicit positive/negative sample counts.

`CONSISTENT` requires positive evidence in both transitions under conservative AUC, correlation, and bucket-lift thresholds. One-season wins are not sufficient. QB and TE signals remain `PROMISING_NEEDS_MORE_DATA` even when consistent because their samples are limited.

## Results

### RB

Receiving involvement was the most repeatable family, but it remains unstable:

- Targets/game: AUC 0.539 and 0.640; `PROMISING_BUT_UNSTABLE`.
- Receiving yards/game: AUC 0.541 and 0.576; `PROMISING_BUT_UNSTABLE`.

Rushing volume, touch volume, rushing efficiency, touchdown efficiency, and growth measures were weak or contradictory across years. Supported RB evidence is not coherent enough for a composite.

Illustrative targets/game hits include Bijan Robinson (2023→2024), Josh Jacobs (2023→2024), Travis Etienne Jr. (2024→2025), and Javonte Williams (2024→2025). Comparable false positives include Alvin Kamara and Kenneth Walker III. False negatives include Chase Brown, Rico Dowdle, and Chuba Hubbard.

### WR

No tested WR feature repeated strongly enough. Target volume, receiving volume, target growth, late targets, catch rate, and yards/target were `WEAK`. The high rank correlation of volume with next-season production did not translate into breakout discrimination because usage alone could not distinguish stable incumbents from new role expansion.

Illustrative target-growth hits include Darnell Mooney (2023→2024), Michael Wilson (2024→2025), and Chris Olave (2024→2025). False positives include Andrei Iosivas, Jerry Jeudy, and Keon Coleman. False negatives include Jauan Jennings, Christian Watson, and Parker Washington.

### TE

Late targets were the only directional TE signal:

- Late targets: AUC 0.587 and 0.527; `PROMISING_BUT_UNSTABLE` and `PROMISING_NEEDS_MORE_DATA` because the TE samples are only 21 and 26.
- Targets/game, receptions/game, and receiving yards/game were weak under the two-year classification contract.

The TE result should not be promoted without another season or richer route evidence. Illustrative hits include Trey McBride (2023→2024), George Kittle (2023→2024), and Juwan Johnson (2024→2025); comparable misses include Evan Engram and Mike Gesicki.

### QB

Three signals were directional but unstable:

- Late rushing attempts: AUC 0.550 and 0.693.
- Lower interception rate: AUC 0.583 and 0.636.
- Rushing-attempt growth: AUC 0.575 and 0.546.

Passing volume and efficiency signals were weak, while raw rushing production was contradictory. QB samples of 19 and 21 are too small for promotion.

Illustrative late-rushing hits include Sam Darnold (2023→2024), Daniel Jones (2024→2025), and Matthew Stafford (2024→2025). False positives include Patrick Mahomes, Russell Wilson, and Bo Nix. False negatives include Joe Burrow, Drake Maye, and Trevor Lawrence.

## Limitations and next data decision

- The historical cohort contains current canonical players, creating survivorship bias.
- Age, experience, and year-in-league coverage are incomplete.
- Routes, TPRR, YPRR, first-read share, red-zone role, goal-line role, scrambles, and designed runs are unavailable.
- Team environment, depth-chart changes, coaching changes, and injury-opened opportunity are not available as historical features.
- False-positive causes are reported only when the stored evidence supports them; unexplained cases remain explicitly unexplained.

The result is **MORE DATA NEEDED** before a shadow Championship Equity composite. The highest-value next source is historical route/participation and role context, especially for WR and TE, followed by reliable age/experience metadata. Signal-level research may continue, but no production or current-player scoring is justified.

## Artifacts

- `outputs/historical_breakout/backtest_summary_4_3_13.json`: full compact signal metrics, samples, outcome counts, hits, false positives, false negatives, and firewall status.
- `scripts/run_historical_breakout_backtest.js`: deterministic offline runner.
