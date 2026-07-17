# Fantasy HQ — Jōnin 3.0: Draft Speed Hotfix

This is the current GitHub-ready build.

## What changed
- Added a canonical, versioned League State stored locally.
- Added snapshot import/export for league settings, teams, rosters, available players, transactions, matchups, standings, and waivers.
- Added a provider-neutral sync abstraction so Yahoo, Sleeper, and local snapshots can feed the same decision engine.
- Added reusable Team Strength, TeamFit, and before/after transaction simulation APIs.
- Draft picks and undos now update the canonical League State automatically.
- Added visible sync status and a Yahoo preparation control without storing credentials in the browser.
- Preserved the 2.8 Unity Core draft interface and recommendation behavior.

## Important limitation
True Yahoo OAuth syncing requires a secure backend for client secrets, access tokens, refresh tokens, and scheduled API refreshes. This static GitHub Pages build intentionally does not embed those secrets. It is now architecturally ready to consume that backend.

## Core API
`window.FantasyHQCore` exposes:
- `getState()` / `setState()` / `patchState()`
- `importSnapshot()` / `exportSnapshot()`
- `updateDraftContext()` / `recordTransaction()`
- `calculateTeamStrength()`
- `teamFit()`
- `simulateMove()`

## Deploy
Upload the contents of this ZIP to the repository root and enable GitHub Pages from the main branch/root directory.


## Jōnin 3.0 draft-speed changes

- Search fields clear automatically after a pick is recorded from search.
- Focus returns to the same search field for immediate entry of the next Yahoo pick.
- Press Escape to clear search instantly.
- Press Enter to record a player when the search is an exact name match or produces only one result.
- League DNA now reflects the selected scoring, WR, FLEX, passing-TD, and round settings instead of hard-coded text.
- The board remains configured for the 17-round Royal Rumble roster.
