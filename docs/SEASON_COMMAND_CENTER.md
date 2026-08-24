# Season Command Center — Jōnin 4.4.1

The Season Command Center is a presentation layer over `fantasy-hq-yahoo-season-1`.
It does not normalize Yahoo responses, modify a completed draft archive, or calculate a
draft/season recommendation.

## Trust contract

1. **Draft Archive = what happened.** Linked draft positions are historical, immutable context.
2. **Yahoo = what is true now.** The current roster, ownership, transactions, standings, and matchup are provider state with freshness and partial/stale labels.
3. **Fantasy HQ = what we should do next.** Until a season engine is separately validated, decision surfaces say `Not yet evaluated`, `Not yet scored`, or the applicable future milestone.

## Runtime boundary

`js/season-command-center-v1.js` builds a deterministic, profile-scoped view model from an
existing normalized snapshot. `js/app.js` renders the view with text-safe DOM construction.
Mode preference is stored per stable Fantasy HQ profile. Draft Mode retains its existing
renderer and recommendation modules.

Season Mode is available only when the profile has a mapped/synced Yahoo state or when a
developer explicitly uses `?seasonDemo=1`. The sanitized demo fixture is loaded in memory,
is visibly labeled, and is never persisted as live Yahoo truth.
