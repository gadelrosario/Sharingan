# Waiver + FAAB decision quality

Fantasy HQ treats three related concepts as separate contracts:

> Waiver player quality is not transaction quality, and transaction quality is not FAAB price.

## Decision path

1. **Waiver candidate quality** remains owned by the existing Waiver Intelligence engine. It validates stable identity, authoritative availability, source value, role, opportunity, upside, risk, roster need, and evidence completeness.
2. **Transaction quality** evaluates one candidate against each legal drop in the current profile. It subtracts drop value and lost optionality, then adds bounded starter/flex, scarcity, replaceability, redundancy, persistent Discovery, validated injury-opportunity, and matchup context. The best defensible package becomes the recommended add/drop pair; protected assets are never eligible.
3. **FAAB price** is downstream of the selected package. It uses a percentage range of remaining authoritative budget, not a false-precision auction prediction. Missing current Yahoo budget or availability produces shadow/blocked guidance rather than a production bid.

`netTransactionValue` is deterministic and bounded from -100 to 100. Its classifications are `STRONG_UPGRADE`, `UPGRADE`, `MARGINAL_UPGRADE`, `NEUTRAL`, `DOWNGRADE`, `STRONG_DOWNGRADE`, and `INSUFFICIENT_EVIDENCE`. Missing candidate value, drop cost, or a legal drop fails closed.

## Context and authority boundaries

- **TeamFit** may describe need, starter/flex path, redundancy, fragility, and optionality. It cannot make a poor candidate actionable.
- **Discovery** may add at most bounded context for persistent, current role growth. A discovery signal alone cannot authorize an add.
- **Injury Opportunity** is bounded and only contributes when current and validated. It never fabricates recovery dates or role certainty.
- **Weekly Matchup** is limited to tie/timing context. Stale or insufficient matchup evidence contributes zero and a difficult matchup cannot erase structural long-term value.
- **Yahoo** remains the only normal-mode authority for current roster ownership and free-agent availability. A Draft Archive is immutable history and cannot authorize a waiver transaction. Sanitized demo fixtures remain shadow-only.
- **Season-only identities** can be evaluated only when Season evidence and authoritative availability support them; their Draft eligibility flags are not changed.

## Timing and budget philosophy

- **ACT** requires sufficient evidence, a meaningful net roster upgrade, and an acceptable drop.
- **WAIT** covers marginal upgrades, unresolved role or price, stale/conflicting evidence, and near-term information that can change the decision.
- **HOLD** preserves the current roster or budget when no package clears the bar. Doing nothing is a first-class decision.

Discovery Mode preserves early budget optionality and requires stronger evidence before ACT. Playoff modes allow greater spending when a validated transaction directly improves the lineup and remaining weeks reduce the value of unused budget. Difference-makers and probable starters can receive higher ceilings than speculative watches, but Chidori remains independently rare.

## Alternatives and fallback claims

Best Pick is the strongest net transaction. Best Value is a different candidate only when expected acquisition-cost evidence exists and its net improvement per cost is superior. No cost evidence means no Best Value claim.

The fallback-plan contract is advisory only: up to two ranked add/drop packages followed by HOLD. It never submits claims and never invents availability.

## CURRENT_WEEK production comparison

Live Yahoo models explicitly select `horizon: CURRENT_WEEK` in the existing
Waiver Intelligence engine. The rated path above remains the default for fixtures
and existing callers; its thresholds and numeric meanings are unchanged.

The weekly path requires the selected profile, Yahoo league/team, season/week,
a current players dataset and a Yahoo snapshot no older than 30 minutes. Yahoo
ownership and the current available pool remain authoritative. A candidate must
not appear on any league roster. The comparison player must be a confirmed current
Yahoo bench member. Both need resolved canonical and Yahoo identities, matching
football position and overlapping eligibility. Starters and IR are excluded.
Game evidence must be recent, pregame, actionable and unlocked; elapsed kickoff
fails closed even if an earlier game record said pregame. OUT/IR evidence blocks
comparison. UNKNOWN injury remains UNKNOWN, never a healthy designation.

Both weekly projections must be supported, current/aging (at most 24 hours),
for this season/week, and share their source, projection type and scoring basis.
Exact custom scoring requires existing EXACT compatibility. Existing explicitly
labeled Sleeper half-PPR estimates may be compared on the same half-PPR basis;
they are not represented as exact Yahoo league scoring. Value zero remains zero.
Missing, stale, incompatible or conflicting required evidence yields
`INSUFFICIENT_EVIDENCE`, distinguishable from an evaluated `HOLD`.

All eligible same-position candidate/bench combinations are compared. The UI
shows the largest supported weekly difference, with deterministic name tie
breaks. This is a weekly comparison selection, not a transaction or ROS ranking.
A positive difference produces `WATCH`: monitor the candidate; it does not mean
add. A zero/negative difference produces evaluated `HOLD`: this comparison does
not establish a weekly improvement. Neither claims the bench player is expendable.

`longTermDropValue` stays `UNKNOWN`. Weekly projection, projection percentile,
draft rank and observed production never become sourceValue, upside, permanent
drop value or transaction scores. The result exposes `comparisons` and an empty
legacy `pairs` collection so existing transaction consumers cannot adopt it as
an add/drop package. ADD is not authorized and FAAB is explicitly BLOCKED with no
price; the app also rejects CURRENT_WEEK results at its FAAB entry point.

Existing normalized observed role/opportunity/production records may accompany
the pair as context only. They retain canonical identity, season/week,
observation/fetch timestamps, one-week sample, raw nullable metrics, provenance
and freshness. Future-week, undated, stale (>16 days) or wrong-identity observations
are excluded. Missing usage stays null and is disclosed; no zero fills or new
trends are synthesized. Observed context does not alter weekly difference or
supply permanent-drop authority.

Focused coverage: `tests/waiver-current-week-contract-tests.js`, plus existing
canonical identity, rated waiver and FAAB regression suites.


## Transaction protection gate (consolidated follow-up)

CURRENT_WEEK now exposes transaction-specific protection and a conservative
structural consequence check. Existing configured roster slots are reused;
no TeamFit numeric quality score is introduced. Same-position bench replacement
must preserve every existing eligibility and have known roster settings. The UI
reports positional depth after removal/replacement and known bye weeks, leaving
unknowns explicit. Counts are structural coverage, not assertions of healthy
players or projected starter performance. No urgency derives from team record.

PROTECTED is supported by starter/IR assignment, locks, explicit injury/reserve
status, loss of required positional coverage, positive supported weekly usefulness,
recent observed participation/opportunity, or an explicitly sourced validated
player relationship. A relationship is never inferred from name/team/position.
UNRESOLVED covers missing/conflicting authority or lack of affirmative protection
facts; it does not mean removable. Future removal consequence stays unresolved
for both states and longTermDropValue stays UNKNOWN.

REMOVABLE is reserved, with an explicit affirmative-evidence contract, but has
**no enabled producer**. Inspection of the existing normalized Yahoo, projection,
observed-evidence and TeamFit inputs found no fact establishing that material
future removal cost is resolved. Low/zero projection, bench assignment, missing
usage, unknown injury and fixture ratings cannot fill that gap. Caller-supplied
removable/drop-approved flags are ignored. Adding a synthetic successful removal
fixture would invent a source contract unavailable in this application, so positive
REMOVABLE/ADD test cases remain deliberately unimplemented. Negative guards and
this limitation are tested explicitly.

ADD is conclusively blocked under current sources, even when structural eligibility
and weekly improvement are supported. No hypothetical ADD pricing branch was
opened: Phase F is conditional on a real supported ADD. Existing FAAB remains
blocked with no price or fabricated quality/drop/transaction scores. Its formulas
are unchanged. The smallest remaining prerequisite is affirmative sourced evidence
resolving a specific removal consequence; a new source or major subsystem is
outside this session's scope.

The existing Waivers UI shows up to three comparisons, one per naturally available
position, using the already sorted weekly comparisons. This is representative
coverage, not a new multi-factor ranking system. Each includes protection,
structural consequences, missing evidence, decision and blocked FAAB status.
