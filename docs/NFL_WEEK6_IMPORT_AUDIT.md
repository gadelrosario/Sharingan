# User-provided 2026 Week 6 NFL rankings

This release preserves the supplied transfer package, not independently verified current NFL data. The user clarified on 2026-10-20 that the scope is **current_expert_consensus**, as of **2026 Week 6**. These are not Week 6 matchup rankings and are not explicitly ROS rankings. Exact source snapshot date and scoring format remain **unknown**. Original source files are unchanged; the clarification is separately recorded in snapshot metadata. ZIP modification times are not used as source dates.

| Dataset | Rows retained |
| --- | ---: |
| Overall | 365 |
| QB | 53 |
| RB | 108 |
| WR | 147 |
| TE | 57 |
| K | 38 |
| DST | 32 |
| Total | 800 |

Overall contains 364 complete rows and one truncated Tyrod Taylor row retained without invented position or statistics. Positional files contain rank/name data only. Their statistics, tiers, movement and individual expert values remain null. TE Avery Huffman, Expert Average and Zach Savage are independent nullable fields. Neither RB RYDS auxiliary column exists in this package; rushing/receiving yards are not reconstructed. The Overall ordering header is preserved as “Expert Average”; it supplies no separate numeric average, so the ordinal overall rank is not copied into an invented expert-average value. Numeric zero, negative numbers, missing dashes and text such as INJ remain distinct.

## Identity and disagreements

- 717 matched rows representing 392 unique canonical application IDs.
- Four ambiguous Kyle Williams rows (two in Overall, two in WR) quarantined.
- 79 unresolved rows quarantined; the complete names, ranks and reasons are in `NFL_WEEK6_IMPORT_AUDIT.json`.
- All 32 defenses resolved by exact full franchise name against existing canonical D/ST records.
- 502 rows have an existing unambiguous Sleeper reference; two have an existing Yahoo reference. Remaining provider IDs are null. Canonical matching is not a claim that both provider IDs were verified.
- 47 Overall-list versus positional-file rank disagreements retained independently.
- 35 source/canonical team disagreements retained as source observations; canonical teams and Yahoo rosters are not changed.

The source supplies no stable IDs. Resolution reuses `FantasyHQYahooSeason` with unique normalized name + position, existing approved aliases and canonical-collision rejection. It validates available provider mappings with the existing Sleeper identity index. No fuzzy matching, suffix guessing, new Yahoo collection, provider ID invention or cross-namespace numeric matching occurs. Duplicate source names are quarantined before resolution, even if only one catalog match exists.

The JSON audit lists missing statistical-field counts per dataset, duplicate rows, unmatched identities, conflicting ranks and unexpected teams. The seven source hashes and original text/CSV files make the import reproducible.

## Integration and precedence

The optional `NFLExpertRankingsV1` snapshot adapter adds context to existing Season roster rows, available-player rows, player records and Start/Sit comparison cards. The available-player browser has an explicit expert-order option; overall rank sorts across positions, while the selected position's own dataset sorts within that position. Missing or quarantined ranks sort last. Default browsing order remains unchanged.

The imported rankings do not replace the active preseason draft snapshot. The clarified consensus contributes ordinal roster valuation, one-for-one trade comparison evidence, and secondary ordering of otherwise identical weekly waiver evaluations. There is no numeric rank-to-value or rank-to-points formula. Unknown scoring prevents a claim of half-PPR compatibility. No ROS score, trade-package total or new transaction authority is produced. The trade view reuses existing controls and presents consensus comparison evidence, not an automatic accept/reject decision. Source FPTS and positional finishes are labeled separately from weekly projections. Injured players gain no starting authority, and Yahoo ownership, half-PPR scoring, projection freshness, lineup locks and safe-drop gates are unchanged.

## Reproduce and validate

```sh
node scripts/import_nfl_week6_rankings.js
node tests/nfl-expert-rankings-tests.js
git diff --check
```

The current focused import suite passes 44 tests, including deterministic regeneration, null handling, conflicts, defense identity, collision rejection, provider namespaces, scope/scoring gates, NBA exclusion and asset wiring.

The initial v1 working-tree regression selection passed 825 tests/assertions across 30 suites, including those 30 initial checks, Yahoo sync/OAuth fixtures, Sleeper/canonical identity, weekly recommendations, lineup locks/previews, NFL proactive behavior and NBA points draft checks. One pre-existing Python worker shutdown test timed out on the first run; the unchanged 73-test Python NFL suite passed on rerun.

Browser acceptance used actual application rendering functions and CSS with the imported snapshot in an isolated fixture with synthetic availability and no provider requests. Default order, explicit expert order and player-detail disclosure work. At 390px, the document width remains 390px. No CSS or NBA files were changed. An isolated export of committed dependencies plus only the intended release changes also passes the 30 import tests and 18 canonical-identity tests; it does not require the uncommitted proactive modules.

Only this import, adapter, UI integration, cache wiring, focused tests and report belong to the checkpoint. Prior proactive-intelligence changes, local Yahoo/debug data, screenshots and caches remain uncommitted. No push or deployment is authorized.

## Consensus clarification checkpoint

- Snapshot version `user-nfl-2026-week6-v2`; all 800 imported rows, quarantine decisions, provider references, source hashes and statistics preserved. Only row scope changes.
- Roster and trade comparisons use overall and same-position rank order independently. Opposing preferences produce MIXED, never an averaged compromise. Missing or quarantined identities produce UNAVAILABLE. Teams for trade comparisons come only from the selected league snapshot.
- Conservative influence is lexicographic: consensus can break ties only among WATCH comparisons with exactly equal positive weekly difference, action, position, existing need classification/priority and protection state. All existing action, score, projection, protection and FAAB values remain unchanged. Different primary evidence never loses to consensus. No numeric weight is invented.
- Stale/failed sync leaves waiver results unchanged; a Week 6 snapshot cannot inform an earlier-week decision. Weekly Start/Sit calculations are unchanged.
- Current targeted regression selection: 547 tests/assertions pass, including 44 consensus/import checks, NFL recommendations, Yahoo sync/OAuth fixtures, canonical/Sleeper identity, lineup locking and NBA draft regressions.
- Remaining limits: exact source date and scoring compatibility unknown; 79 unresolved and four ambiguous rows remain quarantined; current consensus does not establish weekly or ROS projected points, numeric trade value, safe removal or FAAB authority.
