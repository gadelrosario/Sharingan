# Waiver + FAAB decision quality

Fantasy HQ treats three related concepts as separate contracts:

> Waiver player quality is not transaction quality, and transaction quality is not FAAB price.

## Decision path

1. **Waiver candidate quality** remains owned by the existing Waiver Intelligence engine. It validates stable identity, authoritative availability, source value, role, opportunity, upside, risk, roster need, and evidence completeness.
2. **Transaction quality** evaluates one candidate against each legal drop in the current profile. It subtracts drop value and lost optionality, then adds bounded starter/flex, scarcity, replaceability, redundancy, persistent Discovery, validated injury-opportunity, and matchup context. The best defensible package becomes the recommended add/drop pair; protected assets are never eligible.
3. **FAAB price** is downstream of the selected package. It uses a percentage range of remaining authoritative budget, not a false-precision auction prediction. Missing current Yahoo budget or availability produces shadow/blocked guidance rather than a production bid.

`netTransactionValue` is deterministic and bounded from -100 to 100. Its classifications are `STRONG_UPGRADE`, `UPGRADE`, `MARGINAL_UPGRADE`, `NEUTRAL`, `DOWNGRADE`, `STRONG_DOWNGRADE`, and `INSUFFICIENT_EVIDENCE`. Missing candidate value, drop cost, or a legal drop fails closed.

## Context and authority boundaries

- **TeamFit** may describe need, starter/flex path, redundancy, fragility, and optionality. It cannot make a poor candidate actionable.
- **Discovery** may add at most bounded context for persistent, current role growth. A discovery signal alone cannot authorize an add.
- **Injury Opportunity** is bounded and only contributes when current and validated. It never fabricates recovery dates or role certainty.
- **Weekly Matchup** is limited to tie/timing context. Stale or insufficient matchup evidence contributes zero and a difficult matchup cannot erase structural long-term value.
- **Yahoo** remains the only normal-mode authority for current roster ownership and free-agent availability. A Draft Archive is immutable history and cannot authorize a waiver transaction. Sanitized demo fixtures remain shadow-only.
- **Season-only identities** can be evaluated only when Season evidence and authoritative availability support them; their Draft eligibility flags are not changed.

## Timing and budget philosophy

- **ACT** requires sufficient evidence, a meaningful net roster upgrade, and an acceptable drop.
- **WAIT** covers marginal upgrades, unresolved role or price, stale/conflicting evidence, and near-term information that can change the decision.
- **HOLD** preserves the current roster or budget when no package clears the bar. Doing nothing is a first-class decision.

Discovery Mode preserves early budget optionality and requires stronger evidence before ACT. Playoff modes allow greater spending when a validated transaction directly improves the lineup and remaining weeks reduce the value of unused budget. Difference-makers and probable starters can receive higher ceilings than speculative watches, but Chidori remains independently rare.

## Alternatives and fallback claims

Best Pick is the strongest net transaction. Best Value is a different candidate only when expected acquisition-cost evidence exists and its net improvement per cost is superior. No cost evidence means no Best Value claim.

The fallback-plan contract is advisory only: up to two ranked add/drop packages followed by HOLD. It never submits claims and never invents availability.
