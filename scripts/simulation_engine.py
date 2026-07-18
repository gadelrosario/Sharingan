"""
Simple Simulation Engine for Draft Lab
- Supports snake draft
- Prevents duplicate picks
- Deterministic via `random.Random(seed)`
- Can accept a players list directly for tests
"""
import json
import csv
import time
import os
from collections import defaultdict
import random

from scripts.roster_scoring import score_roster
from scripts.ai_managers import create_managers

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'outputs', 'draft_lab')

class SimulationEngine:
    def __init__(self, players=None, teams=10, rounds=15, managers=None, simulations=100, seed=None, roster_requirements=None, scoring_label="Provisional Draft Lab Score"):
        self.teams = int(teams)
        self.rounds = int(rounds)
        self.simulations = int(simulations)
        self.seed = seed
        self.roster_requirements = roster_requirements or {"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1}
        self.scoring_label = scoring_label
        self.players = players or self._load_players()
        # managers can be a list of manager keys or instances
        self.manager_defs = managers

    def _load_players(self):
        # Prefer data/players.json but gracefully fallback to CSV
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        json_path = os.path.join(base, 'data', 'players.json')
        csv_path = os.path.join(base, 'database', 'player_master_export.csv')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Normalize players: ensure id, name, pos, overall, adp
                    players = []
                    for i,p in enumerate(data):
                        players.append({
                            'id': p.get('id') or p.get('playerId') or str(i),
                            'name': p.get('name') or p.get('player') or 'unknown',
                            'pos': p.get('pos') or p.get('position') or 'NA',
                            'overall': p.get('overall') or p.get('rank') or (p.get('overall_rank') if p.get('overall_rank') else i),
                            'adp': p.get('adp')
                        })
                    return players
            except Exception:
                pass
        if os.path.exists(csv_path):
            players = []
            try:
                with open(csv_path, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    for i,row in enumerate(reader):
                        players.append({
                            'id': row.get('id') or row.get('playerId') or str(i),
                            'name': row.get('name') or row.get('player') or 'unknown',
                            'pos': row.get('pos') or row.get('position') or 'NA',
                            'overall': float(row.get('overall') or row.get('rank') or i),
                            'adp': (float(row.get('adp')) if row.get('adp') else None)
                        })
                return players
            except Exception:
                pass
        # Last resort: empty list
        return []

    def _init_rng(self, sim_index):
        if self.seed is None:
            return random.Random()
        # combine seed and sim_index to get reproducible independent draws
        return random.Random((int(self.seed) * 1000003) ^ sim_index)

    def _snake_order(self):
        # Returns a list of manager indices for each pick in order
        order = list(range(self.teams))
        picks = []
        for r in range(self.rounds):
            if r % 2 == 0:
                picks.extend(order)
            else:
                picks.extend(list(reversed(order)))
        return picks

    def run(self):
        results = []
        os.makedirs(os.path.join(OUTPUT_DIR), exist_ok=True)
        for sim in range(self.simulations):
            rng = self._init_rng(sim)
            sim_result = self._run_single_sim(sim, rng)
            results.append(sim_result)
        timestamp = int(time.time())
        json_path = os.path.join(OUTPUT_DIR, f'draft_lab_results_{timestamp}.json')
        csv_path = os.path.join(OUTPUT_DIR, f'draft_lab_summary_{timestamp}.csv')
        with open(json_path, 'w', encoding='utf-8') as jf:
            json.dump({'simulations': results, 'assumptions': self._assumptions()}, jf, indent=2)
        # write a simple CSV summary of per-simulation averages
        with open(csv_path, 'w', encoding='utf-8', newline='') as cf:
            import csv as _csv
            writer = _csv.writer(cf)
            writer.writerow(['sim_index','avg_roster_score','avg_value_captured','reach_count'])
            for i,res in enumerate(results):
                writer.writerow([i, res.get('avg_roster_score'), res.get('avg_value_captured'), res.get('reach_count')])
        # Terminal report
        summary = self._terminal_report(results)
        return {'json': json_path, 'csv': csv_path, 'summary': summary}

    def _run_single_sim(self, sim_index, rng):
        pool = [dict(p) for p in self.players]
        # shallow copy
        picks_order = self._snake_order()
        # instantiate managers
        if self.manager_defs:
            managers = create_managers(self.manager_defs, rng)
        else:
            # Default: simple rotation of balanced managers
            managers = create_managers(['Balanced'] * self.teams, rng)
        # ensure we have as many managers as teams
        if len(managers) < self.teams:
            # fill with Balanced
            extra = self.teams - len(managers)
            managers.extend(create_managers(['Balanced'] * extra, rng))
        manager_rosters = [[] for _ in range(self.teams)]
        pick_numbers = []
        pick_index = 0
        pick_metadata = []
        for pick_owner in picks_order:
            manager = managers[pick_owner]
            if not pool:
                break
            choice = manager.pick(pool=pool, roster=manager_rosters[pick_owner], rng=rng, pick_number=pick_index, round_number=(pick_index//self.teams)+1, total_rounds=self.rounds)
            # manager.pick should return a player dict or player id
            picked = None
            if isinstance(choice, dict):
                picked = choice
            else:
                # find by id
                for i,p in enumerate(pool):
                    if p.get('id') == choice or p.get('name') == choice:
                        picked = p
                        break
            if picked is None:
                # fallback: random pick
                picked = rng.choice(pool)
            # assign and remove
            manager_rosters[pick_owner].append(picked)
            pool = [p for p in pool if p.get('id') != picked.get('id')]
            pick_metadata.append({'pick_index': pick_index, 'owner': pick_owner, 'player': picked})
            pick_index += 1
        # Score rosters
        scores = []
        for r in manager_rosters:
            s = score_roster(r, self.players, self.scoring_label)
            scores.append(s)
        avg_roster_score = sum(s.get('score',0) for s in scores)/max(1,len(scores))
        # value captured: if adp exists, sum(adp - pick_position)
        value_captured = 0
        adp_count = 0
        for pick in pick_metadata:
            p = pick['player']
            adp = p.get('adp')
            if adp:
                value_captured += (adp - pick['pick_index'])
                adp_count += 1
        avg_value_captured = (value_captured/adp_count) if adp_count else None
        # reach count: crude heuristic: pick where pick_index < adp - threshold
        reach_count = 0
        for pick in pick_metadata:
            p = pick['player']
            adp = p.get('adp')
            if adp and pick['pick_index']+1 < adp - 3:
                reach_count += 1
        res = {
            'sim_index': sim_index,
            'avg_roster_score': avg_roster_score,
            'avg_value_captured': avg_value_captured,
            'reach_count': reach_count,
            'pick_count': pick_index,
            'assumptions': self._assumptions()
        }
        return res

    def _assumptions(self):
        return {
            'players_source': 'data/players.json (preferred) or database/player_master_export.csv',
            'simulations': self.simulations,
            'teams': self.teams,
            'rounds': self.rounds,
            'seed': self.seed,
            'no_injury_modeling': True,
            'no_weekly_projections': True,
        }

    def _terminal_report(self, results):
        total = len(results)
        avg_score = sum(r.get('avg_roster_score',0) for r in results)/max(1,total)
        avg_value = sum(r.get('avg_value_captured',0) for r in results if r.get('avg_value_captured') is not None)/max(1,sum(1 for r in results if r.get('avg_value_captured') is not None)) if results else None
        report = f"Draft Lab: {total} sims, teams={self.teams}, rounds={self.rounds}\nAverage provisional roster score: {avg_score:.2f}\nAverage value captured: {avg_value if avg_value is not None else 'N/A'}"
        print(report)
        return report
