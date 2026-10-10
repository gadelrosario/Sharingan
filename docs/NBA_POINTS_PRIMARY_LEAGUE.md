# Verified primary NBA points league

Historical development record. For the final points-draft checkpoint and current setup, see [NBA_POINTS_CHECKPOINT.md](NBA_POINTS_CHECKPOINT.md).

Yahoo discovery on October 9, 2026 (Pacific) returned **Championship or Bust League**, key `478.l.219046`, game `478`, season `2026` (NBA 2026–27). The user explicitly confirmed this exact identity. User team: `478.l.219046.t.5`, THE CROSS-OVER 🙏🏼. No Elite All Stars identity, picks or roster are migrated.

## Yahoo authority

12 teams; H2H Points (`headpoint`). Scoring: PTS × 1 + REB × 1.2 + AST × 1.5 + ST × 3 + BLK × 3 − TO. Yahoo returned no scoring bonuses. Roster: PG, SG, G, SF, PF, F, C × 2, UTIL × 2, BN × 3, IL × 3. Injured slots are excluded from draft capacity (13 players). Live non-auction draft, predraft, October 10, 2026 at 3 PM Pacific, 60 seconds/pick. Draft order was not exposed and remains unknown.

The new, fully paginated Yahoo universe contains 733 players, fetched `2026-10-10T04:56:34.271448+00:00`. Current source projection metadata: September 25, captured October 7 at 06:32 UTC. Source: existing private 9cat per-game snapshot. This is not Yahoo live-draft synchronization.

## Points authority and limitations

Six exact Yahoo multipliers drive per-game points. Projected season total is per-game points multiplied by supported projected games. Missing scoring inputs, unknown modifiers or bonuses fail closed; absent values never become zero. Category z-scores are inactive in points mode. Tiers span 0.35 population standard deviations of supported points, with a one-point minimum. Best Pick uses supported points plus a bounded starter-fit adjustment within the best tier; Team Fit uses actual slot coverage and legal roster capacity. No category-punt analysis.

294 players safely match the unchanged identity rules; 291 have usable complete projections. Source points target coverage is 40/50, 86/100 and 138/156. Top-50 unmatched targets: Jalen Johnson, Anthony Edwards, Kawhi Leonard, Alperen Sengun, Cooper Flagg, Karl-Anthony Towns, Deni Avdija, Kevin Durant, Amen Thompson, Brandon Ingram. No forced matches were added. Rankings describe the supported subset, not every Yahoo player.

Cards: BEST PICK, TOP RATED, BEST VALUE, BEST AVAILABLE BY POSITION, BEST TEAM FIT. BEST VALUE is explicitly unavailable because the existing ADP source does not establish points format. Generic ADP is retained as dated context, not points-market authority. The position card uses an eligible candidate for an open starter slot where possible, otherwise the highest legal candidate.

## Persistence and operation

The bridge's `NBA_ACTIVE_LEAGUE` points to a private JSON selection with verified leagueKey, season and exact name. `NBA_BUNDLE_CACHE` points to the separately saved new-league bundle; old private files remain intact. Set both when restarting the NBA bridge. `NBA_DRAFT_CACHE` retains the existing projection snapshot. None of these private files belong in Git.

Active selection has a small `fantasyhq:nba:active:v2` localStorage pointer; normalized models and evidence live in the `fantasyhq-nba-v2` IndexedDB database, keyed by actual league and season (draft board also includes user team). Picks remain separately scoped by season/league/team. Legacy Elite caches cannot choose the active league. The large caches use IndexedDB because the existing origin approached its localStorage quota. No NFL or historical data was cleared.

Discovery supports `refresh=1` to bypass the old single-bundle discovery cache. The discovery endpoint still returns all authorized NBA leagues; only the verified primary league is active in NBA navigation. NFL selection is unchanged.

## Verification

150 focused tests passed. Browser rehearsal passed correct active league, exact formula, local ME/OTHER picks, next recommendation, roster points, undo/reset, reload persistence, unmatched-player search, desktop and 390px mobile (no horizontal overflow), and cached recovery while the NBA bridge was stopped. Rehearsal picks were reset. Exported new-league backup passed programmatic restore; browser file-import completion remains unverified due automation limitations. NFL draft recommendation/search shell remains intact; NFL auth regression tests pass. Shared presentation/CSS is unchanged by this migration.

Readiness remains partial due important unmatched targets, unavailable points-specific ADP and the unverified browser import round trip. The board is usable as a partial local draft assistant, not a complete draft ranking authority.
