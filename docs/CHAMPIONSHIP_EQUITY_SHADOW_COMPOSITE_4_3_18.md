# Jōnin 4.3.18 Championship Equity Shadow Composite v1

## Purpose and firewall

Championship Equity Shadow Composite v1 estimates a player's validated market-appreciation profile relative to comparable players. It is not a league-winner probability, production projection, player ranking, or recommendation modifier.

The module is offline and research-only. It is not exported by the production Intelligence Core, imported by the browser, or consumed by Best Pick, Mamba, recommendation archetypes, grading, or CPU drafting. `recommendationAuthority` remains `false`.

## Frozen formulas

Every component is normalized as a 0–100 percentile within the same position and evidence season. Ties receive their average rank. The output is the weighted sum of component percentiles and therefore remains bounded from 0–100.

RB:

- 50% yards per carry
- 25% favorable age percentile
- 25% favorable year-in-league percentile

WR:

- 35% late targets
- 15% favorable age percentile
- 15% favorable year-in-league percentile
- 20% late targets × age, using the frozen 75% usage / 25% age interaction
- 15% target growth × age, using the same frozen interaction

The weights were fixed before examining current-player names. No coefficient search, optimization sweep, machine learning, player-specific tuning, or outcome-driven adjustment was performed.

TE and QB return `INSUFFICIENT_VALIDATED_SIGNAL_SET`. Promising, weak, contradictory, and unsupported metrics carry no score weight.

Score labels are descriptive research bands:

- HIGH: at least 75
- MODERATE: at least 50 and below 75
- LOW: below 50
- INSUFFICIENT_DATA: any required score-bearing component is missing

## Why the signals are present

Jōnin 4.3.17 classified RB yards per carry and WR late targets as `READY_FOR_SHADOW_COMPOSITE` across the expanded 2019–2025 evidence window. RB and WR age/year-in-league context also passed the frozen stability contract. WR late-targets × age and target-growth × age were the only ready predeclared interactions. No other feature is score-bearing.

These signals demonstrated market-appreciation discrimination. They did not establish next-season fantasy-production breakout prediction. The artifact preserves that limitation explicitly.

## Current evidence contract

The 2026 evaluation consumes only:

- 2025 nflverse usage
- static birth date and NFL entry year, evaluated for the 2026 season
- current expert rank and tier as non-scoring context

No 2026 usage exists or is inferred. No current 2026 ADP artifact is available, so `currentAdp` is null and market-headroom status is `CURRENT_2026_ADP_UNAVAILABLE`. Expert rank is shown in a separately labeled context band but is never substituted for ADP and has zero score weight.

Current coverage:

| Position | Active pool | Scored | Missing/unsupported |
| --- | ---: | ---: | ---: |
| RB | 78 | 59 | 19 |
| WR | 107 | 84 | 23 |
| QB | 34 | 0 | 34 |
| TE | 46 | 0 | 46 |

Rookies and other players without complete 2025 usage/development evidence fail closed.

## Current distribution

| Position | Min | P25 | Median | P75 | Max | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| RB | 7.03 | 38.58 | 49.72 | 58.38 | 86.07 | 5 | 23 | 31 |
| WR | 13.38 | 38.25 | 48.68 | 60.76 | 91.28 | 11 | 28 | 45 |

The distributions are not degenerate. No direct component exceeds 50%, age does not exceed usage weight, and headroom contributes zero points.

## Historical retrospective check

The frozen formula was applied without refitting to 472 historical RB/WR market transitions. Complete component coverage exists for 447.

| Position | Scored | Composite AUC | Appreciation base rate | HIGH-band appreciation rate | Positive mean | Negative mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RB | 205 | 0.7290 | 20.98% | 39.39% | 63.78 | 46.57 |
| WR | 242 | 0.7033 | 23.55% | 51.61% | 61.66 | 47.37 |

Representative HIGH hits include Brian Thomas Jr., Bucky Irving, Justin Jefferson, De'Von Achane, Chris Olave, and Amon-Ra St. Brown. Retained false positives include James Cook, Tony Pollard, and top-cost/headroom-constrained seasons for Jahmyr Gibbs and Ja'Marr Chase. Retained false negatives include Gabe Davis, Josh Jacobs, Nico Collins, Brandon Aiyuk, and DK Metcalf. The model does not hide these failures or invent explanations for them.

## Headroom and reach firewall

Market headroom is separate from football evidence and never changes the shadow score. Historical evaluations preserve actual evidence-season ADP bands. Current evaluations report headroom as unknown because current 2026 ADP is unavailable.

The inactive reach-firewall simulation permits Championship Equity to be considered as non-authoritative evidence for a same-tier tie. A modest one-tier gap is eligible only for guarded review when the shadow classification is HIGH. A multi-tier override is always prohibited. Nothing is reordered.

This highlights lower-ranked HIGH profiles such as TreVeyon Henderson, Luther Burden III, Parker Washington, Brian Thomas Jr., Rome Odunze, and Elic Ayomanor as reach-protection review cases—not draft recommendations.

## Production-context disagreements

Opening-pick Mamba and final-pick context is captured through the offline deterministic recommendation harness and never imported into the scoring formula.

- Alignment: Bijan Robinson, Jaxon Smith-Njigba, and De'Von Achane are strong in both contexts.
- Mamba strong / shadow weak: Christian McCaffrey's low market-appreciation profile reflects efficiency/career-stage inputs; it must not be interpreted as low absolute championship ceiling.
- Reach-protection review: 13 HIGH shadow profiles sit at least five Mamba points below the opening leader and outside the opening recommendation cards.

Disagreement labels are diagnostic only.

## Future mapping

- Best Value remains price/rank/tier value.
- Highest Upside may later consume validated Championship Equity evidence after a separate guarded evaluation.
- Best Pick remains the overall synthesis.

This mapping is inactive in 4.3.18.

## Decision

The RB/WR composite is interpretable, non-degenerate, retrospectively coherent, identity-safe, and isolated from production. It identifies reach-risk disagreements while retaining explicit false positives, false negatives, unsupported positions, and missing current ADP.

**READY FOR GUARDED SHADOW-TO-PRODUCTION EVALUATION** does not authorize production activation.
