# NFL waiver materiality validation

These are **provisional conservative materiality thresholds**, not empirically validated optimal cutoffs. They filter small projection differences; they are not calibrated probabilities, rest-of-season valuations, transaction authorization, or FAAB advice. This review does not change thresholds, weights, roster-need definitions, or ordering.

- WATCHLIST: difference >= 2 points AND difference / denominator >= 0.20.
- PRIORITY TARGET: difference >= 4 points AND difference / denominator >= 0.30, plus the existing roster-need condition and a non-questionable candidate.
- Otherwise NO ACTION, or WATCHLIST when only the WATCHLIST criteria pass.
- Existing denominator: `Math.max(1, Number(comparison.rosterProjection.value))`. Only positive finite baselines enter materiality evaluation. Zero and negative projections remain unchanged in source comparisons but yield NO ACTION; positive baselines below one retain the existing denominator floor. This is a policy ratio.
- Existing roster need includes unavailable/questionable starters or the implemented future-bye shortage. Tests do not expand that definition.

## Deterministic synthetic test matrix

Run `node tests/waiver-materiality-boundary-tests.js`. No network or real league data.

| Cases | Baseline | Edges | Expected | Result |
|---|---:|---|---|---|
| WATCH absolute below / exact / above | 5 | 1.999 / 2 / 2.001 | NO ACTION / WATCHLIST / WATCHLIST | 3 pass |
| WATCH percentage below / exact / above | 20 | 3.999 / 4 / 4.001 | NO ACTION / WATCHLIST / WATCHLIST | 3 pass |
| Only one WATCH gate passes | 20 / 5 | 3 / 1.9 | NO ACTION | 2 pass |
| PRIORITY absolute below / exact / above, need present | 10 | 3.999 / 4 / 4.001 | WATCHLIST / PRIORITY TARGET / PRIORITY TARGET | 3 pass |
| PRIORITY percentage below / exact / above, need present | 20 | 5.999 / 6 / 6.001 | WATCHLIST / PRIORITY TARGET / PRIORITY TARGET | 3 pass |
| Both strong gates, without / with need | 20 | 6 | WATCHLIST / PRIORITY TARGET | 2 pass |
| Only one strong gate passes, need present | 5 / 20 | 3.9 / 4 | WATCHLIST | 2 pass |
| Production evaluator missing/invalid baseline | null, undefined, empty, invalid, NaN, Infinity | — | No comparisons | 6 pass |
| Production evaluator verified zero/negative baseline | 0 / -1 | 12 / 13 | Preserve source; NO ACTION materiality; no ADD | 2 pass |
| Production evaluator missing candidate projection | null, undefined, empty, NaN | — | No invented edge | 4 pass |
| Strongest bench, classification priority, descending edge, stable ties | synthetic candidates | — | Existing ordering retained | 4 pass |
| Unresolved identity, unsupported projection, locked or ineligible candidate | apparent 100-point projection | — | Rejected before ordering | 4 pass |
| Locked bench | — | — | No comparison | 1 pass |
| Exported helper null/empty baseline | null / empty | 4 with need | NO ACTION | 2 pass after guard |
| Exported helper missing projection record | absent | 4 | NO ACTION | 1 pass after guard |

Original matrix: **42 passed, 0 failed** after the guard. Fifteen additional malformed-value/difference cases bring the total to **57 passed, 0 failed**. The zero/negative-baseline expectations explicitly follow the latest user requirement; their previous WATCHLIST expectation is intentionally replaced with NO ACTION. Equal ties preserve input order; no new tie-break rule is introduced.

## Targeted correction

The exported helper now rejects absent/malformed projection records, missing/non-numeric/non-finite/non-positive baselines, and missing/non-finite differences before coercion or division. It returns the existing NO ACTION object shape, with priority zero and need false. Valid positive-baseline behavior, thresholds, roster-need rules and ordering are unchanged.

The production evaluator already rejected missing/non-finite source values upstream. This guard closes the direct-helper gap and, as explicitly requested, withholds materiality classifications for zero/negative baselines. Source projection values and transaction restrictions remain intact.

## Other focused validation

- nfl-season-proactive-tests: 31/31
- nfl-proactive-intelligence-tests: 28/28
- nfl-proactive-sync-tests: 6/6
- week7-readiness-tests: 10/10
- waiver-current-week-contract-tests: 51/51

126 existing focused checks passed.

The unmodified HEAD rankings suite still reports 42/44 with these exact pre-existing failures:

1. `deterministic rebuild exactly matches artifacts`
2. `asset references cache new module and snapshot`

These were rerun in the isolated HEAD archive, with relevant source files byte-compared against HEAD. No ranking artifacts or legacy asset assertions were repaired.

## Commit boundaries

Foundation includes the proactive modules, sync/readiness/waiver integration, base Action Center renderer/styles, asset references, focused tests and this document. Presentation builds on that foundation with the reviewed scoreboard, roster grid, featured/expandable alert cards and responsive styles. Optional durable backend/worker infrastructure remains excluded; the UI defaults to memory mode with durable access disabled. Test fixtures are clearly labeled synthetic and are not loaded by the production entry point. Private snapshots, credentials, debug files, screenshots and caches are excluded.
