# Mission Control

Mission Control monitors data operations; it does not make fantasy decisions.

For each registered provider it tracks:

- Provider status
- Last attempted sync
- Last successful sync
- Next scheduled sync
- Sync failure count
- Most recent error

It also owns a FIFO refresh queue. A provider refresh updates health state and emits concise messages through an injected logger. Tests can use a silent logger and fixed clock, keeping the service deterministic.

Current providers are offline mocks. Future scheduling, distributed locks, persistence, retries, alerting, and credential health should be added behind this service without changing provider or canonical contracts.

