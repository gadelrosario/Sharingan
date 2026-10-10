# NBA points draft checkpoint — October 10, 2026

This is the current operating guide. Earlier NBA draft, primary-league and coverage
notes preserve the development history; their earlier counts/layouts are superseded.
No application functionality changed during checkpoint preparation.

## Verified implementation

Championship or Bust League (Yahoo 478.l.219046), 2026–27, 12-team H2H Points.
Yahoo supplies league identity, eligibility, ownership, slots and six multipliers:
PTS + 1.2 REB + 1.5 AST + 3 ST + 3 BLK - TO. No category scoring or invented bonus
enters points mode. Full universe: 733; safely matched: 344; complete projected
points: 340. Source-order coverage: 50/50, 100/100, 154/156. Cam Spencer and Jay
Huff remain explicitly unranked because projected games are missing.

The default board loads 25 ranked available players, with batches of 25 more.
Search covers the entire universe. Rows have direct ME/OTHER actions, Yahoo
positions, rank, tier, projected points and source/date. Identical recommendation
leaders share one card with signal badges. BEST VALUE remains unavailable without
points-format market evidence; uncertain numeric ADP is suppressed. The roster
assignment engine is unchanged. Empty local history collapses; picks expand a
chronological history. Official Yahoo draft order and live pick synchronization
are unavailable. Actual picks must still be made in Yahoo.

## Reproduce locally without committing private data

Serve the repository using the existing static-server workflow, for example
`python3 -m http.server 8000`, and retain the existing trusted local HTTPS bridge
configuration. The browser expects the NBA bridge at https://localhost:8788.
Reuse the configured Yahoo OAuth/TLS environment; never add its credentials,
certificates, tokens or private JSON snapshots to Git.

The bridge needs three external private inputs:

- `NBA_ACTIVE_LEAGUE`: JSON selection with `leagueKey`, `season` and exact `name`,
  obtained from verified discovery and confirmed selection.
- `NBA_BUNDLE_CACHE`: complete Yahoo NBA bundle for that same league and season.
- `NBA_DRAFT_CACHE`: validated current preseason projection snapshot produced by
  `api/nba_draft_snapshot.py` from the existing permitted manual HTML capture.

Example with placeholder paths, using the existing private environment file:

```sh
NBA_ACTIVE_LEAGUE=/path/to/private/nba/active-league.json \
NBA_BUNDLE_CACHE=/path/to/private/nba/yahoo-bundle.json \
NBA_DRAFT_CACHE=/path/to/private/nba/draft-evidence-2026.json \
PYTHONDONTWRITEBYTECODE=1 python3 api/yahoo_auth_bridge.py \
  --env-file /path/to/private/yahoo.env --port 8788
```

A fresh checkout contains the implementation and synthetic tests, not the private
league/projection dataset. Supply those external files to reproduce the live board.
Missing primary identity fails closed; legacy league caches cannot select a league.
Active models/evidence use IndexedDB; local picks are scoped by season/league/team
in localStorage. Keep exported backups private. No cache is included in this commit.

## Validation

Checkpoint rerun: 218 passing tests, zero failures:

- NBA foundation 41, draft intelligence 46, points/coverage 40, UI parity 12,
  usability 16, projection importer 9.
- NFL recommendation regression 10, canonical identity 18, Yahoo auth bridge 23,
  browser startup regression 3.

Run the corresponding JavaScript test files with Node and Python suites with
`PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p <suite.py>`.
No live Yahoo requests are required by these synthetic/mocked tests.

The preceding usability session visually verified desktop and 390px mobile,
ME/OTHER, immediate recommendation/roster updates, history, undo, reload persistence,
reset, missing-evidence search and progressive loading. Rehearsal picks were cleared.
Jokic's displayed 62.36 FP/G and 4508.62 season total were independently recomputed.
NFL resume/search and original layout were checked. Browser backup import remains
unverified; core backup restoration tests pass. Current statistics and official live
sync are not added by this checkpoint. Projection dates and missing evidence remain
visible; evidence older than 21 days disables recommendations.
