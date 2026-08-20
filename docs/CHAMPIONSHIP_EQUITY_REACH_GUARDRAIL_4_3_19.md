# Jōnin 4.3.19 — Championship Equity Reach Guardrail + Production Simulation

## Status

This milestone is an offline research simulation. `recommendationAuthority` remains `false`. The browser, recommendation engine, Best Pick, Best Value, Highest Upside, Mamba, grading, CPU drafting, persistence, and league profiles do not import the guardrail.

The guardrail answers a narrow question: can validated Championship Equity evidence improve an otherwise close choice without turning upside into permission to reach?

## Simulated authority policy

| Existing value relationship | Simulated Championship Equity authority |
|---|---|
| Better expert tier/rank and stronger Championship Equity | `VALUE + UPSIDE ALIGNMENT`; confidence evidence only |
| Same expert tier | May break a tie when rank distance, Mamba gap, source-value gap, and evidence completeness all fit the stage budget |
| One tier lower | `GUARDED_REVIEW` only; never an automatic selection |
| Multiple tiers lower | `PROHIBITED_REACH` |
| Missing tier, identity, or validated evidence | Fail closed |
| QB or TE | `INSUFFICIENT_VALIDATED_SIGNAL_SET`; fail closed |

Low Championship Equity is not a negative recommendation signal. The simulation emits a zero negative adjustment for every player, including Christian McCaffrey, Saquon Barkley, Josh Jacobs, and Alvin Kamara.

## Reach budget

- `SAME_TIER_ONLY`: the only authority permitted without current 2026 ADP.
- `SMALL_GAP_ALLOWED`: one-tier `GUARDED_REVIEW`, requiring current ADP plus every roster, evidence, value, and survival condition.
- `WAIT_FOR_PRICE`: existing survival output says the player is likely to reach the user's next pick.
- `PROHIBITED_REACH`: multi-tier, missing-tier, unsupported-position, incomplete-evidence, identity-failure, open-foundation, or exceeded stage budget.

Tier equality alone is insufficient because late tiers are broad. Same-tier rank-distance limits are 4 picks early, 8 middle, 12 late, and 18 in bench-building. These are secondary safety ceilings; tier remains the primary boundary. One-tier review ceilings are 12 picks middle, 18 late, and 24 in bench-building. No one-tier review is permitted early.

## Draft-stage and roster rules

The policy reuses `championship-equity/contract.draftStage()` rather than inventing another phase model.

| Stage | Authority | Behavior |
|---|---|---|
| Early | Minimal | Same-tier only; protects foundational value |
| Middle | Moderate | Same-tier differentiation; open starters block one-tier review |
| Late | Stronger | Same-tier tie-breaks; one-tier review only if the starter foundation is complete and current ADP exists |
| Bench-building | Stronger | Prefers validated optionality over explicitly replaceable floor while preserving useful depth |

Starter counts come from the active profile. Primary League uses its 2 RB / 3 WR / 2 FLEX configuration. Straight Outta Downey uses its 1 RB / 2 WR / 2 FLEX configuration. No Primary starter count is embedded in the policy.

## Hero RB and depth safety

`valuableDepth` is distinct from `replaceableDepth`. A strong RB2/RB3 or FLEX asset remains useful when it protects an elite foundation, supplies lineup value, or preserves scarce RB optionality. The adversarial Hero-RB fixture blocks a one-tier Championship Equity review away from valuable RB depth.

The late-roster research labels are:

- `HIGH_OPTIONALITY`: complete HIGH evidence without elite/valuable-depth protection.
- `USEFUL_DEPTH`: moderate evidence, elite tier, or explicitly valuable depth.
- `LOW_OPTIONALITY`: complete LOW evidence only when the existing role is explicitly replaceable.
- `UNRESOLVED_ROLE_VALUE`: LOW evidence without proof of replaceability.
- `INSUFFICIENT_EVIDENCE`: no applicable validated score.

This prevents age or veteran status alone from creating a negative label.

## Survival and current-ADP behavior

Existing survival output is consumed, never recalculated. `LIKELY_TO_SURVIVE` produces `WAIT_FOR_PRICE`. `UNLIKELY_TO_SURVIVE` may produce an upside timing window only inside the tier/value budget.

Current 2026 ADP remains unavailable in the 4.3.18 artifact. Expert rank is not substituted for it. Consequently, every current-player case is restricted to same-tier analysis. A one-tier case can only reach `GUARDED_REVIEW` in the synthetic with-ADP fixture; it never gains automatic authority.

## 4.3.18 HIGH-profile reach cases

Likely stage is derived from expert-rank round context for reporting only. Survival is `UNKNOWN` because the 4.3.18 artifact contains no live draft survival snapshot.

| Player | Rank / tier | CE | Mamba | Likely stage | Comparison | Source-value gap | Simulated result |
|---|---:|---:|---:|---|---|---:|---|
| De'Von Achane | 9 / B | 79.7053 | 91 | Early | Jonathan Taylor | -1 | Value + upside alignment |
| Chris Olave | 27 / C | 76.1076 | 85 | Early | Drake London | 15 | Unchanged; gap not modest |
| TreVeyon Henderson | 41 / E | 86.0665 | 82 | Early | Tee Higgins | 0 | Same-tier tie-break evidence |
| Luther Burden III | 44 / E | 83.6486 | 82 | Early | Tee Higgins | 6 | Unchanged; value gap exceeds early budget |
| Brian Thomas Jr. | 62 / F | 76.6859 | 80 | Middle | Terry McLaurin | 2 | Same-tier tie-break evidence |
| Rome Odunze | 64 / F | 77.1557 | 80 | Middle | Terry McLaurin | 4 | Unchanged; gap not modest |
| Parker Washington | 71 / G | 83.0041 | 79 | Middle | David Montgomery | 4 | Unchanged; gap not modest |
| Quentin Johnston | 91 / I | 76.0789 | 76 | Bench-building | Chuba Hubbard | -10 | Value + upside alignment |
| Wandale Robinson | 97 / I | 75.8329 | 76 | Bench-building | Chuba Hubbard | -4 | Same-tier tie-break evidence |
| Ricky Pearsall | 102 / I | 78.6486 | 76 | Bench-building | Chuba Hubbard | 0 | Same-tier tie-break evidence |
| Tank Bigsby | 166 / M | 78.9241 | 73 | Bench-building | Marvin Mims Jr. | 0 | Multi-tier influence prohibited |
| Roschon Johnson | 168 / K | 77.2237 | 74 | Bench-building | Keon Coleman | 0 | Unchanged; 50-rank broad-tier gap blocked |
| Pat Bryant | 197 / O | 83.2677 | 73 | Bench-building | Jauan Jennings | 0 | Value + upside alignment |
| Elic Ayomanor | 211 / O | 91.2849 | 73 | Bench-building | Jauan Jennings | 0 | Same-tier late tie-break evidence only |

Elic Ayomanor cannot become an early-round recommendation: his policy output is confined to a same-tier, late/bench context, with no score mutation. Tank Bigsby cannot cross the multi-tier gap. Roschon Johnson demonstrates why the secondary rank-distance ceiling is necessary.

## Positive alignment and low-score protection

Bijan Robinson, Jaxon Smith-Njigba, and De'Von Achane are emitted as `VALUE + UPSIDE ALIGNMENT`. The composite may eventually strengthen explanation confidence for these cases, but it adds no recommendation points here.

The low-score report retains Alvin Kamara, Christian McCaffrey, Cooper Kupp, D.J. Moore, Josh Jacobs, Mike Evans, Saquon Barkley, Aaron Jones, and other examples. Every row explicitly says that production value remains authoritative and `negativeChampionshipEquityPenalty` is zero.

## Deterministic fixtures and counterfactual results

Fifteen fixtures cover early, middle, late, and bench-building across both profiles. They include alignment, same-tier preference, a one-tier review, a multi-tier prohibition, wait-for-price, starter-foundation protection, valuable RB depth, replaceable bench floor, unavailable ADP, unsupported TE, missing tier, an unscored rookie, and identity mismatch.

Counterfactual totals:

- 10 unchanged/aligned decisions
- 3 same-tier flips in the shadow result
- 1 one-tier guarded review (not an automatic flip)
- 8 prohibited would-be reaches
- 1 wait-for-price decision
- 2 late/bench optionality improvements
- 0 multi-tier moves
- 0 production changes

The rank-180-versus-rank-70 adversarial case is prohibited. Missing ADP, open starters, incomplete evidence, unsupported TE, an unscored rookie, identity mismatch, missing tier, and valuable Hero-RB depth all fail safely.

## Responsibility boundaries

- **Best Value:** existing rank, tier, and price logic only.
- **Highest Upside:** future home for validated Championship Equity evidence.
- **Best Pick:** existing synthesis; Championship Equity never determines it independently.

## Minimum proposed 4.3.20 authority

Start with Highest Upside evidence and late/bench same-tier Best Pick tie-breaking only. Early draft receives explanation-only alignment. One-tier cases remain `GUARDED_REVIEW`, not automatic selection. Missing ADP forces same-tier-only behavior. Survival can force `WAIT_FOR_PRICE`. Missing data, QB/TE, identity failure, and multi-tier differences fail closed. Low scores never penalize established players.

The rollback boundary should be a single feature flag that removes all Championship Equity authority and restores exact Jōnin ordering. No broad Best Pick authority is recommended.

## Reproduction

```bash
node scripts/run_championship_equity_guardrail_4_3_19.js
node tests/championship-equity-guardrail-4-3-19-tests.js
```

The deterministic artifact is `outputs/championship_equity/reach_guardrail_simulation_4_3_19.json`.
