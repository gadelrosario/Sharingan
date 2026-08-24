# Fantasy HQ Architecture

## Jōnin 4.4.1 Season Command Center boundary

Yahoo synchronization is an optional read-only boundary: browser UI → local OAuth bridge → Yahoo OAuth/Fantasy Sports. Draft Mode remains launchable without the bridge. The profile-scoped Season Command Center consumes the normalized snapshot without owning Yahoo normalization or importing draft recommendation authority. It keeps current Yahoo rosters separate from immutable completed draft archives. See [YAHOO_SYNC_FOUNDATION.md](YAHOO_SYNC_FOUNDATION.md) and [SEASON_COMMAND_CENTER.md](SEASON_COMMAND_CENTER.md).

## System boundaries

Fantasy HQ now has two deliberately separate layers:

1. The stable draft runtime owns recommendations, Mamba scoring, Fight Control, Adaptive Coaching, Draft Psychology, simulation, and presentation.
2. The Intelligence Core owns canonical contracts, source ingestion boundaries, evidence, intelligence storage, strategy signals, and data-health operations.

Jōnin 3.6 does not load the Intelligence Core from `index.html`. Nothing in the new layer can affect a recommendation until a future milestone defines, tests, and explicitly approves that bridge.

## Module map

`js/intelligence-core/index.js` is the single import boundary. Its modules are:

- `canonical-models.js`: provider-neutral entities and Fantasy HQ IDs.
- `data-provider.js`: provider lifecycle contract and deterministic mock base.
- `mock-providers.js`: Yahoo, Sleeper, odds, statistics, injury, and expert placeholders.
- `intelligence-store.js`: in-memory player and team intelligence projections.
- `expert-strategy-registry.js`: time-bounded strategy signals, separate from rankings.
- `evidence-engine.js`: source, timestamp, freshness, confidence, and reliability metadata.
- `mission-control.js`: provider health, refresh queue, and sync history.

The core currently targets Node-compatible JavaScript for tests and future server/workers. It has no package or remote dependency.

## Future integration path

An API adapter will fetch provider-native records, normalize them into canonical entities, attach evidence, and write intelligence through repository implementations. Mission Control will schedule and monitor that process. Read models may later expose approved intelligence to the draft runtime, but scoring integration remains a separate product decision.
