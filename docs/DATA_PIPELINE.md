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
5. Validate completeness and reject ambiguous identities.
6. Create Evidence Records for derived metrics.
7. Upsert approved read models through the intelligence repository.
8. Register sync cadence and health monitoring with Mission Control.

Raw provider payload retention, retry policy, rate limiting, migrations, and production scheduling remain future infrastructure work.

