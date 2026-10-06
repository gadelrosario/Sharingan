# NBA statistical evidence snapshot

`api/nba_sportsdataverse.py` is a standalone standard-library backend importer.
The separate NBA foundation consumes only strictly accepted snapshots; failed imports expose no partial observations.
CSV avoids adding a Parquet dependency. Yahoo remains the independent fantasy authority.

```sh
python3 api/nba_sportsdataverse.py --season-ending-year 2026
```

The explicit ending year 2026 means NBA 2025-26, not a Yahoo game/season ID.
The default single-season cache is `~/.fantasyhq/nba/sportsdataverse-2026.json`;
`--cache` overrides it. Run one writer per cache; this is not a concurrent service.
Network reads have a 60-second timeout and a 40 MiB cap; validation allows at most
100,000 records. Each refresh replaces one snapshot, not an accumulating archive.

## Contracts

- Canonical statistical identity is `nba:espn:<athlete_id>`. No Yahoo identity is emitted.
- Required headers must exist; missing numeric cells become null. Explicit zero stays zero.
  Invalid, negative, nonfinite, or fractional count stats reject the snapshot.
- IDs are positive digit strings. Missing player/team metadata, malformed dates,
  mismatched source season, duplicate player-game keys (even identical), conflicting
  names for one ID, or inconsistent game date/type reject the entire snapshot.
- Dates are checked against July of the starting year through December of the ending
  year, accommodating delayed seasons such as 2019-20. The source season must still match.
- Explicit `did_not_play=true` means DID_NOT_PLAY; conflicting positive minutes reject.
  Otherwise positive minutes establish PLAYED. Missing/zero minutes yield UNKNOWN.
  `didPlay` is respectively false/true/null. Raw participation reason/active fields are
  retained; a reason alone is not authoritative (played rows can contain stale DNP text).
- Source season-type codes remain strings, without inferred play-in/regular/playoff policy.
- Metadata includes source/asset URLs, ending year, NBA season label, retrieval time,
  ETag/Last-Modified when available, content SHA-256, byte/row counts, latest game date,
  transformation version, and SportsDataverse/hoopR CC BY 4.0 attribution/license links.
- Cache envelope separates `snapshot` from `refresh`. Failed fetch/validation retains
  the previous snapshot unchanged, records FAILED/stale, and exits nonzero. No prior
  snapshot means null. Atomic replacement protects LKG on write failures; disk errors
  propagate, since a failure marker cannot be guaranteed when the disk is unavailable.
  SUCCESS describes retrieval/validation, not proof that upstream data is up to date.

## Validation / live gate

Run only the focused suite:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -p test_nba_sportsdataverse.py -v
```

The 2026 CSV checked on 2026-09-26 contains 34,883 rows, including 33 rows with
blank athlete IDs and names. Therefore the live snapshot is REJECTED, with zero
accepted records. No silent filtering exception was added. The first failure is
CSV line 10009, game 401810785. Diagnostic-only normalization of the other 34,850
rows found 591 players, 1,326 games, and no duplicate player-game keys/name collisions.
These rows are not an approved partial cache. A source correction or a separately
reviewed, evidence-backed non-player-row policy is the next bounded task.

Live source/cache inspection files were kept under /tmp, not in the repository.
The initial live rejection required one additional download for local diagnosis;
subsequent validation used that captured file without further network calls.


## Consolidated foundation gate — 2026-10-04

The exact 34,883-row asset was inspected once (SHA-256
`7a4868da67ae7f6ebfba23389e04220be2e3f69d2e56a3942c02aa56f1becc89`).
All 33 missing-ID/full-name rows retain `athlete_short_name=Olbrich`, Chicago
team ID 4, starter=false, ejected=false, and COACH'S DECISION. Twenty-two have
zero box-score values/did_not_play=false; eleven have missing values and
true did_not_play. Active flags vary (18 true, 15 false). Valid player rows
share these participation/reason fields, so they are not a non-player discriminator.
These are plausibly malformed player records (classification B), not proven
non-player artifacts. No name-based repair, quarantine exception or partial
acceptance was introduced.

Strict import: BLOCKED; accepted 0, quarantined 0, rejected malformed rows 33.
Diagnostic accounting only: 34,850 candidate rows + 33 failures = 34,883 source
rows; 591 identified players and 1,326 games. Candidate rows remain unaccepted.
`audit_rows` exposes diagnostic counts and source hash, never a partial snapshot.

## Yahoo + category + UI foundation

`api/yahoo_nba.py` reuses existing Yahoo OAuth/transport, discovers NBA leagues,
fetches the selected league settings/team roster, and paginates the entire league
player universe using actual returned counts. Duplicate keys and incomplete
pagination fail closed. No Yahoo payloads or credentials are checked into source.
The shared bridge adds NBA-only routes; existing NFL routes are unchanged.

Run an NBA bridge instance alongside the existing NFL bridge:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 api/yahoo_auth_bridge.py --port 8788
```

It uses the same local TLS certificate/OAuth token store. `NBA_SNAPSHOT_CACHE`
optionally selects the strictly validated importer envelope. Without an accepted
cache the view says statistics unavailable. The verification session used the
failed envelope under /tmp. The original NFL bridge on 8787 was left running.

The NBA buttons open an isolated view using existing season shell/card/navigation
classes. No app.js, NFL data, lineup logic, scoring semantics or CSS redesign was
needed. Returning closes the view without changing NFL profile or state. Explicit
league selection loads Yahoo data; Refresh NBA re-fetches it. In-memory cached
bundles retain their fetchedAt timestamp. No silent roster/stat fabrication occurs.

Live selected league: Elite All Stars '25-26, Yahoo season 2026, 16 teams, H2H
categories, predraft; user team How Sway⁉️ has zero roster players. The current
complete fantasy universe contains 707 unique identities, all Yahoo FREE_AGENT
(the prior 684 was an earlier snapshot). Ownership comes from Yahoo ownership
subresources; no ESPN inference. Rostered/waiver/unknown cases have synthetic tests.

Actual scoring categories: 3PTM, PTS, REB, AST, ST, BLK and TO map to raw fields;
FG% and FT% are derivable only with positive, complete attempts. No active scoring
category is unsupported. FGM/A and FTM/A are Yahoo display-only entries, not scored
categories. This is capability mapping, not a claim that usable statistics exist.

ESPN identity support is added to the existing NBA namespace. The evidence adapter
preserves ending-year, source season type, observations/played count, raw nullable
totals, date window and provenance. DNPs do not count as played games. Zero attempts
produce null percentages. It never combines season types or treats source ending
year 2026 (2025–26) as Yahoo season 2026 (2026–27).

Only explicit shared provider IDs permit deterministic joins. Name + team can
produce review-only candidates but never automatic merges. Duplicate or ambiguous
mappings fail closed. Because no statistical snapshot is accepted, live mappings
are 0 deterministic, 0 conservative, 707 unresolved, 0 detected conflicts. The
591 diagnostic ESPN identities are not fed into this bridge.

Remaining blockers: upstream malformed-player records must be corrected without
silently losing rows; an authoritative Yahoo↔ESPN crosswalk is not currently
provided; and the inspected 2025–26 stats would be historical for the selected
Yahoo 2026 season. No projections, recommendations or opaque ratings were built.

## Current-season gate and crosswalk — 2026-10-05 UTC

Cached Yahoo metadata identifies season `2026`, league start `2026-10-20`, end
`2027-04-04`: NBA 2026–27. SportsDataverse uses the ending year (the existing
2026 file contains 2025–26 observations), so the appropriate asset is
`player_box_2027.csv`. The approved repository's release API was checked once:
https://api.github.com/repos/sportsdataverse/sportsdataverse-data/releases/tags/espn_nba_player_boxscores
No 2027 asset was listed; the latest season asset was 2026, updated September 9.
There is no current dataset/date range to import: zero available current rows,
zero accepted rows, no current invalid rows observed (not an assertion that a
future file is valid). The historical 33 Olbrich rows remain rejected and were
not repaired or silently quarantined.

`currentEvidence` requires Yahoo season/start/end agreement, the matching source
ending year, valid season dates, source regular-season type 2, and dates within
the league's window. Historical snapshots cannot feed current Season Mode.
No current observations is explicitly `CURRENT-SEASON STATS NOT YET AVAILABLE`,
not an application failure. Failed refreshes still cannot supply statistics.

Metadata inventory of the existing 707-player Yahoo bundle: Yahoo player key,
player ID, NBA editorial key, full/ASCII name, editorial team, primary/display/
eligible positions, uniform number, and Yahoo image/URL fields. No ESPN ID or
birth-date field is present. NBA editorial keys repeat Yahoo IDs, not ESPN IDs.
The inspected SportsDataverse schema has athlete ID, name, short name, team,
position, jersey and ESPN headshot, but no Yahoo ID or date of birth. Existing
historical metadata must not be treated as contemporaneous team/jersey evidence.

Crosswalk states are DIRECT_ID, UNRESOLVED and CONFLICT. MULTI_FIELD_CONFIRMED
has deliberately no producer: mutable name/team/position/jersey metadata alone
is insufficient here. Name/team candidates remain review-only. Direct shared
ESPN IDs preserve both identities; duplicate Yahoo identities, many-to-one
ownership, invalid ESPN namespaces and duplicate/conflicting source identities
fail closed. Statistics preserve source, sample, dates and both provider IDs;
zero attempts produce missing percentages. Yahoo retains fantasy authority.

Real coverage: 707 Yahoo players, 0 accepted current ESPN players; DIRECT_ID 0,
MULTI_FIELD_CONFIRMED 0, UNRESOLVED 707 (NO_CURRENT_ESPN_UNIVERSE), CONFLICT 0;
0 current-stat attachments. Seven raw scoring categories plus FG%/FT% remain
supported by the contract, with no fabricated values. Next bounded gate: when
2027 observations publish, strictly import that asset and reassess authoritative
cross-provider metadata; do not enable recommendations without safe evidence.
