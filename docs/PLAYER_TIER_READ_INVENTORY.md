# Player tier read inventory

This inventory covers every repository file containing `posTier`, `overallTier`, or `tierLabel(` after Sprint 2.

## A. Display and explanation

- `js/app.js`: `sourceTierSummary`, `tierBadge`, `rationale`, player scan explanations, scan alternative metadata, Fantasyland source label, team tier summary, roster rows, quick-pick rows, and available-player rows. These now use explicit accessors; compact roster and quick-pick labels use accessible `Decision Tier` context.
- `js/jonin-insight-engine-v1.js`: explanation and opportunity-window tier selection uses overall tier first, then position tier, through the contract.
- `js/sharingan-vision-v1.js`: forecast/explanation tier selection uses overall tier first, then position tier, through the contract.
- `js/command-center-v1.js`: `generateExplanation` uses explicit overall/position accessors. Scoring functions in the same file are intentionally excluded below.

## B. Scoring and decision — intentionally unchanged

- `js/app.js`: `tierLabel`, `getPlayerEvaluation`, `positionTierCounts`, `rosterFitModifier`, `valueOverride`, `eternalValue`, `getRoomBoost`, `mambaScore`, recommendation snapshots, wait/tier counts, grading calculations, Yahoo export snapshots, and Sharingan stage inputs.
- `js/command-center-v1.js`: value, scarcity, urgency, and recommendation scoring retain their original raw ordering and C fallback.
- `tests/recommendation-baseline-harness.js`: reads the live scoring functions rather than duplicating them.

## C. Import and validation

- `scripts/generate_live_pool.py`: creates null tier fields for canonical-only fallback records and preserves source tiers.
- `scripts/validate_player_tiers.js`: exhaustive read-only contract diagnostics.
- `js/player-tier-contract.js`: the domain definitions, normalizers, fallback, and diagnostic implementation.

## D. Tests and fixtures

- `tests/player-tier-contract-tests.js`, `tests/test_player_tier_contract.py`: contract and parity fixtures.
- `tests/command-center-tests.js`, `tests/jonin-insight-tests.js`, `tests/sharingan-vision-tests.js`, `tests/test_flight_control.py`: subsystem fixtures and boundary assertions.
- `tests/fixtures/recommendation_scenarios.tsv`, `tests/fixtures/full_pool_scoring_baseline.tsv`: immutable behavior baselines.

## E. Data definitions and legacy artifacts

- `data/players.json`: the 249 committed runtime player definitions; unchanged.
- `assets/index-Dg9P75b4.js`: legacy compiled artifact, not the script loaded by current `index.html`; unchanged.
- `index.orig.html`: legacy HTML copy; unchanged.
- `DRAFT_COMMAND_CENTER_V1.md`: historical examples/documentation; unchanged.

Import CSV templates use the source-native column `tier`, not runtime `posTier` or `overallTier`: `imports/bdge/bdge_template.csv` and `imports/flock/flock_template.csv`.
