# Fantasy HQ — Chūnin Reforged 2.8: Unity Core

This release introduces one shared intelligence cache and one canonical player evaluation used by the recommendation, Sharingan Scan, Wait Meter, Room Intel, Peek Ahead, and player displays.

## Core changes
- One canonical tier selector for every panel.
- One cached Mamba and Final Pick score per player per draft state.
- One intelligence snapshot per pick.
- Snapshot invalidation immediately after every recorded, simulated, or undone pick.
- Shared market-pressure and wait-meter values.
- BDGE and Flock remain in the source blend and source breakdown.
- Reduced duplicate calculations to improve phone performance.
