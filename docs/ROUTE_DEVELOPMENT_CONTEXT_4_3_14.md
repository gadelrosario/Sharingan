# Jōnin 4.3.14 Route and Development Source Audit

## Decision

Development intake is populated and ready for re-audit. Route intake remains `SOURCE LIMITATION — ALTERNATIVE PROVIDER REQUIRED`.

This milestone remains shadow-only and has `recommendationAuthority: false`. No browser module imports either new research contract, so browser bundle impact is 0 bytes.

## Route/participation source audit

The evaluated source was nflverse `load_participation()` / the `pbp_participation` release for 2023–2025. nflverse documents pre-2023 data as NFL Next Gen Stats and 2023 onward as FTN Data via nflverse under CC-BY-SA 4.0 with required attribution. The release is end-of-season rather than live. The local sandbox could not resolve GitHub, so no raw snapshot was downloaded or replaced.

The key semantic limitation is decisive: nflverse defines `route` as the route taken by the **primary receiver on a play**. It is not a player-level route-run flag for every offensive participant. `offense_players` only proves that a player was on the field; it does not prove that the player ran a route. Consequently this source cannot defensibly produce routes run, route participation, TPRR, or YPRR for the complete RB/WR/TE cohort. Targets and receptions are not used as route proxies.

The offline route contract accepts only a future provider that supplies explicit player-level route counts. It validates unique player/season/week rows, non-negative counts, targets not exceeding routes, routes not exceeding an available pass-play denominator, null-safe ratios, and evidence-season attachment. No route artifact was generated.

## Development source audit

nflverse `players.csv` is the selected provider-neutral identity source. GSIS ID is its primary key. Its documented immutable context includes NFL-sourced birth date and PFR-sourced draft year. `birth_date` is used directly. `draft_year` is the entry/rookie season when present; the first observed statistics season is never substituted. Historical age is deterministically measured on September 1 of the evidence season, and `yearInLeague = season - draftYear + 1`.

The refresh is atomic and fail-closed. Static player metadata is emitted independently in `players`; evidence-season derivations remain in `records`. This retains safe birth and entry facts for matched players with no historical usage without inventing historical seasons. The local-file refresh emitted 257 player metadata records and 575 historical season records. Birth date is present for all 257 matched players; entry year and rookie season are present for 222. Historical sample slices remain unchanged.

## Identity review

The eight previously isolated source rows remain unresolved in this sprint:

| Source row | Existing canonical candidate | Outcome |
| --- | --- | --- |
| Kenny Gainwell / `00-0036919` | Kenneth Gainwell | Safe name alias in principle, but source/canonical team history differs; not attached without a verified historical-team bridge. |
| Marquise Brown / `00-0035662` | Hollywood Brown | Safe public alias in principle, but source/canonical team history differs; not attached here. |
| Elijah Mitchell / `00-0036567` | Elijah Mitchell | Stable name, team-history disagreement; not attached here. |
| Jonnu Smith / `00-0033858` | Jonnu Smith | Stable name, team-history disagreement; not attached here. |
| Chig Okonkwo / `00-0037809` | Chigoziem Okonkwo | Safe common-name alias in principle, but no alias/team-history bridge was added. |
| Stefon Diggs / `00-0031588` | Stefon Diggs | Stable name, team-history disagreement; not attached here. |
| Travis Hunter / `00-0040718` | Travis Hunter (canonical WR) | Remains unresolved because source position is DB and no explicit dual-position policy exists. |
| Jaylin Noel / `00-0040138` | Jayden Noel | Remains unresolved; similar name and matching team/position are insufficient proof of identity or a canonical typo. |

No canonical ID, player name, rank, tier, team, value, or alias was changed.

## Temporal and production isolation

Development and route records may attach only when canonical player ID and evidence season both match. Birth date and entry year are treated as static facts. Team, depth-chart, and future participation fields are not carried into historical evidence. The existing 4.3.13 report and its RB, TE, QB, and WR conclusions remain unchanged. Neither module is exported by the production intelligence core.

## Refresh commands

Development context:

```bash
node scripts/refresh_historical_development.js --snapshot-date 2026-08-19T00:00:00.000Z
```

Deterministic local-file mode:

```bash
node scripts/refresh_historical_development.js --players-input /absolute/path/to/players.csv --snapshot-date 2026-08-19T00:00:00.000Z
```

No route refresh command is provided because the evaluated public source does not contain the required player-level route denominator. A licensed or clearly documented alternative provider must be selected before route intake proceeds.
