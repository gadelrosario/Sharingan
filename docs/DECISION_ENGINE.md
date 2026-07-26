# Unified Decision Engine V1

## Purpose

Fantasy HQ rankings answer which player is evaluated most highly. The Unified Decision Engine answers which action best preserves the user's championship path in the current draft state. Drafting the recommendation is one candidate action alongside waiting, pivoting, protecting a tier, exploiting value, building or delaying a position, and monitoring the room.

V1 runs only in shadow mode. It is not loaded by the browser, does not import the live recommendation implementation, and cannot change recommendation order, Mamba, confidence, Draft Psychology, Fight Control, Adaptive Coaching, Sharingan, or simulation.

## Package

`js/decision-engine/index.js` exports the provider-neutral contracts, evidence collector, candidate generator, independent action evaluator, Best Path evaluator, explanation generator, unified engine, and shadow runner.

Callers provide immutable-style snapshots and an explicit `generatedAt` timestamp. The engine performs no I/O, network access, storage, random operation, AI inference, or machine learning. Identical inputs produce identical decisions and IDs.

The Decision object contains action, independent shadow confidence, concise primary and supporting reasons, counterarguments, evidence metadata, unknown information, generation time, recommendation reference, and `SHADOW` status. It never exposes internal reasoning traces.

## Future integration

A future Flight Control bridge may consume this Decision contract only after shadow outputs are calibrated and separately reviewed. Until then, the default shadow runner discards decisions and returns only analysis counts and unchanged recommendation IDs.

