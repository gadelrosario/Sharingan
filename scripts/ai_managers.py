"""
AI Managers for Draft Lab
Provide simple heuristic managers. Each manager has a `pick(pool, roster, rng, pick_number, round_number, total_rounds)` method.
Managers are lightweight and use available player fields only.
"""
from typing import List
import random

class BaseManager:
    def __init__(self, name='Base', randomness=0.1):
        self.name = name
        self.randomness = float(randomness)

    def pick(self, pool: List[dict], roster: List[dict], rng: random.Random, **kwargs):
        # default: return best by 'overall'
        sorted_pool = sorted(pool, key=lambda p: p.get('overall') if p.get('overall') is not None else 0, reverse=True)
        if rng.random() < self.randomness:
            return rng.choice(pool)
        return sorted_pool[0]

class BalancedManager(BaseManager):
    def __init__(self, randomness=0.1):
        super().__init__('Balanced', randomness)

    def pick(self, pool, roster, rng, **kwargs):
        # prefer filling weakest positions by count
        counts = {}
        for p in roster:
            counts[p.get('pos')] = counts.get(p.get('pos'), 0)+1
        # simple desired minima
        desired = {'RB':2,'WR':2,'QB':1,'TE':1}
        # find undersupplied positions available in pool
        unders = None
        for pos,need in desired.items():
            have = counts.get(pos,0)
            if have < need:
                # find best in pos
                candidates = [x for x in pool if x.get('pos')==pos]
                if candidates:
                    unders = candidates
                    break
        if unders:
            return max(unders, key=lambda p: p.get('overall',0))
        return super().pick(pool, roster, rng)

class BPA(BaseManager):
    def __init__(self, randomness=0.05):
        super().__init__('BPA', randomness)

    def pick(self, pool, roster, rng, **kwargs):
        return super().pick(pool, roster, rng)

class PosPriorityManager(BaseManager):
    def __init__(self, pos='RB', weight=1.5, randomness=0.1, name=None):
        super().__init__(name or f'{pos}Heavy', randomness)
        self.pos = pos
        self.weight = float(weight)

    def pick(self, pool, roster, rng, **kwargs):
        def score(p):
            base = p.get('overall',0)
            bonus = base * (self.weight-1.0) if p.get('pos')==self.pos else 0
            return base + bonus
        if rng.random() < self.randomness:
            return rng.choice(pool)
        return max(pool, key=score)

class ADPFollower(BaseManager):
    def __init__(self, randomness=0.05):
        super().__init__('ADP Follower', randomness)

    def pick(self, pool, roster, rng, **kwargs):
        with_adp = [p for p in pool if p.get('adp') is not None]
        if with_adp and rng.random() >= self.randomness:
            # choose lowest ADP (closest to consensus)
            return min(with_adp, key=lambda p: p.get('adp'))
        return super().pick(pool, roster, rng)

class Chaotic(BaseManager):
    def __init__(self, randomness=1.0):
        super().__init__('Chaotic', randomness)

    def pick(self, pool, roster, rng, **kwargs):
        return rng.choice(pool)

class ValueHunter(BaseManager):
    def __init__(self, randomness=0.1):
        super().__init__('Value Hunter', randomness)

    def pick(self, pool, roster, rng, pick_number=None, **kwargs):
        # If ADP available, prefer players where (adp - pick_number) is high
        candidates = []
        for p in pool:
            adp = p.get('adp')
            overall = p.get('overall') or 0
            if adp is not None and pick_number is not None:
                value = (adp - pick_number) + (overall * 0.01)
            else:
                value = overall
            candidates.append((value,p))
        candidates.sort(key=lambda t:t[0], reverse=True)
        if rng.random() < self.randomness:
            return rng.choice(pool)
        return candidates[0][1]

# factory

def create_managers(defs, rng=None):
    rng = rng or random.Random()
    managers = []
    for d in defs:
        # allow variety: string key or dict
        if isinstance(d, str):
            key = d.lower()
            if key == 'balanced': managers.append(BalancedManager(randomness=0.1))
            elif key == 'bpa': managers.append(BPA(randomness=0.05))
            elif key == 'rbheavy' or key=='rb heavy' or key=='rb': managers.append(PosPriorityManager(pos='RB', weight=1.6))
            elif key == 'wrheavy' or key=='wr heavy' or key=='wr': managers.append(PosPriorityManager(pos='WR', weight=1.6))
            elif key == 'early qb' or key=='early_qb' or key=='earlyqb': managers.append(BaseManager('Early QB', randomness=0.08))
            elif key == 'late qb' or key=='late_qb' or key=='lateqb': managers.append(BaseManager('Late QB', randomness=0.08))
            elif key == 'elite te' or key=='elite_te' or key=='te': managers.append(PosPriorityManager(pos='TE', weight=2.0))
            elif key == 'adp follower' or key=='adp': managers.append(ADPFollower(randomness=0.05))
            elif key == 'chaotic': managers.append(Chaotic())
            elif key == 'value hunter' or key=='value': managers.append(ValueHunter())
            else:
                # default Balanced
                managers.append(BalancedManager())
        elif isinstance(d, dict):
            # allow definition like {"type":"RB Heavy","randomness":0.2}
            t = d.get('type','balanced').lower()
            rand = d.get('randomness',0.1)
            if 'rb' in t: managers.append(PosPriorityManager(pos='RB', weight=1.6, randomness=rand))
            elif 'wr' in t: managers.append(PosPriorityManager(pos='WR', weight=1.6, randomness=rand))
            elif 'adp' in t: managers.append(ADPFollower(randomness=rand))
            elif 'value' in t: managers.append(ValueHunter(randomness=rand))
            elif 'chaos' in t: managers.append(Chaotic(randomness=1.0))
            else: managers.append(BalancedManager(randomness=rand))
        else:
            managers.append(BalancedManager())
    return managers
