# Championship Equity Data Foundation

Jōnin 4.3.9 adds a research-only Championship Equity contract. It records evidence that may eventually help distinguish safe points from paths to league-winning outcomes. It does not rank players, alter scores, select recommendation cards, or influence grading.

## Safety boundary

- The evaluator is `SHADOW` only and always returns `recommendationAuthority: false`.
- The browser application does not load this module.
- Enabling or disabling shadow evaluation must leave recommendation IDs, order, scores, and archetype labels byte-identical.
- `LOW_OPTIONALITY` is a research classification, not a player penalty.
- Missing inputs produce `INSUFFICIENT_DATA` or `UNKNOWN`; they never produce a neutral numeric default.
- Replacement-level availability and value/reach guardrails are explicit inactive placeholders.

## Architecture

`js/intelligence-core/championship-equity/contract.js` owns the versioned evidence schema, stable Fantasy HQ identity, league context, draft-stage context, research archetypes, and position-specific metric names. `shadow-evaluator.js` observes a recommendation snapshot without mutating it. `inventory.js` audits current data availability. None of these files are in the production browser asset graph.

Every metric record requires:

- canonical Fantasy HQ player identity;
- source and source player ID when available;
- snapshot date and season;
- metric type and historical/current/projected basis;
- confidence and identity-match status;
- a nullable value.

Null is intentional: lack of evidence is different from zero.

## Position evidence contract

| Position | Supported future evidence families |
| --- | --- |
| RB | snap/rush/touch share, targets/routes, receiving and red-zone usage, explosive runs, depth chart and contingent role, projected workload, age/experience/draft capital |
| WR | routes, target share, TPRR/YPRR, first-read share, air-yard/red-zone/alignment usage, age/experience/draft capital, target competition and role growth |
| TE | routes, TPRR/YPRR, target and first-read share, receiving/red-zone/snap usage, blocking-route context, age/experience and target competition |
| QB | pass volume/production/efficiency, interceptions, designed rushes/scrambles, rushing and red-zone production, age/experience |

Research archetypes are `BREAKOUT`, `ROLE_EXPANSION`, `CONTINGENT_WORKLOAD`, `CONTINGENT_BELLCOW`, `AMBIGUOUS_BACKFIELD`, `TARGET_EARNER`, `DEVELOPMENTAL_BREAKOUT`, `ELITE_TRAIT`, `MISPRICED_CEILING`, and `LOW_OPTIONALITY`. They require evidence and provenance and currently have no production authority.

## Current inventory

Snapshot: 2026-08-19. Active pool: 330 players.

| Data family | Coverage | Status |
| --- | ---: | --- |
| Canonical NFL team and position | 330 / 330 | Available |
| Stable external/provider identity | 292 / 330 | Partial |
| Injury snapshot mapping | 292 / 330 | Partial |
| Overall rank, tier, positional rank | 237 / 330 each | Partial |
| Existing expert-conviction flags | 21 / 330 | Partial |
| Rookie flag | 6 / 330 | Partial; not a complete rookie census |
| Depth-chart/handcuff relationship | 10 / 330 | Partial |
| Skill-position opportunity trend | 0 / 265 | Missing |
| Age | 0 / 330 | Missing |
| Experience | 0 / 330 | Missing |
| Advanced position usage | 0 / 330 | Missing |
| Projections | 0 / 330 | Missing |

The 64 non-placeholder `opportunityTrend` values belong to kickers or defenses and do not constitute RB/WR/TE/QB opportunity evidence. Stored `Pending` values are not counted as evidence.

### Positional gap matrix

| Signal | RB | WR | TE | QB | Current availability | Required source type |
| --- | :---: | :---: | :---: | :---: | --- | --- |
| Age / experience | ✓ | ✓ | ✓ | ✓ | Missing | Auditable public roster/biographical data |
| Rookie / draft capital | ✓ | ✓ | ✓ | — | Partial (rookie flag only; 6 true) | Auditable draft and roster data |
| Snap share | ✓ | — | ✓ | — | Missing | Play-participation/usage data |
| Rush/touch share | ✓ | — | — | — | Missing | Play-by-play or usage data |
| Targets / target share | ✓ | ✓ | ✓ | — | Missing | Play-by-play or usage data |
| Routes / route participation | ✓ | ✓ | ✓ | — | Missing | Advanced route data |
| TPRR / YPRR | — | ✓ | ✓ | — | Missing | Advanced route/efficiency data |
| First-read share | — | ✓ | ✓ | — | Missing | Advanced charting data |
| Air-yard / alignment role | — | ✓ | — | — | Missing | Advanced receiving/role data |
| Red-zone usage | ✓ | ✓ | ✓ | ✓ | Missing | Play-by-play or usage data |
| Goal-line touches | ✓ | — | — | — | Missing | Play-by-play or usage data |
| Depth chart / contingency | ✓ | — | — | — | Partial (10 handcuff relationships) | Sourced depth-chart data |
| Designed rushes / scrambles | — | — | — | ✓ | Missing | QB play-by-play/usage data |
| Passing volume / efficiency | — | — | — | ✓ | Missing | Public NFL statistics or sourced projections |
| Projection | ✓ | ✓ | ✓ | ✓ | Missing | Licensed or otherwise authorized projection snapshot |
| Injury context | ✓ | ✓ | ✓ | ✓ | Partial (292 identities) | Existing sourced Sleeper snapshot |
| Expert conviction | ✓ | ✓ | ✓ | ✓ | Partial (21 flags) | Existing auditable expert snapshots |

The reproducible inventory command is:

```sh
node scripts/audit_championship_equity_data.js
```

## Source gaps before activation

Production activation is blocked until licensed, reproducible sources fill the missing evidence families with stable IDs, dated snapshots, season, metric basis, and confidence. Priority gaps are:

1. age, experience, rookie status, and draft capital;
2. snaps, routes, touch/target shares, red-zone and goal-line work;
3. depth chart and named contingent relationships;
4. defensible projections clearly separated from historical usage;
5. replacement-level availability calibrated by league size, starting slots, bench depth, position, and draft stage.

Future activation requires a separate reviewed change with explicit validation against the frozen 4.3.8 Primary League and Straight Outta Downey early/middle/late checkpoints. This milestone supplies no fallback score and no player-specific hardcoded intelligence.

## Jōnin 4.3.10 intake status

The shadow record can now reference provenance-rich Sleeper player context, provider-neutral statistical projections, and source-specific ADP records. Availability is reported separately for each family. These references do not create a Championship Equity score or automatically assign an archetype.

The local sandbox could not retrieve the public Sleeper player endpoint, and no licensed FantasyPros credentials or snapshot were configured. Current live coverage therefore remains age 0, experience 0, depth-chart position/order 0, projections 0, and ADP 0. See `PLAYER_CONTEXT_AND_MARKET_INTAKE.md` for the updated positional counts and remaining historical-usage gaps.

## Jōnin 4.3.11 historical evidence

The shadow record can now retain normalized per-player historical-usage seasons alongside context, projections, and market records. Historical availability never assigns a research archetype by itself. Current production coverage remains zero because the nflverse dataset could not be downloaded in the local runtime; the adapter and derivations were validated with synthetic fixtures only. See `HISTORICAL_USAGE_INTAKE.md`.
Jōnin 4.3.12 adds a fail-closed GSIS reconciliation and atomic official nflverse refresh path. Live acquisition was unavailable in the Codex environment, so current mapped and historical coverage remain zero rather than being inflated through name-only inference. See `GSIS_HISTORICAL_POPULATION.md` and the dated audit artifact for the exact gap matrix. Historical evidence remains shadow-only with `recommendationAuthority: false`.
