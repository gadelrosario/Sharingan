# Player-data pipeline audit

## 232-player reconciliation update

On 2026-07-18 the audit was rerun against the intentionally expanded working
database (232 active draftable players) and the current 264-record production
JSON. Remote `main` remained at `a707fed` and was already an ancestor of this
branch, so no history rewrite was required.

The generator now performs an explicit union keyed by normalized canonical
identity across the current database and existing JSON. A documented
`data/team_patch_2026.csv` may fill a blank team only when its row includes a
team, confidence, notes, and the patch path as provenance. It never overwrites a
non-blank live team. The generator writes by default to
`outputs/player_audit/players_review_232.json`; neither production input is
written.

Current reconciliation results:

- canonical database: 232;
- production JSON input: 264;
- temporary review JSON: 264;
- canonical identities represented: 232/232;
- unexplained canonical exclusions: 0;
- position counts: QB 34, RB 59, WR 74, TE 33, K 32, DST 32;
- duplicate normalized identities: 0;
- ID collisions: 0;
- missing teams in temporary output: 0.

The database itself still has 20 active draftable rows with `nfl_team` null:
Jordan Love, Malik Willis, Sam Darnold, Cam Ward, Daniel Jones, Fernando
Mendoza, Jacoby Brissett, Kenneth Walker III, Travis Etienne Jr., Jonathan
Brooks, Chris Rodriguez, Oronde Gadsden II, Mark Andrews, Juwan Johnson,
Chigoziem Okonkwo, Kenyon Sadiq, Dalton Schultz, T.J. Hockenson, AJ Barner, and
D.J. Moore. Their live records already contain documented reconciled values, so
the current run did not need to apply or guess a patch value. The database was
not changed.

Luther Burden III is canonical ID 122 (`luther-burden-iii-wr`). Historical
backups contain live IDs 46 and 155. ID 46 carries the substantive BDGE/Flock
analysis and earlier overall rank; no persisted repository draft history refers
to ID 155. The reconciler therefore preserves ID 46, fills only missing,
non-conflicting fields from ID 155, and emits one canonical identity. Current
production JSON already reflects that resolution. A regression test reconstructs
the two-record input and verifies ID 46, the richer analysis, and the unique
depth-only field all survive.

Machine-readable results are in
`outputs/player_audit/pipeline_generation_report_232.json`.

Audit branch: `audit-player-data-pipeline`  
Canonical snapshot audited: `database/fantasyhq.db.backup.20260718T200921Z.sqlite`
(134 players, before the pre-existing working-tree database mutation)  
Live artifact audited: `data/players.json` (249 players)

## Root cause

There was no code path from the canonical SQLite database to `players.json`.
The live file predates the backend and was committed as a separately assembled
ranking list. Its `fantasyland`, `bdge*`, `flock*`, and `fantasyPros*` fields
show that one list supplied the population and other sources enriched only
players already in that list. Consequently, absence from the population source
acted as an undocumented inner join/cutoff even when BDGE or Flock ranked the
player. `scripts/export_master.py` exported every database player to CSV with
LEFT JOINs, but nothing converted that export to the live JSON.

That explains the reported examples:

- Mark Andrews: canonical ID 89; BDGE TE19 and Flock TE15; absent from JSON.
- Jordan Love: canonical ID 17; BDGE QB16 and Flock QB18; absent from JSON.
- Travis Etienne Jr.: canonical ID 47; present in JSON as `Travis Etienne`
  with live ID 41, so the canonical identity/display name was lost even though
  the player remained draftable.

No SQL `WHERE`, status rule, position rule, or documented draftability cutoff
excluded these players. The effective filter was membership in the independently
maintained JSON population. Git history confirms `players.json` was edited as a
data artifact in commits predating the backend; no generator was committed.

## End-to-end trace (before repair)

1. CSV templates under `imports/<source>/` are optional input files. The checked
   in templates contain headers only.
2. `scripts/import_csv.py` canonicalizes `name + position`, upserts `players`,
   then writes expert data for BDGE/Flock/Fantasyland or market data for the
   remaining sources. Blank names/positions are skipped. There is no rank cutoff.
3. SQLite stores canonical identity in `players`; rankings, ADP, projections,
   schedule data, and HQ scores are child tables.
4. `player_master_view` and `scripts/export_master.py` start from `players` and
   LEFT JOIN 2026 source rows. `export_master.py` additionally restricts HQ
   scores to model `v1-expert-only`. It groups by player ID and exports CSV.
5. No pre-audit step produced `players.json` from either SQLite or that CSV.
6. `js/app.js:init()` fetches `data/players.json` directly. The interface filters
   only drafted players, selected position, and search text; it sorts by
   `overall` (missing values last) and shows at most 55 rows without a query or
   80 with a query. Those display cutoffs do not explain absence from the file.
7. Draft removal and lookups use JSON `id`, so changing existing IDs would break
   saved/history identity semantics.

## Repair

`scripts/generate_live_pool.py` makes the canonical `players` table the
population source. Source tables are LEFT JOINed with season/scoring predicates
in their `ON` clauses. Inclusion requires only active status and one supported
position (`QB`, `RB`, `WR`, `TE`, `K`, or `DST`), never a ranking row.

The existing JSON is used as enrichment:

- matched players retain the live `id` and every existing Fantasy HQ field;
- `canonicalId` and `canonicalKey` bridge the two identity systems;
- canonical display names are restored without changing live IDs;
- canonical-only players receive deterministic ID `1,000,000 + canonical ID`;
- absent ranks, tiers, ADP, HQ fields, team, and bye are emitted as `null`;
- the default output is `players_generated.json`, keeping deployment explicit;
- the generator performs no database writes and no silent deduplication.

## Canonical comparison and classification

Seventeen of 134 canonical identities were absent from the 249-record JSON.
All 17 are active, supported-position players with partial ranking coverage, so
all are classified `missing_legitimate_draftable`:

| Position | Missing canonical players |
| --- | --- |
| QB | Jordan Love; Malik Willis; Sam Darnold; Cam Ward; Daniel Jones; Fernando Mendoza; Jacoby Brissett |
| RB | Jonathan Brooks; Chris Rodriguez |
| TE | Oronde Gadsden II; Mark Andrews; Juwan Johnson; Chigoziem Okonkwo; Kenyon Sadiq; Dalton Schultz; T.J. Hockenson; AJ Barner |

Travis Etienne Jr. is classified present by normalized identity, with a
canonical-name mismatch repaired in output. The machine-readable classification
for every canonical player is in
`outputs/player_audit/pipeline_generation_report.json`.

## Counts and unresolved issues

- Before: 249 live records.
- Canonical: 134 records.
- Missing canonical identities before: 17.
- After: 266 records.
- Canonical identities missing after: 0.
- Unresolved intentional exclusions: 0.
- Missing team values: 17 canonical draftable players. These remain `null`
  because the canonical snapshot has no team value and inventing one is unsafe.
- Pre-existing duplicate: live IDs 46 and 155 both identify Luther Burden III.
  The exporter reports/preserves this rather than selecting a winner without an
  authoritative identity decision.
- Pre-existing working-tree mutation: `database/fantasyhq.db` contains 232
  players, while the unmodified snapshot contains 134. This audit did not write
  either database and used the snapshot for before/after evidence.

## Tests

`tests/test_generate_live_pool.py` uses a temporary SQLite database and proves:

- Mark Andrews, Jordan Love, and Travis Etienne Jr. remain present when ranking
  coverage is partial or absent;
- missing rankings are `null`;
- Travis retains live ID 41 and arbitrary Fantasy HQ analysis fields;
- new IDs are deterministic and independent of rank order.

The focused tests pass. The complete unittest discovery run is documented in
the review handoff, including pre-existing failures caused by the already
expanded working database and its candidate-import fixtures.
