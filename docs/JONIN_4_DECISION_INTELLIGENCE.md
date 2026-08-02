# Jōnin 4.0 Decision Intelligence and Draft Reliability

Jōnin 4.0 makes draft state durable and evaluates decisions as roster outcomes rather than presenting one opaque player score.

## Draft reliability

`draft-session-v1.js` owns one versioned active-draft record. It stores board history, drafted IDs, the current pick, recommendation IDs, manager assignments, league and roster settings, decision snapshots, and loaded ranking fields. A write occurs after every successful pick and undo. Completed drafts use `status: complete` and are no longer resumable.

The setup screen never overwrites an active record implicitly. It offers Resume Draft and Start New Draft; replacement requires confirmation. Resume validates duplicate player IDs and pick numbers before hydrating state. `beforeunload` and history-navigation guards protect an active draft. The timeline is derived from authoritative pick history, so undo and corrections cannot diverge from the board.

The Scroll notebook is a separate single plain-text local-storage record. It has no formatting, folders, or recommendation influence.

## Four-score decision model

`jonin-decision-intelligence-v1.js` is deterministic and data-source independent:

- Player Value measures talent and market value without roster need.
- Roster Fit compares team strength before and after the pick.
- Opportunity Cost measures tier depth, room pressure, survival risk, and the next tier drop.
- Expected Future Value estimates replacement quality at the next selection.

The synthesized championship score weights those four outputs. An eight-point pure-value separation is the elite-value safeguard: roster fit may settle close calls but cannot replace an obvious talent advantage. The UI exposes Recommended Picks, Best Value, and Best Team Fit as separate answers.

## Talent, environment, strategies, and evidence

Offensive Environment is separate from Player Value. It consumes only fields present on the player record; missing inputs remain `UNAVAILABLE` and never become invented neutral data. The record lists contributing fields and coverage-derived confidence.

Fantasy HQ, Gerard, Fantasyland, and BDGE are pluggable advisory modules. They emit named strategic signals, not replacement rankings. Existing Intelligence Core providers remain browser-isolated.

Every new metric supports value, source, timestamp, confidence, and `Verified`, `Likely`, `Conflicting`, or `Unknown`. Adjustment is minor after one sustained week, moderate after two, and major after three; structural injury, trade, or coaching changes may justify an immediate major adjustment. Outcomes never self-train the model.

## Draft evaluation 2.0

Post-draft grading compares every team in the room across value, construction, ceiling, floor, consistency, risk control, playoff outlook when available, positional advantage, and draft efficiency. Missing playoff data is excluded and reported honestly. Championship probabilities are normalized across the room, and at most one A+ can be awarded in a ten-team draft.

## Boundaries

The canonical player ID remains primary. No external API was added. No player data, Mamba formula, Sharingan threshold, simulation behavior, or canonical database was modified.
