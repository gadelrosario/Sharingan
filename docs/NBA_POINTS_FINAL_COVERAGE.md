# Final NBA points draft coverage repair

Historical development record. For the final points-draft checkpoint and current setup, see [NBA_POINTS_CHECKPOINT.md](NBA_POINTS_CHECKPOINT.md).

League 478.l.219046; Yahoo authority and six scoring multipliers unchanged. No new source research or Yahoo sync. This supersedes coverage counts in NBA_POINTS_PRIMARY_LEAGUE.md.

## Comparable source-order coverage

The prior 40/50, 86/100 and 138/156 figures used locally computed points order and excluded incomplete records. This request requires the existing source-defined ranking. The source snapshot carries sourceRank; it is used unchanged and is not represented as a points-specific ranking.

| Cutoff | Before | After |
|---|---:|---:|
| 50 | 43/50 | 50/50 |
| 100 | 86/100 | 100/100 |
| 156 | 137/156 | 154/156 |

## Every uncovered source target before repair

All rows below have exactly one corresponding Yahoo name candidate and an existing projection record. None are source-absent or ambiguous. All six points-scoring fields are present. A = safe identity repair; B = projection data incomplete (projected games, not the six per-game fields). Top 50 consists of rows with order ≤50; top 100 includes ≤100; top 156 includes the entire table.

| Source order | Yahoo ID | Yahoo name | NBA team | Yahoo eligibility | Source positions | Identity failed before? | Missing projection | Class | Result |
|---:|---|---|---|---|---|---|---|---|---|
| 5 | 4896 | Kawhi Leonard | TOR | SG/G/SF/PF/F/UTIL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 10 | 6355 | Anthony Edwards | MIN | PG/SG/G/UTIL | SG/SF | Yes: primary-position gate | None | A | Complete points projection |
| 16 | 4244 | Kevin Durant | HOU | SG/G/SF/PF/F/UTIL | PF/SF | Yes: primary-position gate | None | A | Complete points projection |
| 18 | 6562 | Jalen Johnson | ATL | SF/PF/F/UTIL | PF | Yes: primary-position gate | None | A | Complete points projection |
| 24 | 5432 | Karl-Anthony Towns | NYK | PF/F/C/UTIL | C | Yes: primary-position gate | None | A | Complete points projection |
| 30 | 10468 | Cooper Flagg | DAL | SG/G/SF/PF/F/UTIL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 33 | 10108 | Amen Thompson | HOU | PG/SG/G/UTIL | SF/SG | Yes: primary-position gate | None | A | Complete points projection |
| 55 | 6558 | Alperen Şengün | HOU | PF/F/C/UTIL | C | Yes: primary-position gate | None | A | Complete points projection |
| 71 | 10454 | VJ Edgecombe | PHI | PG/SG/G/UTIL | SG | Yes: primary-position gate | None | A | Complete points projection |
| 79 | 5292 | Andrew Wiggins | MIA | SG/G/SF/PF/F/UTIL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 82 | 10595 | Caleb Wilson | CHI | PF/F/UTIL | SF | Yes: primary-position gate | None | A | Complete points projection |
| 86 | 6401 | Deni Avdija | POR | SG/G/SF/PF/F/UTIL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 89 | 5601 | Brandon Ingram | LAC | SG/G/SF/PF/F/UTIL/IL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 92 | 10096 | Ausar Thompson | DET | SG/G/SF/PF/F/UTIL | SF/PF | Yes: primary-position gate | None | A | Complete points projection |
| 105 | 5324 | Zach LaVine | SAC | PG/SG/G/SF/F/UTIL | SG/SF | Yes: primary-position gate | None | A | Complete points projection |
| 126 | 10327 | Cam Spencer | MEM | PG/SG/G/UTIL | SG/PG | No | Projected games | B | UNRANKED |
| 129 | 6617 | Jay Huff | IND | C/UTIL | C | No | Projected games | B | UNRANKED |
| 147 | 5350 | Jerami Grant | MEM | SF/PF/F/UTIL | PF | Yes: primary-position gate | None | A | Complete points projection |
| 154 | 6208 | Matisse Thybulle | LAL | SG/G/SF/F/UTIL | SF | Yes: primary-position gate | None | A | Complete points projection |

## Repair and safety

Points-mode fallback requires exact normalized full name plus independently matching NBA team, unique in the source and one-to-one across Yahoo records. Mutable primary-position differences do not invalidate identity. Yahoo canonical ID and eligibility remain unchanged. No fuzzy/name-only joins, invented aliases or hardcoded player mappings. Conflicts remain rejected. The category-mode matcher is unchanged. Systemic repair safely matches 50 additional players overall; 49 gain complete usable points projections. Total: 344 matched, 340 complete, 733 Yahoo players.

Cam Spencer (Yahoo 10327, source order 126) and Jay Huff (Yahoo 6617, source order 129) have supported identities and per-game source fields but no projected games. Existing completeness policy is retained: neither receives a numerical points rank or season total. Their independent source order/ADP is separately labeled with source/date and unspecified format. No zero substitution. Other source-absent Yahoo players remain searchable and unranked.

Formula remains PTS + 1.2×REB + 1.5×AST + 3×ST + 3×BLK − TO. No FG%, FT%, three-pointer bonuses or category z-scores. Season totals require projected games. Injury flags remain dated Yahoo evidence or UNKNOWN. BEST VALUE remains unavailable without points-market evidence.

## Warning and presentation

Important available unranked players appear before the ranked group under UNRANKED — INSUFFICIENT EVIDENCE, with no ordinal. All other unranked players have a dedicated one-click view and can be searched by name or Yahoo ID. The existing NFL panel style presents IMPORTANT UNRANKED PLAYERS AVAILABLE; clicking opens the unranked view. BEST PICK is qualified AMONG PROJECTED PLAYERS while important unresolved targets remain available. Warning follows local picks and undo. No source ranking is used as a fabricated points rank.

Shared NFL markup, CSS, colors, row layout and points arithmetic were not edited. Only the permitted warning/labels and grouping differ.

## Verification

142 focused tests passed, zero failed: 40 points/coverage, 46 category draft, 41 NBA foundation, 12 UI parity, 3 browser regression. Browser rehearsal verified real league, safely repaired Jalen Johnson, Cam Spencer's missing-games label and separate source context, actionable warning, ME/OTHER picks, removal/restoration of warnings, recalculated Team Fit, undo, reset and persistence after reload. NFL search still returned Ja'Marr Chase/Chase Brown normally. All rehearsal picks cleared. Desktop retains the shared layout; 390px viewport and scroll width both 390. No new Yahoo live-draft sync claim.

The board can safely support this draft with its visible limitations; two important source targets remain unranked rather than hidden.
