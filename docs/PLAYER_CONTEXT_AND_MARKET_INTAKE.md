# Player Context and Projection/Market Intake

Jōnin 4.3.10 adds provider-neutral, shadow-only intake contracts. These records are intelligence evidence, not production player fields. They cannot rank players or influence Mamba, recommendation ordering, archetypes, CPU picks, or grading.

## Sleeper player context

The Sleeper context adapter reuses the existing Sleeper injury adapter's canonical index and reconciliation order:

1. verified Sleeper player ID;
2. the existing exact normalized name-and-position fallback;
3. otherwise quarantine as unmatched or ambiguous.

Each safe record keeps canonical and source IDs, source/canonical team and position, identity method, match confidence, fetched date, season, age, experience, depth-chart position/order, source roster status, and field-level quality issues. Canonical identity is never overwritten by a provider disagreement.

The refresh manager uses a weekly snapshot. A failed or empty refresh preserves the last valid snapshot and marks it stale. It does not touch draft state. The command for the first successful refresh is:

```sh
node scripts/refresh_sleeper_player_context.js
```

The current development sandbox could not resolve `api.sleeper.app`, so no context snapshot was created and no values were fabricated.

## Projection contract

Projection records retain underlying statistics, not an unexplained fantasy-point total. Supported fields are position-specific:

- QB: attempts, completions, passing yards/TDs/interceptions, rushing attempts/yards/TDs.
- RB: rushing attempts/yards/TDs, targets, receptions, receiving yards/TDs.
- WR/TE: targets, receptions, receiving yards/TDs, rushing attempts/yards/TDs.

Records require canonical and provider player IDs, provider, season, snapshot date, projection basis, identity confidence/status, and at least one valid non-negative statistic. Partial records remain explicitly partial. Unknown identities, duplicate provider IDs, duplicate canonical attachments, and malformed values are quarantined.

## Market-price contract

ADP is stored separately from projections and expert rankings. A record retains source, provider player ID, overall and/or positional ADP, format, platform, season, snapshot date, and identity confidence. Missing ADP is `UNAVAILABLE`, never zero. Intake cannot overwrite Fantasyland or BDGE valuation.

## FantasyPros access

`FANTASYPROS_ACCESS = ADAPTER_READY_CREDENTIALS_REQUIRED`

No credentials were found or exposed, no live endpoint/authentication contract was assumed, and no webpage was scraped. The adapter accepts a server/local-ingestion request builder so credentials never need to enter browser-delivered code. A valid licensed API configuration must be verified before live ingestion is enabled.

## Profile-specific projected points

The pure projected-points utility uses only supported projected statistics and league settings. Tests verify:

- 80 receptions produce exactly 40 more points in Full PPR than Half PPR;
- 30 passing touchdowns produce exactly 60 more points at six points per TD than four;
- scoring does not mutate the projection record or any production decision object.

Unsupported bonuses or missing statistical categories are not invented.

## Current coverage

No live context, projection, or ADP snapshot was available locally.

| Position | Active | Sleeper IDs | Age | Experience | Depth position | Depth order | Injury | Projection | ADP |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| QB | 34 | 34 | 0 | 0 | 0 | 0 | 34 | 0 | 0 |
| RB | 78 | 77 | 0 | 0 | 0 | 0 | 77 | 0 | 0 |
| WR | 107 | 105 | 0 | 0 | 0 | 0 | 105 | 0 | 0 |
| TE | 46 | 45 | 0 | 0 | 0 | 0 | 45 | 0 | 0 |

Across all 330 active players: 292 Sleeper IDs, 292 injury mappings, 6 explicit rookie flags, 10 handcuff relationships, 0 projections, 0 ADP records, and 0 advanced-usage records.

## Remaining historical-usage gap

- RB: snaps, carry/touch share, routes, targets/share, receptions, red-zone and goal-line touches.
- WR/TE: routes/participation, targets/share, TPRR, YPRR, first-read share, and red-zone usage.
- QB: designed rushes, scrambles, rushing share, red-zone rushing, and passing efficiency.

The next source must be licensed or genuinely public, snapshot-based, stable-ID compatible, and auditable. No proprietary or paywalled data may be scraped.

## Future placeholders

Vegas remains documentation-only. A future source record should preserve game total, spread, team implied total, season win total, later player props, source identity, snapshot date, and confidence. It should describe offensive environment/market expectation—not create a standalone upside score.

Sleeper adds/drops are also deferred. A future record may preserve adds, drops, lookback window, timestamp, and source, but market movement must never become an automatic hype bonus.
