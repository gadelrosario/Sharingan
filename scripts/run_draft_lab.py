"""
CLI runner for Draft Lab
Example:
python3 scripts/run_draft_lab.py --teams 10 --rounds 15 --simulations 100 --seed 42
"""
import argparse
import os
import sys

# Ensure project root is on sys.path so `from scripts.*` imports resolve
# when running `python3 scripts/run_draft_lab.py` directly. This is a
# minimal, well-scoped insertion of the project root (parent of this file)
# and avoids broader, fragile sys.path hacks.
proj_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if proj_root not in sys.path:
    sys.path.insert(0, proj_root)

from scripts.simulation_engine import SimulationEngine


def main():
    parser = argparse.ArgumentParser(description='Run Draft Lab simulations')
    parser.add_argument('--teams', type=int, default=10)
    parser.add_argument('--rounds', type=int, default=15)
    parser.add_argument('--simulations', type=int, default=10)
    parser.add_argument('--seed', type=int, default=None)
    parser.add_argument('--managers', type=str, default=None, help='Comma-separated manager types to use (defaults to Balanced)')
    parser.add_argument('--output', type=str, default=None)
    args = parser.parse_args()
    managers = None
    if args.managers:
        managers = [m.strip() for m in args.managers.split(',')]
    engine = SimulationEngine(teams=args.teams, rounds=args.rounds, simulations=args.simulations, seed=args.seed, managers=managers)
    res = engine.run()
    print('Outputs written:')
    print(res['json'])
    print(res['csv'])

if __name__ == '__main__':
    main()
