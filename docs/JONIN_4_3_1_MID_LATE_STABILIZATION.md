# Jōnin 4.3.1 — Mid/Late-Draft Stabilization

Jōnin 4.3.1 is a narrow extension of the Jōnin 4.3 gated decision architecture. It leaves source rankings, early-round RB foundation behavior, injury calibration, completion constraints, specialist economics, grading, and UI behavior unchanged.

## Marginal positional utility

The strategy gate now measures the ordinal roster role of each candidate. Starter and FLEX improvements retain high utility. Later WR and RB depth receives progressively larger penalties, with a sharp decline at WR6+ and RB5+. QB and TE duplication also receive deterministic late-depth penalties.

These are soft penalties, not roster caps. Documented reasons can offset part of a penalty but never erase it. Supported reasons are a measurable value fall, an existing league-breaker or core-target flag, rookie role growth after Round 7, secure-role/workhorse evidence, roster diversification, or a large value edge over the best remaining RB/WR alternative.

## Depth-saturation integrity

A saturated candidate fails the integrity gate when a materially less-saturated, in-corridor skill-position path remains available. If every viable alternative is equally or more saturated, the pick stays penalized and is labeled `LEAST_SATURATED_AVAILABLE_PATH`; this distinguishes unavoidable 17-round bench construction from unjustified same-position accumulation.

## Ordering and score precision

The canonical `finalDecisionScore` remains unrounded and is still the primary sort key. Exact-score ties use existing strategic evidence in this order: starter-equity improvement, marginal utility, value fall, roster optionality/portfolio evidence, source value, source rank, then stable player identity. Display rounding does not control ordering.

## Validation contract

Golden fixtures preserve the Jōnin 4.3 RB/RB/TE foundation, the following WR starter window, and the Round 7 QB survival decision. Focused fixtures also require declining WR/RB depth utility, suppression of avoidable saturation, and unrounded differentiation behind displayed ties.

The full-draft canary runs five deterministic Recommendation #1 drafts from slots 1, 7, and 10. Its report records roster mix, positional timing, starter ranks, corridor violations, unexplained reaches, unsupported saturation, and recommender/grader contradictions at `outputs/player_audit/jonin_4_3_1_full_mock_report.json`.

## Grader audit

The existing grader already derives roster construction primarily from assigned-starter strength (`starterAverage`, weighted at 62%), with completion and surplus adjustments. No grading formula was changed. Jōnin 4.3.1 instead records the strategic justification on each recommendation so intentional in-corridor starter or portfolio decisions can be audited against the final value and timing grades.
