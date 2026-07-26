# Action Evaluation V1

Each action owns an independent rule set producing pros, cons, unknown categories, applicability, and semantic flags.

- **DRAFT_NOW** considers act timing, loss risk, poor price, and safe-wait evidence.
- **WAIT** considers patient timing, tier survival, flight risk, and tier collapse.
- **PIVOT** requires a concrete alternative and considers material price or environment objections.
- **PROTECT_TIER** requires meaningful tier risk or explicit tier-protection timing.
- **EXPLOIT_VALUE** requires a favorable value window; expert evidence is considered only when explicitly marked applicable.
- **BUILD_POSITION** considers actual roster requirements and related tier access.
- **DELAY_POSITION** considers positional strength, safe timing, and delay risk.
- **MONITOR** handles incomplete or developing room information while recognizing critical urgency.

No action receives a cross-category weighted total. Evaluation records retain contradictory evidence so Best Path and future UI consumers can show why an action was selected and what could make it wrong.

Expert principles do not become action evidence merely because they exist. A caller must establish that a signal's scope, conditions, status, freshness, and provenance apply to the current state. This prevents the registry from silently becoming a rankings engine.

V1 evaluation language is deliberately compact and deterministic. It is suitable for a future presentation layer but remains disconnected from the live application.

