# Fantasy HQ Developer Guide

## Project Purpose

Fantasy HQ is a real-time fantasy sports decision platform. It supports draft
recommendations and is being expanded into a unified system for waivers, trades,
start/sit decisions, league intelligence, and decision timing.

## Application Entry Points

- `index.html` — Browser application shell and script loading order
- `js/app.js` — Primary application controller
- `js/app-version.js` — Current application version label
- `service-worker.js` — Offline caching and browser deployment behavior

## Core Systems

### Intelligence Core

Location: `js/intelligence-core/`

Responsibilities:

- Canonical data models
- Data-provider interfaces
- Evidence collection and normalization
- Expert strategy registry
- Intelligence storage
- Mission-control coordination
- Mock providers for development and testing

### Decision Engine

Location: `js/decision-engine/`

Responsibilities:

- Generate candidate actions
- Gather supporting evidence
- Evaluate possible actions
- Compare alternate paths
- Produce a unified recommendation
- Generate explanations and confidence
- Support shadow-mode evaluation

## Strategy Modules

- `js/flight-control-v1.js` — Determines whether to act, wait, or preserve flexibility
- `js/sharingan-vision-v1.js` — Surfaces deeper recommendation context
- `js/adaptive-coaching-engine-v1.js` — Adjusts guidance based on user and draft state
- `js/draft-psychology-engine-v1.js` — Models manager behavior and draft tendencies
- `js/jonin-insight-engine-v1.js` — Produces higher-level strategic insights
- `js/player-tier-contract.js` — Defines player-tier behavior and expectations

## Interface Modules

- `js/command-center-v1.js`
- `js/roster-view-v1.js`
- `js/premium-player-card-v1.js`
- `js/jonin-ux-polish.js`

## Development Rules

1. Keep the application functional offline.
2. Do not move or rename JavaScript files without updating:
   - `index.html`
   - `service-worker.js`
   - tests
   - scripts
   - internal file references
3. Preserve the unified decision-engine architecture.
4. Treat waiting or taking no action as a valid recommendation.
5. Prefer tier-based strategy and best-path evaluation over raw ranking.
6. Test the setup screen, mock draft, live draft, recommendations, and undo flow
   after application-level changes.
7. Create a stable Git checkpoint before major architecture work.

## Formatting

Project formatting is controlled by:

- `.prettierrc`
- `.prettierignore`
- `.vscode/settings.json`

Avoid formatting unrelated legacy files during feature-specific commits.
