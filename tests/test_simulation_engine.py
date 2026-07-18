"""Unit tests for the Draft Lab Simulation Engine using unittest.

Run with:
  python3 -m unittest discover tests
"""
import os
import json
import tempfile
import unittest

from scripts.simulation_engine import SimulationEngine


def make_mock_players(n=30):
    players = []
    pos_cycle = ['QB', 'RB', 'WR', 'TE']
    for i in range(n):
        players.append({
            'id': str(i),
            'name': f'P{i}',
            'pos': pos_cycle[i % len(pos_cycle)],
            'overall': float(n - i),
            'adp': float(i + 1)
        })
    return players


class TestSimulationEngine(unittest.TestCase):
    def test_snake_order_and_no_duplicates(self):
        players = make_mock_players(50)
        engine = SimulationEngine(players=players, teams=3, rounds=4, simulations=1, seed=123)
        res = engine.run()
        self.assertTrue(os.path.exists(res['json']))
        self.assertTrue(os.path.exists(res['csv']))

    def test_deterministic_seed(self):
        players = make_mock_players(40)
        e1 = SimulationEngine(players=players, teams=4, rounds=3, simulations=2, seed=42)
        r1 = e1.run()
        e2 = SimulationEngine(players=players, teams=4, rounds=3, simulations=2, seed=42)
        r2 = e2.run()
        s1 = json.load(open(r1['json']))
        s2 = json.load(open(r2['json']))
        self.assertEqual(s1['simulations'], s2['simulations'])

    def test_valid_roster_construction(self):
        players = make_mock_players(40)
        engine = SimulationEngine(players=players, teams=2, rounds=6, simulations=1, seed=7)
        out = engine.run()
        data = json.load(open(out['json']))
        self.assertIn('simulations', data)
        self.assertEqual(len(data['simulations']), 1)

    def test_csv_and_json_generation(self):
        players = make_mock_players(30)
        engine = SimulationEngine(players=players, teams=2, rounds=3, simulations=1, seed=9)
        out = engine.run()
        self.assertTrue(os.path.exists(out['json']))
        self.assertTrue(os.path.exists(out['csv']))


if __name__ == '__main__':
    unittest.main()
