# Player tier contract

`overallTier` is a cross-position grouping and accepts S through K plus the legacy `DST` grouping. `posTier` is a within-position grouping: QB/RB/WR/TE use S through H or `Depth`; K and D/ST use numeric tiers 1 through 3. Source-native labels such as `bdgeTier` remain source metadata and are never promoted into a player tier.

Consumers must explicitly call `getOverallTier(player)`, `getPositionTier(player)`, or `getDecisionTier(player)`. Direct chains such as `player.posTier || player.overallTier || "C"` are prohibited.

The decision tier is the existing engine's S-through-F compatibility domain. It uses a valid positional S-F tier first, then a valid overall S-F tier. If neither exists it returns C solely as a documented compatibility fallback for current scoring behavior. Overall and position accessors return `null` for unknown or invalid values; they never invent C, zero, an empty string, or TBD.

Display and explanation code should request the tier it means. Recommendation, Mamba, Mangekyō, Eternal Mangekyō, and other scoring paths continue to consume the decision tier through the legacy `tierLabel()` compatibility wrapper.

## Consumer usage

| Intent | Accessor | Example |
|---|---|---|
| Cross-position value or draft-grade explanation | `getOverallTier(player)` | “A Overall Tier” |
| Within-position depth or scarcity | `getPositionTier(player)` | “S Position Tier” |
| Recommendation state, activation, or engine-compatible display | `getDecisionTier(player)` | “S Decision Tier” |
| Source-native analyst label | Read that named source field | `bdgeTier: "Elite WR1"` |

Display code must not use `player.posTier || player.overallTier`, the reverse chain, string coercion with an invented default, or a bare “Tier” label. When compact space requires an abbreviation, `D:S` must have an accessible name of “Decision Tier S.”

`tierLabel()` remains a deprecated compatibility wrapper for scoring and decision consumers. Those consumers must not migrate until the scenario snapshots and the 249-player scoring baseline prove exact parity. Baselines are intentionally static and are never rewritten during a test run; an intentional future scoring change requires a reviewed snapshot update with player-level differences.

## Scoring-migration prerequisites

1. Preserve all thirteen representative recommendation scenarios.
2. Preserve every row of `full_pool_scoring_baseline.tsv`.
3. Report any intended difference by player and field.
4. Reconfirm Gibbs/Eternal and JSN/ordinary-Mangekyō boundaries.
5. Migrate one scoring subsystem per reviewable change.
