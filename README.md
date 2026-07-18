# Fantasy HQ Backend V1

This is the first real local backend foundation for Fantasy HQ.

## What is already included

- SQLite database: `database/fantasyhq.db`
- 134 canonical player records
- 229 BDGE/Flock ranking records
- 134 initial Fantasy HQ score records
- Normalized tables for rankings, ADP, projections, SOS, external IDs, import history, and derived scores
- CSV templates for BDGE, Flock, Sleeper, Yahoo, and consensus
- Reusable CSV importer
- Read-only local API
- Export script
- Smoke test

## No earlier installation is required

You may keep the earlier browser prototype, but this backend does not depend on it. This package starts from the current player dataset and can become the source of truth going forward.

## Offline use

The database, importer, scoring, exports, and local API work offline. Internet is only needed for live Yahoo authorization/sync, automatic ADP updates, live injuries/news, or cloud access from multiple devices.

## First run

You only need Python 3 installed.

### macOS / Windows

Open a terminal in this folder and run:

```bash
python tests/smoke_test.py
python scripts/export_master.py
python api/server.py
```

Then open:

```text
http://127.0.0.1:8765
```

Useful endpoints:

```text
/health
/players
/players?position=RB
/players?search=Cook
/recommendations?limit=3
```

## Import saved rankings or ADP

Fill one of the CSV templates under `imports/<source>/`, then run:

```bash
python scripts/import_csv.py sleeper imports/sleeper/sleeper_template.csv
python scripts/import_csv.py yahoo imports/yahoo/yahoo_template.csv
python scripts/import_csv.py consensus imports/consensus/consensus_template.csv
```

The importer updates existing players instead of duplicating them.

## 30-second draft requirement

The local recommendation endpoint uses indexed SQLite queries and returns only the small amount of information needed by the draft screen. The target is under one second, leaving the rest of the 30-second window for reading and deciding.

## Current limitation

The exact Sleeper, Yahoo, and consensus ADP values are not populated in this database yet. Their schema, templates, import workflow, and external-ID support are ready. We should import the previously supplied raw values once we locate or reconstruct those exact rows.

## Yahoo sync readiness

The database is ready for Yahoo player keys through `external_ids` and for league data in a later module. Yahoo OAuth and live league sync are intentionally not included yet because they require online authorization and app credentials.
