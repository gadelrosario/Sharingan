# Jōnin 4.4.15 — Interactive Lineup & Matchup Workspace

Season Home now supports Current Lineup, Fantasy HQ Lineup, and Custom Preview. All operations are preview-only. Yahoo lineup writes remain explicitly deferred; apply desired changes manually in Yahoo.

## Reused architecture

Yahoo normalization and SeasonCommandCenterV1 remain the roster, roster-slot, eligibility, profile, and opponent authority. `lineup-preview-v1.js` isolates a deeply frozen copy of that lineup and a disposable preview assignment. It uses the league's normalized roster-slot counts and exact Yahoo eligible-position tokens, including composite FLEX eligibility. It does not infer FLEX eligibility from a player's base NFL position.

Fantasy HQ Lineup applies only existing `seasonStartSitEvaluation` / StartSitIntelligenceV1 supported ACTION changes. It never takes the optimizer's tentative assignment or ranks players by raw projection. Each supported change must independently pass the preview validator. No change, missing evidence, or an unsupported multi-slot permutation retains the affected Yahoo starters. Recommendation weights, thresholds, Manual Authority precedence, projection freshness thresholds, and Draft behavior are unchanged.

`FantasyHQCurrentWeekEvidenceV1.outlook` calculates both baseline and preview. Final players use supported Yahoo actuals, pregame players use supported projection evidence, and unsafe live components remain unavailable. Empty slots and missing numeric/support evidence fail closed. Position Battle reuses `FantasyHQSeasonHomeV3.positionBattle` with preview starter rows and unchanged opponent rows. Its current-week projection accessor no longer falls back to a full-game projection when a safe contribution is absent.

## State and interaction

The in-memory session contains authoritative lineup, preview lineup, CURRENT/FANTASY_HQ/CUSTOM mode, profile/source signature, a notice, and at most 30 undo entries. It is never stored in localStorage or written back to normalized Yahoo objects. Reconciliation resets on profile, week, snapshot, settings, lineup, or evidence changes. Current Lineup and Reset restore the exact authoritative copy; Undo restores the prior preview assignment and mode.

Select a bench player, then a highlighted legal starter destination. The validator rejects unknown identities, incomplete slot structure, missing eligibility/game evidence, IR/ineligible players, locked players, completed players, and kickoffs already reached. The outgoing player must be allowed back onto the ordinary bench. Disabled controls explain rejected destinations. IR is displayed separately without swap controls.

Successful Sync Now clears preview history and restores the new Yahoo snapshot with a visible notice. Sync failure does not promote or persist preview state. Preview rendering and recomputation use existing local evidence and issue no provider requests.

## Consumers and boundaries

Preview consumers: both lineup panels, Current/Preview Outlook and net difference, all seven existing Position Battle groups, Start/Sit implications, and the current-week Weekly Read. Player projection labels retain source and freshness, including Sleeper Estimate. Yahoo's weekly lineup projection is separately labeled and remains authoritative-lineup-only.

Intentionally authoritative-only: the season metrics, weekly action plan, roster improvements/waiver advice, and other Season pages. Swing Players retains its existing roster-wide selection (including bench), with an explicit label; preview-specific reranking is deferred. Yahoo's legacy weekly-projection narrative is not rewritten as a preview forecast.

## Scope and limitations

Desktop uses the existing plum/charcoal two-column layout; narrow screens stack My Lineup above Matchup. No drag-and-drop, persistence, extra APIs, Yahoo mutations, or parallel scoring engine is introduced.

The MVP supports direct bench-to-starter swaps. Starter-to-starter rearrangements and multi-step optimizer permutations are conservatively retained rather than guessed. A normalized lineup missing configured slots disables swaps instead of synthesizing Yahoo assignments. Unknown or stale game evidence requires a normal Yahoo refresh. Live projected-final values are never reconstructed. There were no actually locked/completed players during the pregame Week 3 browser checks; those rejection paths are covered deterministically.

## Validation

New deterministic suites: `lineup-preview-4-4-15-tests.js` (30 cases) and `lineup-workspace-ui-4-4-15-tests.js` (8 cases), covering the requested A–T contracts plus malformed/missing evidence, empty slots, zero actuals, conservative kickoff locks, bounded history, exact eligibility, UI controls, zero preview I/O, and sync-reset notice.

Inherited suites: Season Home V3 (38), Start/Sit (17), Start/Sit decision experience (27), current-week evidence (22), Sleeper projections (35), multiple profiles (8), nested Yahoo normalization (18), Yahoo Home consumption (8). Python version/browser/Season Home/current-week/Sleeper wrappers also pass. Wrapper executions that rerun JavaScript suites are not counted again as new JavaScript cases.

Live Primary League Week 3: 16 players, 11 starters, four bench players, one separate IR player, 11 opponent starters; all three modes, legal WR and FLEX previews, disabled illegal destinations, Undo, exact Reset, source immutability, updated Position Battle, and truthful Sleeper labels verified. The morning Doubs-for-Rice test changed 125.67–131.93 to 126.05–131.93 (+0.38). A later provider refresh changed the baseline to 125.84–133.24 and the same preview to 126.13–133.24 (+0.29); neither test is a recommendation. The normal HQ result was NO CHANGE. A preview/reset cycle kept the provider request count at 19 before and after. Mobile at 390px had page width 390px and stacked panels.

A real Sync Now with the later custom lineup active restored Current Lineup and displayed: “Preview reset after Yahoo refresh. Current Lineup restored; no preview was sent to Yahoo.” Final browser state was Current Lineup. The final reload produced no application errors/warnings; six MetaMask content-script warnings remain outside Fantasy HQ. Earlier offline-server warnings were resolved by restarting the existing local server. The inherited PWA meta deprecation was fixed by adding the standard mobile-web-app-capable declaration.

Final test accounting: 211 JavaScript cases and 23 Python tests passed, zero failures. Python includes wrappers that rerun some of the listed JS suites; those JS cases are not counted twice. JavaScript syntax checks and `git diff --check` passed. No staging, commit, or push occurred.
