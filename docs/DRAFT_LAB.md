# Draft Lab — Fantasy HQ

Purpose
- The Draft Lab is an experimentation and research environment for evaluating draft strategies under controlled assumptions.
- It is not a live draft assistant and does not claim certainty.

How simulations work
- Simulations conduct a full snake draft among configurable AI managers.
- Draft order follows snake pattern (rounds alternate direction).
- No player may be drafted twice; player pool is consumed.
- Managers pick using heuristics based only on available player fields (no invented projections).

Configuration
- CLI: `python3 scripts/run_draft_lab.py --teams 10 --rounds 15 --simulations 100 --seed 42`
- Configurable: teams, rounds, simulations, seed, managers list.

Assumptions & Limitations
- Players loaded from `data/players.json` if present, otherwise `database/player_master_export.csv`.
- No injury modeling, no weekly projections, no schedule modeling.
- Results represent simulated draft quality only; no championship odds.
- If ADP or overall ranks are missing, simple fallbacks are used and clearly documented in outputs.

Outputs
- JSON results and a CSV summary are written to `outputs/draft_lab/` (ignored by .gitignore by default).
- Terminal report prints average provisional roster score and a short summary.

Scoring
- Roster scoring is provisional and uses only available data (sum of `overall` fields minus simple positional penalties).
- All scores are labeled `Provisional Draft Lab Score`.

Future roadmap
- Add richer manager behaviors driven by historical ADP and tiering logic.
- Add injury and weekly-projection simulators.
- Add visualization of draft trajectories and player exposure charts.

Difference between Live Draft and Draft Lab
- Live Draft: decision-support during an active draft; focuses on single real-world picks.
- Draft Lab: repeated, controlled simulations to compare strategies under the same assumptions.

Usage Notes
- Do not commit outputs. The Draft Lab is for offline analysis and learning.
