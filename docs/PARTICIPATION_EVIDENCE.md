# Participation Evidence Foundation

Jōnin 4.4.10.1 adds objective snap participation to Fantasy HQ's existing Season Evidence Foundation. It does not add a new evidence store or any recommendation authority.

## Provider audit and selection

The selected source is the nflverse `snap_counts` release, accessed without credentials from `nflverse/nflverse-data` GitHub Releases. nflreadr documents the dataset as game-level Pro Football Reference snap counts beginning in 2012. nflverse publishes it under CC BY 4.0 and polls for new snap-count data four times daily during supported periods. Attribution is retained as **Pro Football Reference data distributed by nflverse**.

The dataset provides `game_id`, `pfr_game_id`, season, game type, week, player name, PFR player ID, position, team, opponent, offensive snaps, offensive snap percentage, defensive snaps/percentage, and special-teams snaps/percentage. Fantasy HQ deliberately imports only offensive snaps and offensive snap share for QB/RB/WR/TE/K and evidence-only FB identities.

The existing nflverse weekly player-stat release remains the source for targets, target share, carries, receptions, derived touches/opportunities, and production. Those observations remain separate and can coexist in one `SeasonEvidenceStore`.

### Routes audit

No reliable credential-free in-season 2026 route feed was found in the existing architecture. nflverse participation data from 2023 onward is supplied by FTN Data after the season and uses CC BY-SA 4.0 attribution. It is play-level participation rather than a supported in-season route-count contract for this application. Therefore 4.4.10.1 does not import or derive routes, route participation, pass-play participation, targets per route run, or yards per route run. These fields remain `null`, never zero.

## Data flow

```text
nflverse snap_counts + nflverse players crosswalk
    -> local refresh and validation
    -> PFR ID to GSIS ID reconciliation
    -> Fantasy HQ canonical/Season Registry identity
    -> normalized Season Evidence role observation
    -> Discovery and future Season consumers as context only
```

Provider rows never reach browser decision engines. The browser consumes only the bounded normalized artifact.

## Normalized contract

Each accepted record retains:

- Fantasy HQ canonical or safe Season-only identity
- GSIS ID and PFR source identity
- season, week, game, team, opponent, and game-derived observation timestamp
- provider and `snap_counts` dataset name
- provider update and local retrieval timestamps
- source evidence ID and identity confidence
- `role.offensiveSnaps`
- `role.offensiveSnapShare`
- compatibility `role.snapShare`

Missing values remain null. Legitimate zero snaps and zero share remain numeric zero. Counts reject negative or non-integer values; shares reject values outside 0–1. Routes are not inferred from offensive snaps.

## Identity and conflict safety

The adapter first resolves PFR ID through the official nflverse player directory to a stable GSIS ID. It then reuses the existing GSIS mapping and Jōnin 4.4.9 Season Player Registry. Name-only ambiguous matches are not accepted. A safe new GSIS identity may become Season-only evidence identity with `draftEligible: false` and `recommendationEligible: false`; Draft player IDs are never mutated.

Duplicate observations are idempotent. Conflicting duplicate rows are quarantined. Conflicting observations from distinct trusted sources coexist in `SeasonEvidenceStore`, produce `CONFLICTED`, and reduce downstream confidence rather than being silently averaged.

## Freshness and authority

Artifacts are season-scoped. A 2025 artifact loaded during the 2026 season is labeled `HISTORICAL_STALE`, has `currentActionableEvidence: false`, and cannot create a current ACT signal. As of September 2, 2026, nflverse returned no `snap_counts_2026.csv` asset, so the retained 2025 artifact is historical infrastructure only.

Participation evidence has no authority to establish Yahoo ownership, availability, lineup state, transactions, FAAB, Waiver ACT, Sharingan, Chidori, Start/Sit authority, Draft recommendations, Draft rankings, tiers, or Championship Equity. It can corroborate role persistence inside Discovery without changing the existing Discovery thresholds.

## Refresh

Current-season refresh:

```bash
node scripts/update_nfl_participation_evidence.js --season 2026 --current-season 2026
```

By default the script retains the latest three regular-season weeks to keep the browser artifact bounded. A specific range can be selected with `--weeks 1-3`. Offline validation can pass `--snap-input`, `--players-input`, `--provider-updated-at`, and `--retrieved-at`.

Writes to the normalized artifact, compact quality report, and Season Registry are atomic. Network failure, a missing season release, empty input, malformed provider data, or zero safely resolved rows preserves every last-valid output.

## Future extension

A future route provider must have clear access and redistribution terms, stable identity, season/week/game context, and auditable update metadata. It should feed these same normalized role fields and conflict rules. It must not create a parallel evidence store or bypass Yahoo transaction authority.
