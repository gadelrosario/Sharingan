# Current Milestone

## Jōnin 3.7

Fantasy HQ is currently at **Jōnin 3.7**. The product remains a real-time fantasy-football decision assistant whose stable browser experience is optimized for making draft decisions quickly and transparently.

## Stable production systems

- Mamba recommendation engine
- Fight Control
- Adaptive Coaching
- Sharingan Vision
- Premium Player Card
- Draft Psychology
- Room Intelligence
- Manual, mock, and simulated draft workflows
- Current roster, planning, and grading surfaces

These systems remain the authoritative production behavior. Jōnin 3.7.1 changes version presentation only; it does not change their logic or outputs.

## Isolated architecture systems

- Intelligence Core
- Canonical data model
- Mission Control
- Evidence Engine
- Expert Strategy Registry
- Unified Decision Engine
- Best Path evaluator
- Shadow-mode decision execution

The Intelligence Core and Unified Decision Engine are not loaded by the browser application. They do not alter recommendations, scoring, confidence, draft behavior, or UI. Intelligence records remain read-only architecture, and Decision Engine results remain shadow-only and discarded by default.

## Next milestone

The next planned milestone is **Jōnin 3.8 — League Intelligence Integration**.

Its high-level scope is provider-neutral ingestion of league settings, draft order, roster structure, manager identity, and draft-board snapshots. Jōnin 3.7.1 does not implement any of those integrations, connect a provider, or change the browser runtime.

