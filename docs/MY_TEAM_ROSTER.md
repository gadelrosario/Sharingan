# My Team roster contract

The live panel is a derived view of the existing draft history. It does not own roster state and never writes slot information onto player records.

`buildRosterSlots(leagueContext)` remains the source of configured slots. The current defaults are one QB, two RB, three WR, one TE, two non-superflex FLEX, one K, one D/ST, and six bench slots. IR and superflex are not represented by the active settings.

`RosterViewV1.assignSlots()` is the canonical display assignment:

1. Drafted players fill configured dedicated starter slots in draft order.
2. Remaining RB, WR, and TE players fill FLEX in draft order.
3. Every remaining player, including an unresolved legacy ID, fills bench in draft order.
4. Players beyond configured bench capacity remain visible in an Unassigned group.

K, D/ST, and QB are never FLEX eligible. Assignment is recomputed after state changes and returns new row objects; input players are not mutated. Recommendation roster-needs and final-grade assignment remain separate scoring systems and were intentionally not changed in this sprint.

The current application exports saved mocks but does not provide an active saved-mock restore command. League snapshot import updates `FantasyHQCore`; it does not hydrate draft `history`. The pure assignment contract guarantees identical IDs produce identical slots once a future reviewed restoration path supplies those IDs, but this sprint does not silently merge the two state stores.
