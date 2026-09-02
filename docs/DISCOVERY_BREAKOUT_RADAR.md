# Discovery / Breakout Radar V1

Jōnin 4.4.10 adds a deterministic, evidence-first Season intelligence layer that answers: **whose role or opportunity is changing before production fully catches up?** It consumes normalized `SeasonEvidenceStore` observations and read-only Injury & Opportunity context. It does not alter Draft recommendations, rankings, tiers, player values, Waiver selection, FAAB pricing, Start/Sit, TeamFit, Sharingan, Chidori, grading, or Yahoo state.

## Authority boundaries

- Discovery owns a global NFL signal classification and attention timing only.
- Yahoo owns roster membership, availability, and transaction truth.
- Waiver Intelligence owns add/drop action selection.
- FAAB Intelligence owns price.
- TeamFit and scoring format are contextual annotations; neither changes the global Discovery classification.
- `ACT` means review the live Yahoo/Waiver state now. It is never independently a transaction instruction.

## Deterministic signal contract

The engine emits one of `BREAKOUT`, `EMERGING`, `ROLE_GROWTH`, `OPPORTUNITY_WATCH`, `STASH_WATCH`, `STABLE`, `FADING`, `NOISE`, or `INSUFFICIENT_EVIDENCE`; an independent signal strength; and `ACT`, `WATCH`, `WAIT`, or `IGNORE` attention timing.

Role participation and opportunity trends lead the signal. Production is supporting evidence. A touchdown or big-play spike without role/opportunity growth is classified as noise. Fresh three-observation persistence can strengthen a signal; stale, conflicted, sparse, or incomplete evidence lowers confidence and fails closed. Season-only registry identities can be evaluated without Draft rank, tier, or Draft eligibility.

## Presentation

Season Mode includes a dedicated Discovery Radar route with bounded groups: three top signals, five emerging signals, five watchlist entries, and a collapsed fading/noise section. Season Home receives a three-card preview below Weekly Flight Control. Player analysis shows What Changed, Why It Matters, What To Do, and Risk, with evidence IDs and source provenance collapsed by default. Weekly Flight Control may consume a bounded Discovery event as context and deduplicates it with existing player alerts.

Normal 2025 evidence is labeled stale and is never presented as live 2026 guidance. `?seasonDemo=1` loads a sanitized ten-player fixture solely for deterministic demonstration.
