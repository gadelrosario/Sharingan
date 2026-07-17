# Unity Core migration status

Completed in 2.8:
- Canonical tier selector
- Cached player evaluation layer
- Shared per-pick intelligence snapshot
- Shared recommendation, market, wait, and scan inputs
- Automatic invalidation on draft-state changes

Next migration targets:
- Move core state and engines into separate JS modules
- Add automated consistency tests
- Add a developer diagnostics panel
