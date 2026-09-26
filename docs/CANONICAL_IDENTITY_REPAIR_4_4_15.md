# Canonical identity repair after Jōnin 4.4.15

## Existing authority

`data/players.json` preserves the live application `id` used by Draft history and Season Evidence. `canonicalId` is a separate SQLite catalog bridge. `scripts/generate_live_pool.py` preserves an existing live ID when merging catalog metadata; catalog-only records receive `1_000_000 + canonical_id` as their live ID. See `docs/PLAYER_DATA_PIPELINE_AUDIT.md`.

Season Player Registry and Season Evidence use explicit `identity.canonicalPlayerId` / `canonicalPlayerId`, then `playerId` / `id`. Season-only records retain the existing `fhq_season_gsis_*` or provider-specific namespace. Yahoo, Sleeper, and nflverse/GSIS source IDs stay provider-qualified. Identity never depends on fantasy profile, league, week, roster order, or slot.

## Defect and repair

Yahoo normalization and Sleeper projection identity indexing preferred the SQLite bridge over the live ID. The 330 catalog rows consequently produced only 249 effective IDs: 81 collisions across 162 different players, with no legitimate same-player duplicates. The corrected namespace has 330 unique catalog IDs; adding 379 Season registry identities yields 709 unique IDs with no canonical collisions or duplicate normalized name/position records.

- Yahoo normalization now follows existing Season authority. Conflicting canonical identities fail closed. Cached Yahoo snapshots are reidentified from retained source facts in a disposable rendering view; persisted source data and Draft archives are not rewritten.
- Sleeper indexing follows that authority and quarantines ambiguous canonical/provider references. Projection attachment checks canonical identity, verified name, and provider IDs. Conflicting projection records do not resolve by last-writer wins.
- Projection cache namespace v2 and the `season-live-id-1` identity contract reject caches built with the old mapping. Freshness boundaries and scoring formulas are unchanged.
- Once ownership conflicts cleared, unresolved waiver candidates reached a previously blocked tie-break sort. Its null-safe identity comparison retains those candidates as ineligible/HOLD without changing any scoring.
- Asset URLs and service-worker cache version invalidate the affected JavaScript assets. Product milestone remains 4.4.15.

Legacy canonicalId-only inputs remain a final compatibility fallback; when a live or explicit Season ID exists it always takes precedence. No catalog, registry, Draft ID, alias table, scoring weight, FAAB rule, or Manual Authority rule is changed.

## Focused coverage

`node tests/canonical-identity-repair-tests.js` covers the full catalog/registry namespace, all three reported collision pairs, provider namespaces, same-player joins, ambiguous canonical/provider references, ownership and projection leakage, cache rejection, DST display names, waiver availability, unresolved waiver sorting, profile isolation, authoritative actuals, and preview source immutability.

Existing Yahoo, registry, evidence, projection, lineup/lock/UI, Start/Sit, waiver, TeamFit, FAAB, injury/opportunity, Discovery, and asset-version suites provide downstream regression coverage.

## Acceptance limits

Read-only browser console inspection proved the previous runtime attached other players' projection rows to Rice, Wilson, Evans, Wicks, and Pierce. Corrected browser runtime joins match each player's own source row. Pierce has no numeric projection in his own provider row and remains unavailable. Completed players still contribute Yahoo actuals, not pregame projections.

Source records lacking a deterministic identity remain unresolved and non-actionable; the repair does not guess aliases or claim complete upstream coverage. A cleared collision gate does not create waiver recommendation authority when evidence remains insufficient. Detailed live league results belong in the external diagnostic report, not this repository.
