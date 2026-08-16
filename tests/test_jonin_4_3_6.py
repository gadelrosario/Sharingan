import json
import pathlib
import subprocess
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
NODE=pathlib.Path('/Users/gnetx/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')

class Jonin436Tests(unittest.TestCase):
    def test_draft_day_readiness_contracts(self):
        result=subprocess.run([str(NODE),'tests/draft-day-readiness-4-3-6-tests.js'],cwd=ROOT,text=True,capture_output=True,check=False,env={**__import__('os').environ,'SKIP_FULL_DRAFT':'1'})
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        payload=json.loads(result.stdout)
        self.assertEqual((payload['passCount'],payload['failCount']),(12,0))
        self.assertFalse(payload['fullDraftIncluded'])

    def test_entry_points_use_authoritative_pick_path(self):
        app=(ROOT/'js'/'app.js').read_text(encoding='utf-8')
        self.assertIn('function isDraftedPlayer(id)',app)
        self.assertIn('if (Number(team) !== owner) return false;',app)
        self.assertIn('onclick="recordCurrentPick(${safeInsightText(card.playerId)})"',app)
        self.assertIn('onclick="recordCurrentPick(${p.id});closeScan()"',app)

    def test_impossible_completed_state_is_rejected(self):
        session=(ROOT/'js'/'draft-session-v1.js').read_text(encoding='utf-8')
        self.assertIn("snapshot.status==='complete'",session)
        self.assertIn("snapshot.status==='active'",session)
        self.assertIn('Saved completed draft is incomplete.',session)

if __name__=='__main__':unittest.main()
