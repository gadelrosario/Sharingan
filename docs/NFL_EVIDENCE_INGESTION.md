# NFL Evidence Ingestion

Jōnin 4.4.9 uses nflverse weekly player stats as its first real, provider-neutral NFL evidence feed. Jōnin 4.4.10.1 adds the separate nflverse snap-count dataset to the same normalized `SeasonEvidenceStore`. Both datasets are retrieved from official `nflverse-data` GitHub releases, licensed CC BY 4.0, and normalized locally before Fantasy HQ opens them.

## Coverage

The first adapter supplies stable GSIS identity, season/week/game context, targets, target share, carries, derived touches/opportunities, receptions, rushing/receiving yards, touchdowns, PPR fantasy production, opponent, and source provenance.

The weekly player-stat adapter intentionally does **not** supply snaps or routes. The snap-count adapter supplies offensive snaps and offensive snap share, but not routes, route participation, pass-play participation, or target rate per route. Missing families remain `MISSING`, `UNKNOWN`, or `NOT COVERED`; they are never converted to zero or healthy.

See [PARTICIPATION_EVIDENCE.md](PARTICIPATION_EVIDENCE.md) for the participation provider audit, identity crosswalk, freshness rules, and exact limitations.

## Refresh

```bash
node scripts/update_nfl_evidence.js --season 2026
```

An optional bounded week range is supported:

```bash
node scripts/update_nfl_evidence.js --season 2026 --weeks 1-3
```

The refresh downloads the per-season weekly CSV, schedule data, and provider timestamp; validates the source; resolves known GSIS IDs through `data/gsis_identity_mapping_2026.json`; writes a normalized artifact to `data/season_evidence/nflverse_latest.json`; persists safe provider-discovered identities in `data/season_evidence/season_player_registry.json`; and writes a compact quality report to `outputs/season_evidence/nflverse_quality_report.json`.

Writes are atomic. A network error, missing season asset, empty result, malformed source, or zero safe identity matches preserves the last valid artifact. App startup never contacts nflverse and never depends on provider availability.

For deterministic/offline validation, `--stats-input`, `--schedule-input`, `--timestamp-input`, and `--retrieved-at` accept local fixtures.

## Identity, time, and provenance

GSIS ID is the primary join. An approved canonical alias or unique normalized name+position may be used only as a bounded fallback. After those existing-player paths fail, a valid nflverse GSIS identity at QB/RB/WR/TE/K (or evidence-only FB) may be registered as Season-only when its name, season/week context, and collision checks pass. Ambiguous, conflicting, malformed, and unsupported identities are quarantined, never guessed.

Season registration creates identity and observation capability—not Draft eligibility or transaction authority. A registered player has no Draft rank/tier and cannot enter Draft search, recommendations, simulation, grading, Mamba, or Championship Equity. nflverse also provides no Yahoo ownership/availability, so registered players remain non-actionable until the existing profile-specific Yahoo gates independently establish league context.

Every accepted record preserves the provider player ID, Fantasy HQ canonical player ID, game ID, season, week, game-derived observation time, provider update time, retrieval/import time, source classification, identity method/confidence, raw/derived classification, and source evidence IDs. Weekly observations are append-only within the normalized artifact and idempotent in `SeasonEvidenceStore`.

Conflicting provider observations coexist and surface as `CONFLICTED`; last-write-wins and silent averaging are prohibited.

## Runtime authority

The browser loads only the validated local artifact through the existing `SeasonEvidenceStore`. Imported nflverse evidence is profile-independent and shadow/contextual in 4.4.9. It does not change Draft Mode, Yahoo state, waiver timing, FAAB, Start/Sit, TeamFit, Sharingan, Chidori, or Weekly Flight Control formulas.

Yahoo remains the source of truth for current league rosters, ownership, availability, transactions, and budgets. Draft source rankings remain separate from objective NFL evidence.

## Adding another provider

Implement the existing `EvidenceProviderAdapter`, emit the same Season Evidence schema, preserve provider-specific IDs/timestamps, fail closed on identity, and add deterministic conflict/idempotency fixtures. Do not add a parallel evidence store or provider-specific logic to Season consumers.
