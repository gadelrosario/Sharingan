import json
import unittest
from api.nba_draft_snapshot import capture


def page(changes=None, season='2026-27', date='2026-09-25'):
    r={'id':'espn-1','name':'Sample','team':'BOS','pos':['PG'],'adp':12,'gp':70,'mpg':30,'pg':{'rank':1},'s':{'pts':20,'reb':5,'ast':7,'stl':1,'blk':0,'threePm':2,'to':3,'fgm':7,'fga':14,'ftm':4,'fta':5}}
    r.update(changes or {})
    return f'<h1>{season} NBA fantasy projections</h1><p>Projections updated {date}</p><script type="application/json" id="rk-data">{json.dumps([r])}</script>'


class DraftSnapshotTests(unittest.TestCase):
    def test_valid(self):
        s=capture(page(),2026)
        self.assertEqual(s['evidenceClass'],'PROJECTED_STATS')
        self.assertEqual(s['source']['sourceDate'],'2026-09-25')
        self.assertEqual(s['records'][0]['stats']['blk'],0)
        self.assertEqual(len(s['source']['sha256']),64)
    def test_wrong_season(self):
        with self.assertRaises(ValueError): capture(page(season='2025-26'),2026)
    def test_future_date(self):
        with self.assertRaises(ValueError): capture(page(date='2099-01-01'),2026)
    def test_missing_field_remains_missing(self):
        self.assertIsNone(capture(page({'s':{'pts':20}}),2026)['records'][0]['stats']['fga'])
    def test_negative(self):
        with self.assertRaises(ValueError): capture(page({'s':{'pts':-1}}),2026)
    def test_invalid_identity(self):
        with self.assertRaises(ValueError): capture(page({'id':'nfl-1'}),2026)
    def test_no_page_execution(self):
        s=capture(page()+'<script>throw Error("Do not execute")</script>',2026)
        self.assertEqual(len(s['records']),1)
    def test_made_attempts_conflict(self):
        with self.assertRaises(ValueError): capture(page({'s':{'fgm':20,'fga':10}}),2026)
    def test_bad_position(self):
        with self.assertRaises(ValueError): capture(page({'pos':['QB']}),2026)
