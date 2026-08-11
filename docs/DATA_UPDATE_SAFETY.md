# Ranking Data Update Safety Contract

Ranking refreshes are data operations. They cannot change recommendation weights, path logic, roster rules, injury behavior, grading, UI, or canonical player IDs.

The runtime reads the normalized schema in `schemas/ranking_snapshot.schema.json` through `data/rankings/ACTIVE_SNAPSHOT.json`. Raw provider formatting is handled only by import tooling.

## Refresh workflow

```bash
python3 scripts/ranking_snapshot_pipeline.py --snapshot-date YYYY-MM-DD
```

This creates an immutable candidate, validates stable identities/ranks/tiers, runs the decision canaries, compares it with the active snapshot, and writes a report under `outputs/player_audit/`. It does not promote by default.

After reviewing a safe report:

```bash
python3 scripts/ranking_snapshot_pipeline.py --snapshot-date YYYY-MM-DD --candidate data/rankings/<candidate>.normalized.json --promote
```

Promotion is blocked by schema/identity failures or a failing canary. The prior active snapshot remains unchanged. Expected rank movement is reported rather than rejected; behavioral collapse is rejected.

Canaries cover opening stability, premium RB foundation, unexplained reaches, positional balance, QB/TE timing, specialists, missing-rank safety, completion, ALL ordering, injury contracts, and the golden 4.2.5 failure states.
