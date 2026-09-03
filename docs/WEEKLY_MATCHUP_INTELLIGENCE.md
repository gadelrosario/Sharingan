# Weekly Matchup Intelligence V1

## Purpose

Weekly Matchup Intelligence describes how favorable a player's football environment is for a specific week. It is contextual evidence, not a lineup command.

> **MATCHUP QUALITY ≠ START/SIT DECISION**

Start/Sit remains responsible for lineup decisions. Weekly Flight Control remains the primary Season orchestration layer. Yahoo remains authoritative for ownership and lineup state.

## Architecture

```text
Normalized Season Evidence
  + current participation and role evidence
  + normalized opponent and team context
  + optional profile decoration
        ↓
WeeklyMatchupIntelligenceV1
        ↓
Bounded matchup assessment
        ↓
Start/Sit context, Weekly Flight Control explanation, Matchup UI
```

Provider-specific objects never enter the matchup engine. Browser rendering reads bounded normalized artifacts through `SeasonEvidenceStore`; it does not download or scan raw provider files.

## Inputs

Supported when current and normalized:

- Player position, team, opponent, season, week and game
- Targets, target share, carries, touches and opportunities
- Receptions, rushing/receiving yards, touchdowns and fantasy production
- Offensive snaps and offensive snap share
- Player-favorable position, defensive and scoring-environment scores
- Role and opportunity trend
- TeamFit and scoring format as profile-specific decoration only

Unavailable or incomplete today:

- Routes and route participation in the current production artifact
- Vegas total, spread and implied total
- Weather
- Defensive injuries and coverage scheme
- Trustworthy pressure/sack and mobile-QB opponent splits
- Trustworthy K/DST matchup granularity

Unavailable fields stay `null`; Draft rankings are never substituted for projections or matchup evidence.

## Output contract

The engine returns:

- Classification: `ELITE_MATCHUP`, `FAVORABLE`, `SLIGHTLY_FAVORABLE`, `NEUTRAL`, `SLIGHTLY_DIFFICULT`, `DIFFICULT`, `AVOID_SPOT`, or `INSUFFICIENT_EVIDENCE`
- Matchup score from `-100` to `+100`
- Separate confidence from `0` to `100`
- Trend, role context, supported dimensions, synthesis and uncertainty
- Bounded Start/Sit adjustment from `-4` to `+4`
- Evidence IDs and provenance
- Explicit false recommendation, transaction and Start/Sit authority

Classification measures matchup quality. Confidence measures evidence quality. A favorable classification can therefore have low confidence.

## Position logic

- QB emphasizes passing/position environment, opponent resistance and scoring environment.
- RB emphasizes rushing/receiving opportunity environment, opponent resistance and scoring environment.
- WR and TE emphasize position opportunity, passing resistance and scoring environment.
- K and DST fail closed to `INSUFFICIENT_EVIDENCE` until normalized evidence supports a trustworthy model.

No individual-player exceptions exist. A difficult matchup can coexist with a strong role, and a favorable matchup cannot rescue an inadequate role.

## Confidence and small samples

Confidence depends on dimension coverage, current freshness, role support and the number of current-season observed weeks. One-week samples are capped at 48; two-week samples at 70. Conflicts cap confidence at 35 and suppress strong classifications. Missing data lowers coverage rather than becoming a negative score.

Historical evidence is season scoped. The current 2025 snap artifact is `HISTORICAL_STALE` and cannot influence 2026 classification or Start/Sit scoring. If current evidence is insufficient, the correct output is `INSUFFICIENT_EVIDENCE`.

## Start/Sit and Weekly Flight Control

Start/Sit consumes only the bounded `matchupAdjustment`. Its maximum effect is four normalized points, scaled by both matchup strength and confidence. Role, opportunity, player quality, lineup constraints and existing Start/Sit logic remain primary. Insufficient or stale evidence contributes exactly zero.

Weekly Flight Control does not create matchup-only cards or actions. It can inherit matchup context through an existing Start/Sit decision, preserving deduplication and timing authority.

## Profile behavior

Global classification and matchup score are profile independent. Scoring format and TeamFit are retained as context-only decoration. Switching profiles changes roster, lineup and presentation but not the underlying global matchup classification.

## UI behavior

The existing Matchup destination presents:

1. Weekly matchup overview
2. Biggest advantages
3. Biggest challenges
4. Start/Sit implications
5. Detailed roster-player matchups

Advanced Evidence and Sources & Provenance are collapsed by default. Normal mode shows an honest unavailable state when current evidence is insufficient. Demo mode is explicitly labeled `DEMO / SANITIZED`.

## Future extension

Future trusted adapters may populate projections, Vegas, weather, routes, pass-play participation, opponent injuries and richer position splits without changing the engine's provider-neutral contract. Those fields must remain evidence—not transaction or lineup authority.
