# Fantasy HQ persistence boundary

Fantasy HQ persistence is classified by data size and update frequency rather than by sport or provider.

## Tier 1 — lightweight local state

Small configuration and pointers are appropriate for `localStorage`: active profile, explicit provider mapping, schema/version metadata, sync timestamps, UI preferences, and compact status.

## Tier 2 — structured datasets

Season snapshots, player pools, league rosters, ownership maps, transactions, injuries, and historical checkpoints are structured datasets. Yahoo Season currently uses a compact `localStorage` implementation behind `FantasyHQYahooSeason.createStore()` as a transitional backend. Consumers use the store's `read`, `write`, `update`, `remove`, and `estimate` semantics rather than accessing a physical backend directly.

The current authoritative snapshot remains available as `state.snapshot` for backward compatibility. Historical full snapshots are replaced by provider-, sport-, season-, profile-, and league-scoped compact checkpoints. Checkpoints are count- and byte-bounded.

## Future IndexedDB migration

A future adapter can move Tier 2 records into IndexedDB stores such as `seasonSnapshots`, `seasonCheckpoints`, `playerPools`, `transactions`, `injuries`, and `leagueDatasets`. The lightweight local record can then retain configuration and dataset pointers. Season Mode should continue consuming the same persistence semantics and `state.snapshot` compatibility view, so NFL providers and future NBA daily state do not require business-logic rewrites.

The current sprint intentionally does not migrate unrelated Draft, completed-draft, or injury stores.
