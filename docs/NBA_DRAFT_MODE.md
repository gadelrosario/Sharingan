# NBA draft mode — 2026–27

Historical development record. For the final points-draft checkpoint and current setup, see [NBA_POINTS_CHECKPOINT.md](NBA_POINTS_CHECKPOINT.md).

Draft-only, read-only Yahoo authority, separate from actual-stat evidence. No NFL
recommendation or waiver code is changed. No Yahoo draft pick is submitted.

## Source and refresh

The public https://9cat.app/projections/ page identifies 2026–27 projections,
updated September 25, 2026. Its public `rk-data` JSON contains 351 records with
per-game counting stats, FGM/FGA/FTM/FTA, games, minutes, source model rank and ADP.
The public robots policy allows `/` and excludes private/sync endpoints; neither
excluded path is used. The public page requires no subscription or login. No
explicit redistribution license was found; this implementation keeps the captured
numeric snapshot private and local, outside Git. Robots access is not a license.
No article text, source app code, premium feature, private endpoint or automatic
scraping scheduler is copied. Before publishing or redistributing the dataset,
obtain source permission. Source dates and links remain visible.

`api/nba_draft_snapshot.py` consumes a manually saved public projection HTML page;
it does not fetch a website or execute page scripts. It validates the season,
source date, schema, IDs, numeric fields and shot components before atomically
replacing a private local JSON file. A rejected import leaves the old file intact.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 api/nba_draft_snapshot.py \
  --html /path/to/saved-projections.html --season 2026 \
  --output /private/local/draft-evidence-2026.json
```

The NBA bridge serves that file through `/api/nba/draft-evidence` using
`NBA_DRAFT_CACHE`. The default is `~/.fantasyhq/nba/draft-evidence-2026.json`.
`NBA_BUNDLE_CACHE` optionally seeds the bridge with an existing private Yahoo NBA
bundle, preserving its original fetchedAt date; it is not a fresh Yahoo sync.
The verification setup uses files in
`/path/to/private/nba/`, outside this repository.

```sh
NBA_BUNDLE_CACHE=/path/to/private/nba/yahoo-bundle.json \
NBA_DRAFT_CACHE=/path/to/private/nba/draft-evidence-2026.json \
PYTHONDONTWRITEBYTECODE=1 python3 api/yahoo_auth_bridge.py --port 8788
```

ADP is the source's public ADP, with market, sample size and independent update
date unspecified. It is not labeled Yahoo ADP. Model ranks are projections, not
expert opinion or actual stats. Yahoo supplies eligibility, team, fantasy status,
league slots and ownership. No statistical actuals are read by Draft Mode.

## Identity and coverage

The existing 707-player Yahoo bundle remains the only fantasy universe. The
captured source safely matches 295 players by unique normalized full name +
current team + Yahoo primary position contained in the source positions. Team
abbreviation equivalents (PHO/PHX, BRK/BKN, NO/NOP, NY/NYK, GS/GSW, SA/SAS) and
accent/punctuation normalization only address formatting. No surname/initial,
suffix-dropping, fuzzy matching or manual player-ID patch exists. Explicit shared
ESPN ID takes precedence when provided. Ambiguous and many-to-one joins fail
closed; unmatched players remain searchable, draftable locally and unranked.
All evidence preserves Yahoo and source identities and mapping authority.

## Draft math and limits

The model uses all nine actual Yahoo scoring categories and is BALANCED; no punt
strategy is selected automatically. Only complete projected records with positive
games and minutes receive a draft value. A minimum 30-player reference sample and
nonzero variance in every category is required; otherwise recommendations are
unavailable. Missing values are never zero-filled.

Reference pool: up to league team count × non-injury roster capacity complete
mapped players, ordered by source per-game rank (192 for this league). Baseline is
fixed during the local draft. Each counting category uses population z-scores;
TO is negated before standardizing. FG contribution is `FGM - poolFG% * FGA`,
where poolFG% = sum(FGM)/sum(FGA); FT is analogous. Thus percentage impact includes
volume. Zero attempts produce a missing displayed percentage, and a supported
zero shooting impact. Sum the nine z-scores for draft value. This is per-game
value, not projected season totals, win probability or an arbitrary 0–100 rating.
Games and minutes remain visible for durability/role context; no injury forecast.

Tiers split when value falls below the current tier leader by >= max(0.5, 0.35 × population SD of all
valued players' summed z-scores). They can contain very different numbers of
players; no fixed-size bins. Category strengths/weaknesses use ±0.75 player z;
roster profile uses ±0.5 mean z across measured drafted players. These are disclosed
heuristics, not claims about opponent strength or matchup-winning probability.
Roster shooting is aggregated from made/attempted components, never average FG%.
Incomplete roster evidence is labeled and disables fit adjustments.

TOP RATED: highest available category value. BEST PICK: within best available
legal tier, value plus 0.25 × mean deficit-weighted contributions. Deficit weights
are capped at 1. BEST TEAM FIT: highest such deficit coverage in that same tier,
with overall value breaking ties. At an empty roster both equal the best legal
value. Yahoo slot eligibility is assigned by exact bipartite matching, retaining
G/F/UTIL/BN flexibility. No simplistic one-player-per-position penalty.

BEST VALUE: positive market-rank minus model-rank edge over the *same mapped
ADP-covered cohort*, limited to the best two currently available legal tiers.
It can be unavailable, especially at the first pick. It is not a prediction that
a player lasts until another pick. CATEGORY WINNER: strongest supported available
category z >=1.5, and explicitly distinct from best overall.

All local drafted players and Yahoo rostered/waiver players are excluded from
recommendations. Recent Yahoo OUT/INJ/SUSP flags exclude BEST PICK/FIT/VALUE/category
candidates; TOP RATED remains raw supported value. An absent flag or flag older
than 24 hours is UNKNOWN, never HEALTHY. Verify current injury news in Yahoo.
Source snapshots older than 21 days disable recommendations pending refresh;
the date and board remain visible. No stale source is relabeled fresh.

## Draft-day use

1. Open NBA, select Elite All Stars, then Open NBA Draft. Later use NBA Draft
   directly to restore the saved local board. Load once before the draft.
2. Read BEST PICK, its tier/category rationale and alternatives; inspect details
   and confirm current availability/injury status in Yahoo.
3. Make the actual pick in Yahoo; mark the player Drafted by me here. Record other
   managers' picks as Drafted by other immediately.
4. Follow updated recommendations and roster profile; use search and Undo last
   pick for corrections. Official clock/pick number is not inferred.
5. Export a draft backup periodically. Reset requires explicit confirmation and
   affects only local picks, never Yahoo or the evidence snapshot.

No Yahoo live draft sync is connected. Existing NBA routes expose universe,
settings and roster, not a verified live draft-results contract. Manual tracking
is the supported MVP. Local draft saves are keyed by season/league/team; board and
evidence are cached with their original dates. Actions perform no network calls.
On bridge failure the last accepted local snapshot loads after a bounded timeout.
The service worker includes NBA scripts; keep the loaded tab open during the draft.
Exported backup contains private league/player/state data; keep it local. Backup
restore rejects a different league and validates state. Evidence JSON imports
must meet the separate preseason contract. Local storage failure is visible.

## Verification — October 6, 2026 Pacific

122 focused tests passed: 46 draft-intelligence, 41 NBA-foundation, 9 draft-import,
23 Yahoo-bridge, 3 browser-hotfix. A live rehearsal exposed overly broad tiers;
the bounded cumulative-value rule above replaced adjacent-gap-only tiers and
received a targeted regression test. No unrelated broad suites were rerun.

Observed coverage: 707 Yahoo players, 295 safe projection matches, 412 unresolved,
0 conflicts, 295 category profiles, 292 positive-games/minutes valued players,
241 with ADP. Three matched zero-games/minutes records are retained but unranked.
The 192-player baseline produces 16 data-dependent tiers for this snapshot.

One browser session verified real league/team/category metadata, mixed local
ownership picks, immediate recommendation exclusion, weighted roster percentages,
fit changing with roster composition, undo, search, reset cancel/confirm, reload
persistence, player-detail provenance, and bridge-unavailable cache recovery.
At 390px clientWidth and scrollWidth both measured 390. Primary quick-pick action
worked on mobile. Rehearsal state was reset to zero picks. NFL Primary League Week
4 loaded afterward; NBA bridge was restarted. No Yahoo sync or draft write was
needed; the existing cached bundle retained its original timestamp.

## NFL presentation reuse

NBA Draft mounts the actual NFL draft shell with isolated IDs and local NBA handlers. Both sports call `draft-presentation-v1.js` for Fight Cards, recommendation cards, player rows and roster tables. Existing NFL CSS rules also target the isolated NBA IDs; NFL values and responsive breakpoints are unchanged.

NBA substitutes category value, tiers, ADP, Yahoo slots and projected-evidence labels. Unsupported photos use the existing generic portrait. Official order/clock remain unknown; the board shows local pick history. The header Tools button contains reset, backup export/import and evidence provenance. Search and the five recommendation signals lead to the existing Record Pick interaction with NBA owner choices.

Parity verification: desktop header/panels/player-row geometry matched NFL exactly; 390px card width (374px), stacking and spacing matched with no horizontal overflow. Local ME/OTHER picks, recommendations, category profile, search, undo, reset and reload persistence passed. Backup export produced the expected JSON; browser import could not be completed because file-upload automation and the native picker were unavailable. Core state restore tests pass, but the revised import UI still needs one manual backup round trip. Rehearsal picks were cleared. NFL draft search/resume and cached Week 4 Season view passed. No valuation, matching or provider changes are part of this UI work.
