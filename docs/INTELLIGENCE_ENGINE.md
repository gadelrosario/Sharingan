# Intelligence Engine

## Read models

Player Intelligence supports Opportunity, Environment, Risk, Trend, Market, Confidence, and Last Updated.

Team Intelligence supports Offensive Environment, Coaching, Offensive Line, QB Stability, Pace, Implied Points, Trend, and Last Updated.

The initial store is in-memory and validates the permitted fields. Projection and market snapshot records can be stored alongside these read models. A persistent repository can replace it behind the same API later.

## Expert Strategy Registry

Strategy signals remain separate from rankings and recommendations. The registry stores source, type, strength, confidence, effective date, expiration, and notes. Initial vocabulary accommodates BDGE Price Fade, FantasyLand Plant Flag, and Flock Offensive Environment, while permitting additional typed signals.

The deterministic transcript-summary seeds and their provenance rules are documented in [EXPERT_INTELLIGENCE.md](EXPERT_INTELLIGENCE.md). They are not loaded by the browser application and have no scoring consumer.

## Evidence Engine

Every future metric can carry:

- Source
- Observation timestamp
- FRESH, AGING, or STALE state
- LOW, MODERATE, or HIGH confidence
- UNVERIFIED, SECONDARY, PRIMARY, or AUTHORITATIVE reliability

Freshness is evaluated against an explicit maximum age and injected clock. Confidence and reliability are evidence metadata, not recommendation modifiers.

## Non-goals for Jōnin 3.6

- No live APIs or remote dependencies
- No UI
- No recommendation or scoring consumption
- No alternate projections
- No persistence migration
- No unsupported claims of provider accuracy
