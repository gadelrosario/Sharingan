# Jōnin 4.3.20 — Limited Championship Equity Production Activation

## Purpose

Championship Equity is now an additive production evidence layer for validated RB and WR profiles. It represents historical association with market-value appreciation relative to acquisition cost. It is not a projection of absolute fantasy superiority, a replacement ranking, or a negative signal against established players.

The existing Jōnin decision engine, Mamba, tiers, roster economics, survival model, Best Value, grading, and CPU drafting remain authoritative.

## Activation boundary

One feature flag controls all production authority:

```text
championshipEquityProductionEnabled
```

The production default is ON. `ChampionshipEquityProductionV1.setEnabled(false)` is the immediate rollback path. Disabling it restores the existing recommendation order and Highest Upside category selection without stale cached influence; the application invalidates its recommendation caches when the flag changes.

If the snapshot cannot load, the bridge contains no evidence and fails closed.

## Data bridge

`data/championship_equity_2026.json` is a deterministic projection of the committed Jōnin 4.3.18 shadow artifact. Each row retains:

- active canonical player ID
- player name and position
- score and evidence band
- evidence-completeness state
- component evidence
- usage and development provenance
- explicit market-appreciation—not absolute production—semantics

The bridge distinguishes supported RB/WR evidence, incomplete evidence, missing identities, unsupported positions, and QB/TE's `INSUFFICIENT_VALIDATED_SIGNAL_SET`. Missing evidence remains `null`; it is never converted to zero.

## Highest Upside

Highest Upside remains the existing archetype. Championship Equity can nominate a supported HIGH RB/WR only when the player is already reasonably draftable relative to Best Pick:

- same expert tier
- inside the stage's rank and Mamba/value budget
- no stronger unresolved starter claim
- no valuable-RB-depth conflict
- not likely to survive to the next pick
- existing upside evidence remains within the same stage's modest-gap budget

Within that constrained set, Championship Equity is positive right-tail evidence. It does not replace the existing upside calculation or create a new card.

## Best Pick

Best Pick remains the unified Jōnin/Mamba synthesis. Championship Equity can alter the final result only through the approved same-tier tie-break after the existing engine has completed its ordering.

| Stage | Same-tier rank ceiling | Maximum Mamba/value gap |
|---|---:|---:|
| Early | 4 | 1 |
| Middle | 8 | 2 |
| Late | 12 | 3 |
| Bench-building | 18 | 3 |

The challenger must have complete positive RB/WR evidence and at least a 10-point Championship Equity edge. One-tier cases remain `GUARDED_REVIEW` with no automatic reordering. Multi-tier influence is prohibited. Current 2026 ADP remains unavailable and is not inferred from expert rank.

## Roster and timing protections

Active configuration supplies remaining starter capacity. A player with weaker starter impact cannot use Championship Equity to displace an unresolved foundation need. Primary League and Straight Outta Downey therefore retain their distinct RB, WR, and FLEX requirements.

Valuable RB2/RB3/FLEX depth remains protected when it contributes starter equity, a foundation/starter role, or documented bench-portfolio value.

Existing survival output is consumed unchanged. `LIKELY_TO_SURVIVE` produces `WAIT_FOR_PRICE`; unknown survival remains unknown.

## Low-score firewall

Every evidence result includes `negativeAdjustment: 0`. LOW Championship Equity never subtracts Mamba, player value, or final decision score. Christian McCaffrey, Saquon Barkley, Josh Jacobs, Alvin Kamara, and other established players retain their existing production evaluation.

## Recommendation-card behavior

No Championship Equity card or badge was added. Evidence can change the existing Highest Upside label or a bounded Best Pick tie only. The one-player-per-card architecture remains intact. Badge exposure is deferred because it is not required for safe production intelligence.

## Canary result

The bounded canary uses deterministic user-turn states—not full mock loops—for slots 1, 5, and 10 across rounds 1, 2, 3, 7, 13, and 16.

- 18 OFF/ON paired states
- all nine first-three-round states unchanged
- one changed state
- zero multi-tier or hard reaches
- all three completion states remained in mandatory-completion mode with K and DST recommendations

The sole ordering change occurred at slot 1, pick 61. Brian Thomas Jr. moved ahead of Jameson Williams inside tier F. The players were three expert ranks apart, tied on Mamba and source value, and Brian Thomas Jr. held a 25.6589-point Championship Equity edge. This exactly fits the middle-stage same-tier budget; no score was changed.

## Rollback

Set the single flag OFF and invalidate the application intelligence cache. Unit and application-harness tests prove the same close fixture returns to the protected incumbent and the early live recommendation snapshot returns byte-identical to its pre-activation order.
