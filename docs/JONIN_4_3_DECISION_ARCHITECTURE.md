# Jōnin 4.3 Decision Architecture

The production recommendation is a gated decision, not a sum of unrestricted opinions.

1. **Source value** establishes price from normalized overall/positional rank and tier.
2. **Foundation strategy** measures premium starter access without prescribing a fixed position sequence.
3. **Value Corridor** defines normally defensible prices. Need alone cannot move a player into it.
4. **Path preservation** compares the quality and number of viable near-term roster paths.
5. **Starter equity** grades actual weekly starter slots, including FLEX, rather than position counts.
6. **Recovery cost** measures the likely tier and quality loss caused by waiting.
7. **Team fit** breaks ties among strategically valid players.
8. **Tactical intelligence** applies bounded tier, run, injury, upside, survival, and Mamba refinements.
9. **Decision integrity** records price, starter impact, chase state, confidence, and the reasons a candidate is defensible.

The season profile values premium RB1/RB2 access in 2026 half-PPR drafts. It may be bypassed by materially better value. Once the premium tier is gone, `DO_NOT_CHASE` prevents ordinary RB depth from masquerading as repaired foundation quality.

`finalDecisionScore` remains the sole unrounded ordering value. Explicit completion restrictions are applied before scoring and remain visible in debug metadata.
