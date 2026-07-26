# Adaptive Coaching Engine V1

## Purpose and architecture

The Adaptive Coaching Engine translates existing recommendation and board intelligence into one concise instruction. It does not rank players. The existing recommendation engine supplies the primary and pivot candidates; the coaching engine supplies the phase, message category, headline, instruction, and explanation consumed by Fight Control.

`recommendations and existing intelligence → AdaptiveCoachingEngineV1.buildCoachingDecision(context) → Fight Control`

The default target is always recommendation number one. V1 event overrides change the coaching message, not the target or its score.

## Output contract

The deterministic object contains `phaseId`, `phaseLabel`, `messageType`, `headline`, `instruction`, target identity, confidence, primary and secondary reasons, primary and pivot recommendation IDs, `eventType`, and `isOverride`. The UI renders this structure and does not infer strategy from raw scores.

## Coaching lenses and transitions

- **FOUNDATION:** normally rounds 1–2 while fewer than three players have been drafted. Establish an elite WR, anchor RB, positional edge, or best-value opening.
- **BUILD:** normally rounds 3–5, and allowed to extend when required skill-position starters remain open. Complete and balance the starting core.
- **BOARD CONTROL:** normally rounds 6–10. Exploit tiers, runs, position depth, and the next-turn window.
- **OPTIMIZE:** after the opening core and before the final roster spaces. Add upside and flexibility.
- **FINISH:** at two remaining roster spaces, when only K/D/ST starter requirements remain, or near capacity. Complete required and endgame slots.

These labels are coaching lenses, not rigid round names. Roster completeness can advance or delay a transition.

Examples: “Draft Justin Jefferson” in FOUNDATION; “Build the WR Core” in BUILD; “Wait one round on QB. Draft George Pickens” in BOARD CONTROL; “Raise the Ceiling” in OPTIMIZE; and “Draft a Defense” in FINISH.

## Message categories

V1 implements elite WR, anchor RB, best-value and positional-edge openings; WR/RB core completion; TE/QB starter completion; balanced build; explicit wait-on-QB; falling value; upside optimization; final starter, kicker, defense, and final-upside instructions.

Messages use a fixed priority and bounded lengths. A wait message must name the position or tactic and must name the player to draft now. PIVOT is not emitted in the opening round, and a change in top-ranked position is not itself a pivot.

## Dynamic event precedence

1. Eternal-level `OPPORTUNITY`
2. `TIER BREAK`
3. `ROOM OVERREACTION`
4. `POSITIONAL EDGE`
5. Normal phase coaching

The engine consumes the existing Eternal/Mangekyō state; it does not redefine activation thresholds. Ordinary Mangekyō does not automatically create a rare event.

## Deterministic inputs and forbidden behavior

Inputs may include pick and round, roster counts and configuration, recommendation identity, score-derived confidence, tier cliff, recent positional run, position depth, and existing Sharingan stage. Randomness, clock time, DOM measurements, external rankings, invented probabilities, and independent scoring are forbidden.

## System relationships

- **Recommendation** owns player order, scores, and the default target.
- **Fight Control** renders the coaching result.
- **Sharingan Vision** provides existing availability, cliff, run, and roster intelligence.
- **MY TEAM** remains the authoritative derived roster view; coaching only reads its counts/configuration.
- **Future league sync** can provide the same normalized context without changing the coaching contract.
