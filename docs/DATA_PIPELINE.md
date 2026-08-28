# Intelligence Data Pipeline

## Flow

`provider payload → adapter normalize → adapter validate → canonical entity → evidence attachment → intelligence store`

Each provider implements the same lifecycle:

- `initialize()` prepares credentials or local configuration.
- `sync()` obtains a provider snapshot.
- `normalize()` maps provider fields without leaking provider IDs into canonical keys.
- `validate()` rejects malformed normalized records.
- `getStatus()`, `getLastUpdated()`, and `getConfidence()` expose operational metadata.

Jōnin 3.6 providers return mock fixtures only. They perform no network operations and use deterministic caller-supplied timestamps.

## Future API onboarding

1. Add a provider implementation without changing canonical models.
2. Store secrets outside the client bundle.
3. Capture the raw retrieval timestamp and provider identity.
4. Normalize to canonical IDs through an explicit identity bridge.
5. If strong canonical resolution fails, consult the profile-independent Season Player Registry. Only a valid stable provider/GSIS ID, supported position, valid name and season/week context, and collision-free identity may be auto-registered. Unsafe rows remain review-required or quarantined.
6. Attach accepted evidence to canonical or registered Season identities. Registration creates identity only: rank, tier, Yahoo availability, recommendation authority, and Draft eligibility remain unavailable.

7. Validate completeness and reject ambiguous identities.
8. Create Evidence Records for derived metrics.
9. Upsert approved read models through the intelligence repository.
10. Register sync cadence and health monitoring with Mission Control.

The bounded local refresh writes three last-known-good artifacts atomically: normalized evidence, its quality report, and `data/season_evidence/season_player_registry.json`. Re-imports reuse stable identities and evidence records idempotently; browser rendering never performs provider network calls or creates identities.

Raw provider payload retention, retry policy, rate limiting, migrations, and production scheduling remain future infrastructure work.
