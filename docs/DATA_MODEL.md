# Canonical Data Model

## Yahoo season snapshot (4.4.0 foundation, 4.4.1 presentation)

`fantasy-hq-yahoo-season-1` stores provider/fetch provenance, stable league/team keys, normalized settings with MATCH/DIFFERENT/UNKNOWN reconciliation, all-team current rosters, player identity decisions, ownership/free-agent state, optional transactions/standings/matchups, draft-linkage evidence, and membership-only roster delta. It is profile-scoped and is never recommendation authority.

Source player/team identifiers remain beside canonical Fantasy HQ identity. `AMBIGUOUS` and `UNRESOLVED` records remain visible for review and are never silently guessed.

Every entity uses a Fantasy HQ identifier matching `fhq_*`. Provider identifiers are attributes in `externalIds`; they are never primary keys.

## Entities

- **Player**: canonical ID, name, normalized position, team ID, status, external IDs, extensible attributes.
- **Team**: canonical ID, name, abbreviation, external IDs, attributes.
- **League**: canonical ID, season, settings, external IDs.
- **Manager**: canonical ID, display name, external IDs, attributes.
- **Roster**: league, manager, season, and canonical player IDs.
- **Draft Pick**: league, roster, player, overall pick, round, and selection timestamp.
- **Projection**: player, season, scoring format, metrics, and optional evidence.
- **Market Snapshot**: player, market, values, capture time, and optional evidence.
- **Expert Signal**: source, type, strength, confidence, effective window, notes, and optional player.
- **Evidence Record**: subject, metric, value, source, timestamp, freshness, confidence, reliability, and metadata.

External IDs are provider-neutral key/value entries. Convenience inputs such as `yahooId`, `sleeperId`, `fantasyProsId`, and `nflId` normalize into that map. New providers therefore require no schema redesign.

Factories validate required fields and return immutable records. Persistence is intentionally abstract at this milestone; a later repository can serialize the same contracts to SQLite or another store.
