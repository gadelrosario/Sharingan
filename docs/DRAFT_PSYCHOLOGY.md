# Draft Psychology V1

## Purpose

Draft Psychology is a deterministic intelligence layer that answers: “What is likely to happen between this pick and my next pick, and how should that affect the decision?” It explains timing around the existing recommendation. It does not rank, rescore, or select players.

## Architecture

`DraftPsychologyEngineV1.analyze(context)` is a pure module with no DOM, storage, clock, random, network, or scoring dependencies. `js/app.js` adapts live draft state into the input contract and renders the result beneath the Premium Player Card. Comparison mode deliberately continues to analyze recommendation #1.

Inputs include the current pick and round, user slot, league size, recent picks, canonical decision tiers, available players, recommendation #1, current rosters, starter slots, and manager profiles. Recommendation confidence and Mamba are accepted only as pass-through values for parity verification.

The output includes positional board temperatures, the strongest recent run, canonical tier scarcity, next-turn availability, Flight Risk, manager signals, a timing recommendation, one key insight, up to two supporting insights, snake-window facts, and data quality.

## Board temperature

QB, RB, WR, and TE use the last 3, 6, and 10 picks. The last three are weighted most heavily. Labels are COLD, STABLE, WARM, HOT, and SURGING. Two consecutive players alone cannot produce a run.

## Run detection

States are NONE, STARTING, ACTIVE, ACCELERATING, SLOWING, and ENDED. A starting run requires three of six, recent concentration, and multiple intervening managers with an unfilled starter need. Active and accelerating runs require four of six. Slowing and ended states require evidence in the ten-pick window with little or no activity in the newest window.

## Tier scarcity

Tier analysis accepts only explicit S–F values supplied through `PlayerTierContract.getDecisionTier`. It never derives a tier from rank, Mamba, a display label, or CSS. For each position it reports the current and next tier, remaining players, projected depletion before the next user pick, and LOW/MODERATE/HIGH/CRITICAL tier-drop risk.

## Availability and Flight Risk

Availability begins with the actual number of snake picks to survive and adjusts deterministically for active runs, tier depletion, board-relative rank, and round. It exposes only supported bands: 85–95%, 70–85%, 50–70%, 30–50%, 10–30%, or under 10%. These are heuristic bands, not calibrated probabilities.

Flight Risk describes the consequence of passing: no recommendation, a strong alternative path, uncertain access, likely loss, or likely tier depletion. It never selects a player and cannot override recommendation #1.

## Manager tendencies

Known manager profiles can add weak or moderate context about value behavior, reaching, consensus drafting, or quarterback blocking. Current board and roster evidence determine run and scarcity states; a profile never overrides them. Unknown profiles produce an explicit unavailable signal. Fandom is not used as a strong prediction.

## Timing and event precedence

Timing states are ACT NOW, SAFE TO WAIT, WAIT IF TARGETING ANOTHER POSITION, MONITOR RUN, EXPLOIT OVERREACTION, PROTECT THE TIER, and FLEXIBLE. Within this module, a critical tier break precedes a room overreaction, high Flight Risk, and an active run. Existing Eternal/Chidori and Adaptive Coaching presentation remains authoritative and unchanged.

## Snake turns and data quality

The engine walks actual configurable snake order to find the next user pick. It records intervening picks, unique teams, repeated selections by a manager at a turn, and user back-to-back turns. It supports 10-, 12-, and other league sizes.

Data quality is HIGH only with sufficient recent history, available canonical data, known intervening managers, and complete roster state. MODERATE and LOW outputs use restrained language. Opening and sparse states explicitly say that behavior is not established.

## Accessibility and offline behavior

Room Intelligence is textual; color is supplemental. The optional next-turn outlook uses native keyboard-accessible `details`/`summary`. Its nested surface is not a separate live region, limiting repetitive announcements and preserving focus during refreshes. The service worker caches the module and updated local assets; no remote runtime dependency was added.

## Unsupported claims and limitations

- Availability bands are deterministic heuristics, not historical calibration.
- Manager profiles do not contain enough structured history for statistical percentages.
- DST and kicker are outside V1 run detection.
- V1 forecasts tier depletion rather than simulating alternate drafts.
- User roster needs are context only; early-draft value and existing strategy remain owned by the recommendation and coaching engines.
- The strongest run is surfaced; simultaneous secondary runs remain available only through board-temperature output.

