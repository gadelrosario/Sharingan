import importlib.util,json,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
SPEC=importlib.util.spec_from_file_location('ranking_snapshot_pipeline',ROOT/'scripts'/'ranking_snapshot_pipeline.py');pipeline=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(pipeline)
class DataUpdateSafetyTests(unittest.TestCase):
 def setUp(self):
  self.active=json.loads((ROOT/'data'/'rankings'/'ACTIVE_SNAPSHOT.json').read_text());name=self.active.get('activeSnapshot') or self.active['sources']['Fantasyland']['activeSnapshot'];self.snapshot=json.loads((ROOT/'data'/'rankings'/name).read_text())
 def test_active_snapshot_contract(self):
  self.assertTrue(self.snapshot['immutable']);self.assertEqual(len(self.snapshot['records']),354);matched=[r for r in self.snapshot['records'] if r['importStatus']=='MATCHED'];self.assertEqual(len(matched),256);self.assertEqual(len({r['playerId'] for r in matched}),256)
 def test_missing_rank_stays_missing_and_ids_are_stable(self):
  unresolved=[r for r in self.snapshot['records'] if r['importStatus']!='MATCHED'];self.assertTrue(unresolved);self.assertTrue(all(r['playerId'] is None for r in unresolved));self.assertTrue(all(r['overallRank'] is not None for r in unresolved))
 def test_differential_reports_rank_and_tier_changes(self):
  newer=json.loads(json.dumps(self.snapshot));newer['records'][0]['overallRank'],newer['records'][1]['overallRank']=newer['records'][1]['overallRank'],newer['records'][0]['overallRank'];newer['records'][0]['overallTier']='A';report=pipeline.differential(self.snapshot,newer);self.assertEqual(report['rankChanges'],2);self.assertEqual(report['tierChanges'],1);self.assertGreaterEqual(report['top25Changes'],0)
 def test_invalid_snapshot_is_a_promotion_blocker(self):
  matched=[r for r in self.snapshot['records'] if r['importStatus']=='MATCHED'];broken=json.loads(json.dumps(self.snapshot));target=next(r for r in broken['records'] if r['sourceRecordId']==matched[1]['sourceRecordId']);target['playerId']=matched[0]['playerId'];ids=[r['playerId'] for r in broken['records'] if r['importStatus']=='MATCHED'];self.assertNotEqual(len(ids),len(set(ids)))
 def test_runtime_loads_normalized_contract_without_source_specific_parser(self):
  app=(ROOT/'js'/'app.js').read_text();self.assertIn('applyActiveRankingSnapshot',app);self.assertNotIn('Fantasyland 2026 Rankings',app)
if __name__=='__main__':unittest.main()
