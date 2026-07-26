# Canonical Data Model

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

