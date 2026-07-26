# Premium Player Card V1

## Purpose and architecture

The Premium Player Card gives the current recommendation a recognizable visual identity. Fight Control continues to explain what to do and why; the card explains who the player is using existing metadata and scores.

`recommendation #1 or explicit comparison → PremiumPlayerCardV1.buildPlayerCardModel(context) → shared card renderer`

The module is a deterministic presentation model. It does not rank, rescore, mutate, or replace players.

## Model contract

The card model provides player ID, name, normalized position, NFL team, bye week, explicit decision tier, existing Mamba score, rookie status, image mapping and fallbacks, up to two supported traits, existing availability label, recommendation rank, Sharingan stage, coaching phase/headline, and comparison state. Missing optional values remain null or blank and are omitted by the renderer.

## Image mapping and fallback

Production portraits use stable runtime player IDs:

`assets/players/<stable-player-id>.webp`

The browser attempts, in order:

1. Exact local portrait
2. `assets/player-placeholders/<normalized-position>.svg`
3. `assets/player-placeholders/generic.svg`
4. Hide the image and retain the styled portrait container

Bundled silhouettes are abstract position placeholders, not player likenesses. Defense aliases resolve to `dst.svg`. The service worker caches only files that exist; it does not request hundreds of absent portrait paths.

## Supported metrics and traits

Visible metrics are position, team, explicit decision tier, existing Mamba score, and bye week when present. Rookie appears only when `rookie === true`.

Traits have deterministic priority and a two-trait maximum: Eternal value fall, explicit rookie upside, existing tier-cliff scarcity, elite QB/TE positional edge, existing league-breaker upside, S/A starter-tier value, and existing core-target status. Unsupported floor, ceiling, workload, and risk claims are omitted.

## Updates and comparison behavior

The card is rendered through the existing recommendation refresh path, so manual picks, undo, reset, simulation, setup-driven refreshes, and restored draft history cannot create a separate stale card state. By default it follows recommendation #1. Selecting an alternative temporarily shows that player with a visible `COMPARING` state. Returning to the recommendation clears the existing comparison selection and restores recommendation #1.

## Accessibility

The player name is a heading. Portraits start with `Portrait of <name>` alt text; fallback changes this to `Player portrait unavailable for <name>`. Metrics and badges use visible text, and color is never the only position, tier, rookie, comparison, or Eternal indicator. DOM reading order follows portrait, identity, metrics, traits, and secondary metadata.

## Responsive structure

Desktop uses a portrait column beside identity and metrics. Mobile preserves that reading order with a narrower portrait column, wrapping names and metrics without a fixed page width. Fight Control remains above the identity card and alternatives remain below it.

## Offline behavior and forbidden claims

The model, CSS, and all placeholder assets are cached. Exact portraits are optional local enhancements. Remote hotlinks, team logos, fabricated likenesses, invented statistics, unsupported predictive claims, and independent scoring are prohibited.
