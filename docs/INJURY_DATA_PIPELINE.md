# Injury data pipeline

Fantasy HQ uses the public Sleeper NFL player endpoint as its primary free status feed. Sleeper is fetched no more than once per day and the normalized snapshot is cached locally. A manual refresh is available from League Sync Foundation and through `refreshInjuryDataNow()`.

The adapter maps a Sleeper player to a Fantasy HQ player only through an existing Sleeper ID or one unique exact normalized name-and-position identity. Ambiguous identities are quarantined. Source and canonical teams are stored separately so team disagreement does not silently change identity.

An empty response, a response with no safe matches, or a network failure never replaces a valid cache. The last valid snapshot is retained and marked stale. Without a valid record, the player remains `UNKNOWN`; absence of an injury flag is not independently treated as medical verification. Sleeper's explicit `status: Active` is mapped to `ACTIVE` with Sleeper provenance.

The command-line refresh is:

```sh
node scripts/refresh_sleeper_injuries.js
```

The output is written atomically to `data/injuries_2026.json`. If refresh fails, the existing file is unchanged.

## ESPN supplemental adapter

ESPN does not publish a documented, supported public NFL injury API. `ESPNInjuryAdapterV1` therefore isolates the commonly observed internal endpoint behind a fail-soft, opt-in adapter. It is not called during startup and is not a canonical identity source. If supplied, ESPN reports are preserved alongside Sleeper reports. Conflicting known statuses set explicit disagreement metadata; deterministic freshness and reliability precedence chooses the decision status without deleting either report.
