# Fantasy HQ System Overview

## Purpose

Fantasy HQ is a real-time fantasy sports decision platform designed to support
drafting, waivers, trades, start/sit decisions, and long-term league strategy.

The application combines:

- League and player data
- Expert strategy
- User preferences
- Roster construction
- Decision timing
- Confidence and evidence
- Alternative-path evaluation

---

## High-Level Flow

```text
User Action
    ↓
Application Controller
    ↓
Intelligence Core
    ↓
Decision Engine
    ↓
Strategy Systems
    ↓
Recommendation
    ↓
User Interface
```

---

## Application Controller

Primary file:

- `js/app.js`

Responsibilities:

- Manage application state
- Respond to user actions
- Coordinate draft flow
- Update the interface
- Send decision requests to supporting systems
- Apply recommendations and selections

---

## Intelligence Core

Location:

- `js/intelligence-core/`

Responsibilities:

- Normalize incoming data
- Maintain canonical models
- Gather evidence
- Store intelligence
- Register expert strategies
- Coordinate data providers

Key files:

- `canonical-models.js`
- `data-provider.js`
- `evidence-engine.js`
- `expert-strategy-registry.js`
- `intelligence-store.js`
- `mission-control.js`
- `mock-providers.js`

---

## Decision Engine

Location:

- `js/decision-engine/`

Responsibilities:

- Generate available actions
- Collect evidence
- Evaluate each action
- Compare alternate paths
- Select the best path
- Produce confidence
- Explain the recommendation
- Support shadow-mode comparisons

Key files:

- `candidate-actions.js`
- `evidence-collector.js`
- `action-evaluator.js`
- `best-path-evaluator.js`
- `explanation-generator.js`
- `unified-decision-engine.js`
- `shadow-mode.js`

---

## Strategy Systems

### Flight Control

File:

- `js/flight-control-v1.js`

Purpose:

- Determine whether enough information exists
- Decide whether to act now or wait
- Protect future flexibility
- Identify timing risk

### Sharingan Vision

File:

- `js/sharingan-vision-v1.js`

Purpose:

- Reveal deeper context
- Surface hidden risks
- Highlight tier cliffs
- Show alternate outcomes
- Explain roster impact

### Adaptive Coaching

File:

- `js/adaptive-coaching-engine-v1.js`

Purpose:

- Adjust guidance based on user behavior
- Adapt explanations and recommendations
- Support personalized strategy

### Draft Psychology

File:

- `js/draft-psychology-engine-v1.js`

Purpose:

- Model manager tendencies
- Anticipate reaches and positional runs
- Support board-control decisions

### Jōnin Insight Engine

File:

- `js/jonin-insight-engine-v1.js`

Purpose:

- Produce advanced strategic insight
- Translate evidence into actionable context

---

## Interface Systems

Key files:

- `js/command-center-v1.js`
- `js/roster-view-v1.js`
- `js/premium-player-card-v1.js`
- `js/jonin-ux-polish.js`

Responsibilities:

- Present recommendations
- Display roster state
- Show player information
- Surface confidence and evidence
- Maintain fast readability during live decisions

---

## Decision Lifecycle

```text
1. User reaches a decision point
2. Application Controller gathers current state
3. Intelligence Core normalizes data and evidence
4. Decision Engine generates candidate actions
5. Each action is evaluated
6. Best Path compares current and alternate outcomes
7. Flight Control evaluates timing
8. Sharingan Vision surfaces deeper context
9. Explanation Generator creates concise reasoning
10. The interface displays the recommendation
```

---

## Core Product Rule

Fantasy HQ should not only answer:

> What is the best move?

It should also answer:

> Is now the right time to make that move?

Waiting or taking no action is a valid recommendation.
