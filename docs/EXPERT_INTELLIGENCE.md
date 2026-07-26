# Expert Intelligence Registry

## Purpose and source limits

The registry converts reusable strategy concepts into deterministic, queryable records. It is a knowledge base, not a rankings source, recommendation engine, or claim that an expert view is objectively correct.

The raw BDGE, FantasyLand, Flock wide-receiver, and Flock running-back transcripts are not stored in this repository. Jōnin 3.6.1 therefore codifies only the transcript principles explicitly enumerated in the milestone specification. Every seed is marked `summarized`; none is presented as a direct quotation. Player examples were deliberately left empty rather than reconstructed from memory.

## Opinion versus objective evidence

An expert signal records a strategic interpretation: for example, that an acquisition price is unattractive or an offensive environment constrains ceiling. Objective evidence records observable inputs such as current ADP, implied points, role, targets, or injury status. A future Intelligence Engine may associate the two, but it must preserve their distinct provenance.

## Strength versus confidence

`strength` describes how materially a principle would matter when its conditions are satisfied. `confidence` describes how well the source and available evidence support that interpretation. Both are independently validated from 0–100. A strong idea can have limited evidence confidence, while a well-supported observation can have modest strategic impact.

## Scope and lifecycle

Signals may be GLOBAL, POSITION, TEAM, or PLAYER scoped. Seeded transcript principles are player-neutral GLOBAL or POSITION rules. ACTIVE signals must include complete provenance. Effective and expiration dates provide temporal boundaries; EXPIRED and INVALIDATED statuses are excluded from active queries. Invalidation conditions explain what evidence would weaken or retire the principle.

Source illustrations are a separate registry collection with `illustrationOnly: true`. They are never loaded as active principles and cannot create current-season recommendations.

## Future conflict resolution

Conflicting signals should eventually be resolved by applicability conditions, freshness, evidence reliability, confidence, and transparent source plurality—not by silently picking one expert. The result should remain a modifier with an explanation. It must not become a source-of-truth ranking.

Price-sensitive rules never create permanent avoids. A fade at one acquisition cost can become fair, good, or excellent after the market moves. Likewise, conviction may break a close tie or support a controlled reach, but it cannot bypass major price, tier, role, or roster-construction problems.

## Provenance contract

Every active record includes original source, transcript identifier, local rules reference, codification date, evidence type, and one of `directly_stated`, `summarized`, or `inferred`. The registry rejects active records without this metadata.

