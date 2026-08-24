# Current Milestone

## Jōnin 4.4.1 — Season Command Center

Fantasy HQ now provides a profile-isolated, responsive Season Mode presentation over the
Jōnin 4.4.0 read-only Yahoo normalization and persistence foundation. Draft Mode remains
the existing authoritative draft runtime.

The governing boundary is:

- **Draft Archive = what happened** — completed picks and draft origin are immutable history.
- **Yahoo = what is true now** — current roster, ownership, transactions, standings, and matchup state.
- **Fantasy HQ = what we should do next** — future approved season decision engines; 4.4.1 does not invent that authority.

Season Mode labels TeamFit, FAAB, championship odds, projections, and weekly recommendations
as unavailable or not yet scored unless Yahoo actually supplies the field. Explicit
`?seasonDemo=1` development mode consumes a sanitized fixture, displays a prominent DEMO DATA
label, and never writes the fixture into genuine Yahoo profile state.

Planned intelligence milestones are 4.4.2 waiver/add-drop, 4.4.3 start/sit and weekly Flight
Control, and 4.4.4 trades and TeamFit. Each remains separate from this UI foundation.
