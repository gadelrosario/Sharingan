# Jōnin 4.4.11.2 — Season Command Center

Season Home is a presentation layer over the existing Weekly Flight Control orchestration. It does not rescore or reorder Waiver, Start/Sit, FAAB, TeamFit, Matchup, Injury/Opportunity, or Discovery output.

## Decision hierarchy

1. Compact weekly status: what changed and whether anything needs attention.
2. One top recommendation: real player identity, one clear posture, one short reason, timing, and best alternative.
3. Compact alternatives with position, NFL team, and legitimate projection context when supplied.
4. Lineup and roster opportunities.
5. Matchup and league context.
6. Engine diagnostics and secondary league context behind progressive disclosure.

The primary surface translates orchestration output into natural fantasy language. Internal classifications, confidence mechanics, FAAB posture, and evidence diagnostics remain available under analysis rather than competing with the decision.

## Local evaluation modes

- `?seasonDemo=1` keeps the sanitized placeholder fixture used by automated tests.
- `?seasonReview=straight-outta-downey` opens the realistic, read-only review fixture directly in Season Mode.

The realistic review source is query-isolated, never persisted into a league profile, and is labeled `REVIEW FIXTURE — NOT LIVE YAHOO DATA`. Its projections are explicit fixture data labeled `REVIEW FIXTURE PROJECTION`; normal live, disconnected, and Draft Snapshot modes do not receive those values.

## Manual Authority Bridge

Manual facts use schema `fantasy-hq-manual-season-state-1` and are stored under a profile-specific key. Each fact records its canonical player ID, type, value, confirmation timestamp, provenance, revalidation requirement, and lifecycle status.

Current-state precedence is:

`YAHOO_AUTHORITATIVE > USER_CONFIRMED > DRAFT_ARCHIVE > DEMO > UNKNOWN`

Manual facts never claim Yahoo provenance. Transaction authority requires complete user confirmation of the current roster plus explicit candidate availability. A partial manual record remains context only. A current successful Yahoo snapshot supersedes conflicting manual facts; superseded facts remain in history for auditability.

The Manual Update surface supports player availability, roster membership, starter/bench/IR placement, transaction status, and revocation. It also provides a bounded action to confirm the currently displayed roster snapshot. It never fabricates facts that the user has not confirmed.

## Known boundary

This bridge is intentionally temporary. It does not reproduce Yahoo transactions, validate league-side eligibility, or claim current free-agent truth beyond explicitly confirmed players. Jōnin 4.4.12 remains reserved for Yahoo live-authority hardening.
