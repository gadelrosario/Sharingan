# Fantasy HQ Technical Plan

## Phase 1 — Canonical player data (this build)
- One player record per NFL player
- Source-specific rankings, tiers, ADP, projections, and schedule data
- Import history and external ID mapping
- Local SQLite database

## Phase 2 — Complete data ingestion
- Locate and import exact Sleeper ADP
- Locate and import exact Yahoo ADP
- Locate and import consensus ADP
- Add BDGE/Flock projections and SOS values
- Add validation report for unmatched names

## Phase 3 — Draft decision engine
- League settings
- Roster construction
- Tier scarcity
- Position runs
- Pick distance
- Wait probability
- Explainable top-three recommendation response
- Performance benchmark below one second

## Phase 4 — Yahoo connection
- Yahoo developer application
- OAuth authorization
- Secure token storage
- League/team/settings import
- Yahoo player-key mapping
- Draft/roster synchronization

## Phase 5 — User interface
- 30-second command-center layout
- Large tap targets
- Top three choices above the fold
- One-sentence reasoning
- Offline cache with manual or automatic sync
