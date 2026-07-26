# Best Path V1

## Philosophy

Best Path is a strategic action selector, not a projected-points maximizer. It considers roster construction, tier preservation, opportunity cost, timing, positional balance, value windows, environment, and room psychology. V1 does not claim to calculate a literal championship probability; it uses deterministic strategic proxies intended to protect paths associated with championship roster construction.

## Selection method

Every candidate is evaluated independently before selection. Best Path then applies explicit strategic precedence:

1. Protect a materially endangered tier.
2. Exploit a clearly favorable value window.
3. Act when timing or loss risk requires it.
4. Pivot when a concrete alternative resolves material objections.
5. Build an actual roster requirement.
6. Wait when timing supports patience.
7. Delay a structurally supported position.
8. Monitor when evidence is incomplete or developing.

This is not weighted voting. No score from one evidence category is added to another to elect an action. The precedence is inspectable, deterministic, and covered by boundary scenarios.

Decision confidence is a separate shadow diagnostic derived from known evidence quality, agreement in the selected action's pros and cons, and missing categories. It does not overwrite recommendation confidence.

## Limitations

V1 has no calibrated outcome probabilities, alternate draft simulation, opponent model, or historical decision-outcome dataset. Strategic precedence should be validated in shadow logs before any production consumer is authorized.

