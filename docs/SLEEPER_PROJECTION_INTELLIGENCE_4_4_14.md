# Jōnin 4.4.14 — Sleeper Projection Intelligence

Fantasy HQ uses an isolated adapter for the observed zero-cost, unauthenticated Sleeper weekly projection endpoint:

`https://api.sleeper.com/projections/nfl/<season>/<week>?season_type=regular&position=<POSITION>&order_by=pts_half_ppr`

The endpoint is undocumented. Sleeper does not guarantee this interface, its shape, or its continued availability. No other Season component reads the provider payload directly. A schema change, non-JSON response, wrong season/week, empty response, unresolved identity, or missing projection fails closed.

## Data flow and authority

The adapter fetches one bounded resource for each active fantasy position: QB, RB, WR, TE, K, and DEF. It validates and normalizes those resources once per season/week before enriching the existing current-week evidence model used by Current Outlook, Position Battle, and Start/Sit. It does not create a parallel recommendation engine and has no Draft authority.

Normalized records retain provider and canonical IDs, season/week, position, game ID, raw projected statistics, standard/half-PPR/PPR provider totals, provider timestamps, fetch time, ETag, scoring compatibility, projection type, freshness, and the reason a record is non-authoritative.

Identity joins use stable Sleeper IDs already recorded in the canonical injury mapping. Emmett Johnson is deterministically joined through verified Sleeper ID `13337`, Yahoo ID `42796`, and GSIS-backed season identity `fhq_season_gsis_00_0041013`. Defense projections join by normalized NFL team identity; no fuzzy name matching is used.

## Projection hierarchy

1. `CUSTOM_SCORING`: Fantasy HQ applies only Yahoo scoring modifiers whose semantics have a deterministic Sleeper raw-stat mapping for that player position.
2. `SLEEPER_HALF_PPR_ESTIMATE`: when any applicable Yahoo category cannot be reproduced safely, Fantasy HQ uses current `pts_half_ppr` and labels it **Sleeper Estimate**.
3. Unavailable: no usable numeric projection, unresolved identity, wrong week, or stale evidence.

Unsupported specialized categories are explicit in compatibility metadata. They are never approximated. Examples include long-touchdown bonuses without equivalent source granularity, split long-field-goal rules, fourth-down stops, three-and-outs, and any sparse return or fumble field whose semantics cannot be verified.

## Freshness and failure behavior

The weekly snapshot is cached locally as last-known-good evidence. A projection is current through six hours, aging through 24 hours, and stale afterward. Refresh failure preserves the prior snapshot; stale records cannot have recommendation authority. Sleeper failure never fails Yahoo synchronization and never converts missing values to zero.

Numeric zero remains a valid projection. Missing game metadata is not interpreted as a bye. A bye requires independent schedule evidence.

## Game state and injury separation

Sleeper projection evidence is independent from Fantasy HQ injury, availability, and lock evidence. An OUT or IR player may still have a provider projection; that projection does not make the player available. Final Yahoo actual points replace the pregame projection. A live/locked player never receives `actual + full-game projection`, so Fantasy HQ does not reconstruct Yahoo's private projected-final UI value.

## Cost and credentials

This integration requires no API key, paid service, or subscription. If the undocumented endpoint becomes unavailable, the adapter fails closed and the rest of Yahoo Season Mode remains operational.
