# Fantasy HQ Module Dependency Map

## Purpose

This document describes how the major Fantasy HQ modules depend on one another.

The architecture is intentionally layered.

Higher layers should depend on lower layers whenever possible.

---

# Layer 1 — Application

Entry Point

```
index.html
```

loads

```
app.js
```

---

# Layer 2 — Core

Application Controller

```
app.js
```

coordinates:

- Fantasy HQ Core
- Intelligence Core
- Decision Engine
- Interface

---

# Layer 3 — Intelligence

```
Intelligence Core
```

Provides:

- canonical data
- expert knowledge
- evidence
- provider abstraction
- normalized information

Outputs

↓

Decision Engine

---

# Layer 4 — Decision Engine

Consumes:

- Intelligence
- League state
- User state
- Draft state

Produces:

- candidate actions
- best path
- confidence
- explanation

Outputs

↓

Strategy Systems

---

# Layer 5 — Strategy Systems

Flight Control

↓

Decision Timing

Sharingan Vision

↓

Hidden Context

Adaptive Coaching

↓

Personalization

Draft Psychology

↓

Opponent Modeling

Jonin Insight

↓

Strategic Insight

---

# Layer 6 — Interface

Displays

- Recommendation
- Confidence
- Explanation
- Evidence
- Alternate Path
- TeamFit
- Timing

---

# Data Flow

User

↓

Application

↓

Intelligence

↓

Decision Engine

↓

Strategy Systems

↓

UI

↓

User

---

# Future Systems

Planned modules:

- League Sync
- Trade Engine
- Waiver Engine
- Start/Sit Engine
- Dynasty Mode
- NBA Engine
- Izanagi
- Izanami

These should integrate into the Decision Engine rather than bypass it.

The Unified Decision Engine remains the central decision authority.
