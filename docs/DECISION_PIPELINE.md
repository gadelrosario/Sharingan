# Decision Pipeline

## Deterministic flow

`Evidence → Candidate Actions → Independent Evaluation → Best Path Selection → Structured Explanation`

### Evidence normalization

The collector accepts snapshots from recommendation output, Draft Psychology, Intelligence Store, Evidence Engine, Expert Strategy Registry, environment and market models, roster state, tier state, risk, and timing. It does not import those implementations.

Evidence is normalized into MARKET, ENVIRONMENT, PSYCHOLOGY, ROSTER, TIERS, EXPERT, CONFIDENCE, RISK, and TIMING. Every record contains value, confidence, freshness, source, and AVAILABLE or UNKNOWN status. Missing input always becomes UNKNOWN; the engine never invents a neutral numeric value.

### Candidate and decision contracts

All eight action candidates are generated for each recommendation. Inapplicable actions, such as PIVOT without an alternative, remain visible as BLOCKED rather than disappearing.

The selected action is wrapped in an immutable SHADOW Decision. Explanations contain concise conclusions, evidence metadata, counterarguments, and explicit unknown categories—not raw internal reasoning.

### Shadow execution

The Shadow Decision Runner evaluates each supplied recommendation without mutating the recommendation list. Its default sink discards decisions. An injected validation sink may collect them in tests or future offline audits. Nothing is persisted or presented to users.

