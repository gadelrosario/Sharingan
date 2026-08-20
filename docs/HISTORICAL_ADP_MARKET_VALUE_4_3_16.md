# Jōnin 4.3.16 — Historical ADP and Market Value Appreciation

## Status and isolation

This is offline, research-only infrastructure. `recommendationAuthority` is `false`; no browser entrypoint imports the source, normalized artifact, or backtest; no current-player watchlist or Championship Equity composite is created. Browser bundle increase: **0 bytes**.

Final decision: **MORE DATA REQUIRED**.

## Provider evaluation

| Provider | Historical access verified | Format and league-size detail | Value type | Structured access | Decision |
|---|---|---|---|---|---|
| Fantasy Football Calculator | Standard pages expose 2007–2026; Half-PPR exposes 2018–2026 | Standard, Half-PPR, PPR, 2QB, dynasty and rookie are documented; API accepts scoring, year, position and team-count parameters | Actual average pick, sample count, standard deviation, high and low pick; positional order can be derived | Public JSON REST endpoint; no authentication; provider requests attribution and infrequent refreshes | **Selected** |
| FantasyPros | Year-addressable Half-PPR archive verified for 2024 | Scoring format is explicit; source mix was Yahoo, Sleeper and RTSports on the verified page; league size was not a stable field in the page contract | Consensus average plus source-specific values and ordinal/position rank | CSV export and API are advertised, but stable unattended archive access and source composition were less consistent for this sprint | Retained as an evaluated alternative, not combined |

Primary source: **Fantasy Football Calculator 12-team Half-PPR redraft ADP** from `https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=12&year={YEAR}&position=all`.

The choice favors one structured source, actual decimal ADP, stable provider IDs, explicit draft windows, and one scoring/team-size contract across all years. The API returned `teams: 12` for every acquired response, so this work truthfully models a 12-team market rather than relabeling it as Fantasy HQ's 10-team primary league. Fantasy Football Calculator documents that its ADP is derived from mock-draft selections, excludes computer selections, updates daily, and supports historical seasons. The retained snapshot prevents repeated provider calls.

No FantasyPros values are merged into Fantasy Football Calculator values.

## Acquired source

| Season | Source rows | Drafts | Provider window |
|---:|---:|---:|---|
| 2019 | 196 | 984 | 2019-09-02 through 2019-09-04 |
| 2020 | 208 | 1,059 | 2020-08-30 through 2020-09-01 |
| 2021 | 222 | 3,949 | 2021-08-29 through 2021-09-01 |
| 2022 | 124 | 1,107 | 2022-09-03 through 2022-09-04 |
| 2023 | 199 | 4,576 | 2023-08-28 through 2023-09-01 |
| 2024 | 178 | 906 | 2024-08-31 through 2024-09-01 |
| 2025 | 156 | 718 | 2025-08-31 through 2025-09-01 |

The defensible window is **2019–2025**, yielding six adjacent preseason-market transitions. The raw retained snapshot is 407,510 bytes.

## Identity and normalization

- 1,283 source rows were read.
- 1,133 QB/RB/WR/TE market-cost records were normalized; 150 K/DST/out-of-scope records were retained as exclusions.
- 461 stable research identities were created: 176 attach to a current canonical Fantasy HQ player and 285 are provider-ID-backed historical-only identities.
- Unmatched identities are not discarded merely because the player is retired. Their IDs use a research-only `fhq_hist_ffc_<provider-id>` namespace and never enter `data/players.json`.
- Ambiguous identities: 0. Quarantined rows: 0. Duplicate provider IDs: 0. Duplicate canonical attachments: 0.
- Stable provider ID is authoritative inside the research universe. Unique normalized name + position is used only to attach that identity to the current canonical player pool; team is provenance, not identity.

The normalized artifact is 1,519,954 bytes. It stays offline and preserves source name, team, provider ID, source window, match method, and confidence for every record.

## Market cost and outcome contract

Each record preserves `overallAdp` as **ADP_PICK** and derives:

- `adpRound = ceil(overallAdp / 12)`
- season-relative `overallOrdinalRank`
- season-relative `marketCostPercentile`, where the most expensive drafted asset is 1 and the last is 0
- ordinal `positionAdpRank`, explicitly labeled as derived from overall ADP

For adjacent seasons only:

`ADP_GAIN = ADP_N - ADP_N_PLUS_1`

Positive values therefore mean appreciation. `ROUND_GAIN`, `POSITION_ADP_GAIN`, and `MARKET_PERCENTILE_GAIN` are preserved beside the raw ADPs.

Thresholds were fixed before inspecting signal results and express 12-team draft economics:

- **ELITE_APPRECIATION:** at least 72 picks (six rounds)
- **MAJOR_APPRECIATION:** at least 48 picks (four rounds)
- **MEANINGFUL_APPRECIATION:** at least 24 picks (two rounds)
- **NO_APPRECIATION:** less than 24 picks

Already-expensive elite players can remain elite yet correctly receive `NO_APPRECIATION`: the outcome measures price movement, not player quality.

## Base rates

Across 677 transitions, 149 gained at least 24 picks: **22.01%**.

| Position | Transitions | Appreciations | Rate | ADP 73–120 | ADP 121+ |
|---|---:|---:|---:|---:|---:|
| RB | 238 | 50 | 21.01% | 33.93% | 72.00% |
| WR | 273 | 60 | 21.98% | 42.86% | 70.59% |
| TE | 69 | 15 | 21.74% | 13.04% | 69.23% |
| QB | 97 | 24 | 24.74% | 25.00% | 66.67% |

This gradient is partly mechanical: cheap players have more room to gain 24 picks, while top-36 players have limited upward range. It must not be interpreted as a strategy recommendation. The machine-readable report also breaks rates out by starting round, positional ADP, fixed age bands, and year-in-league bands. Development coverage exists only where a current canonical identity and historical development record are available; unknown is preserved as unknown.

## Frozen usage signals against market appreciation

Only the two transitions with frozen usage evidence are eligible: 2023→2024 and 2024→2025. Usable samples per transition were RB 27/27, WR 32/39, TE 12/12, and QB 15/15.

### RB

- `yardsPerCarry`: **READY_FOR_SHADOW_MODEL**, mean AUC 0.7303, consistent in both transitions.
- `lateRushingAttempts`: **PROMISING_NEEDS_MORE_DATA**, 0.6441.
- `targetsPerGame`: **PROMISING_NEEDS_MORE_DATA**, 0.6038.
- `lateTargets` 0.6349, rushing-attempt growth 0.5716, target growth 0.4810, touches/game 0.4320, and attempts/game 0.4204 were weak.
- Receiving yards/game was contradictory across transitions (0.5343 mean).

### WR

No frozen usage signal reached ready or promising classification. Target growth was strongest at 0.5804 but weak across the two transitions; late targets 0.5499 was also weak. Catch rate was contradictory. The remaining tested usage/efficiency signals were weak.

### TE

Late targets (0.7523), target growth (0.6389), targets/game (0.5954), and receiving yards/game (0.5759) were all **INSUFFICIENT_SAMPLE** because each transition had only 12 usable examples. They are not promoted despite attractive point estimates.

### QB

Rushing-attempt growth had a 0.6885 mean AUC, but every QB signal remains **INSUFFICIENT_SAMPLE** because each transition supplied only 15 examples and the 2024→2025 positive count was two. Ordinary passing/rushing metrics were not promoted.

## Development context

Younger age and earlier career stage were tested independently, not blended into usage:

- RB age: READY, 0.7109; RB year in league: READY, 0.7601.
- WR age: READY, 0.6542; WR year in league: READY, 0.6770.
- TE age/year in league: insufficient samples, despite 0.7218/0.7685 mean AUCs.
- QB age/year in league: insufficient samples at 0.5627/0.6196.

These are observational associations in a survivor-biased, current-player-linked usage subset. They are not causal conclusions and do not override the `MORE DATA REQUIRED` composite decision.

## Production breakout versus appreciation

The output matrix preserves frozen Jōnin 4.3.13 production AUCs and compares them to this parallel outcome. Notable descriptive differences:

- RB yards/carry: 0.3271 production vs 0.7303 market.
- RB late rushing attempts: 0.4687 vs 0.6441.
- WR target growth: 0.4648 vs 0.5804.
- TE late targets: 0.5569 vs 0.7523, but market sample is insufficient.
- QB rushing-attempt growth: 0.5602 vs 0.6885, but market sample is insufficient.
- QB late rushing attempts favored production: 0.6216 vs 0.4319.

These comparisons show that raw production ascent and acquisition-cost appreciation are different outcomes. They do not justify changing production recommendations.

## Deterministic cases

True positives include Brian Thomas Jr. (142.9→13.9), Bucky Irving (145.8→19.7), Nico Collins (126.4→31.3), De'Von Achane (113.7→21.9), Chuba Hubbard (121.3→37.8), and Chase Brown (93.3→20.8).

False positives include already-expensive players whose evidence remained strong but whose price had little room to rise: Bijan Robinson (2.0→2.3), Christian McCaffrey (2.3→1.3), CeeDee Lamb (15.4→2.6), Derrick Henry (13.1→5.7), Ja'Marr Chase (6.3→1.5), and Jahmyr Gibbs (8.6→4.0).

False negatives include Sam LaPorta (155.5→33.4), Brock Purdy (155.8→61.7), Jayden Daniels (116.7→27.4), Dalton Kincaid (149.9→67.0), Jordan Love (158.2→78.7), and Brock Bowers (108.1→33.6).

The retrospective value-trap comparison is measurable only for players present in the frozen production-outcome examples. The report labels appreciation cases that did not also meet that production-breakout contract; it never uses Season N+1 production as a predictor. Examples include Brock Purdy, Dalton Kincaid, Jordan Love, and Jakobi Meyers. This means “market appreciation without the frozen production label,” not proof that the market was irrational.

## Survivorship and temporal firewall

Restricting the research to current 2026 players would provide 391 transitions and a 25.32% appreciation rate. Historical-only identities add **286 transitions** (73% more than the survivor-only subset) at a 17.48% appreciation rate, producing the full 677-transition/22.01% result. The materially lower historical-only rate confirms that current-player-only analysis overstates appreciation through survivorship.

Predictors read Season N preseason ADP, Season N usage, and Season N development only. Outcomes read Season N+1 preseason ADP. Season N+1 usage, production, team, role, and depth chart are not predictor inputs. Production outcomes are consulted only after prediction for the explicitly retrospective value-trap comparison.

## Reproduction

Run:

```sh
node scripts/refresh_historical_adp.js
node scripts/run_market_value_backtest.js
node tests/historical-adp-market-value-4-3-16-tests.js
```

The refresh command makes seven documented public API requests and atomically replaces the retained source only after every response satisfies the Half-PPR/12-team contract. The backtest command regenerates the normalized dataset and report byte-deterministically from that retained provider snapshot. Routine testing never contacts the provider.

## Composite decision

One frozen usage signal (RB yards/carry) met the repeated-transition readiness contract. RB/WR development context also showed repeated discrimination, but it is available only for the current-player-linked subset. WR usage was weak; QB and TE samples were insufficient; only two usage-linked transitions exist.

Therefore Jōnin 4.3.16 does **not** build a composite or score 2026 players.

**MORE DATA REQUIRED**
