import json, pathlib, sqlite3, tempfile, unittest
from scripts.fantasyland_rankings import reconcile
from scripts.apply_reviewed_players import apply

ROOT=pathlib.Path(__file__).resolve().parents[1]

class FantasylandRankingImportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.players=json.loads((ROOT/'data/players.json').read_text())
        cls.snapshot=json.loads((ROOT/'data/sources/fantasyland_2026-08-08.json').read_text())
        cls.updated,cls.report=reconcile(json.loads(json.dumps(cls.players)),cls.snapshot)

    def test_source_contract_and_independent_rank_fields(self):
        self.assertEqual((self.report['source'],self.report['hostPlatform'],self.report['snapshotDate']),('Fantasyland','Flock Fantasy','2026-08-08'))
        player=next(p for p in self.updated if p['name']=='Jauan Jennings')
        self.assertEqual((player['fantasylandOverallRank'],player['fantasylandOverallTier'],player['fantasylandPositionRank'],player['fantasylandPositionTier']),(203,'O',79,'J'))

    def test_verified_team_overrides_canonical_but_preserves_source_team(self):
        player=next(p for p in self.updated if p['name']=='Jauan Jennings')
        self.assertEqual(player['team'],'MIN')
        self.assertEqual(player['fantasylandSourceTeam'],'MIN')
        self.assertEqual(self.report['teamMismatches'],[])
        self.assertEqual(player['teamVerificationSource'],'https://www.nfl.com/players/jauan-jennings/')

    def test_unsafe_rows_are_reported_not_guessed(self):
        self.assertIn(['bijan robinson','RB'],self.report['duplicateSourceIdentities'])
        self.assertEqual([(row['overallRank'],row['playerName']) for row in self.report['unmatchedRows']],[(110,'Jaylin Higgins'),(192,'S. Bell'),(194,'M. Fields'),(222,'Cedrick Wilson/Douglas')])
        self.assertEqual([(row['overallRank'],row['playerName']) for row in self.report['quarantinedRows']],[(207,'Bijan Robinson')])
        self.assertEqual(self.report['duplicateCanonicalIdentities'],[])

    def test_top_180_has_only_one_unresolved_identity(self):
        unresolved=[row for row in self.report['unmatchedRows'] if row['overallRank'] <= 180]
        self.assertEqual([(row['overallRank'],row['playerName']) for row in unresolved],[(110,'Jaylin Higgins')])

    def test_stable_ids_survive_import(self):
        before={p['name']:p['id'] for p in self.players}
        self.assertTrue(all(before[p['name']]==p['id'] for p in self.updated))

    def test_reviewed_additions_dry_run_is_byte_immutable(self):
        with tempfile.TemporaryDirectory() as directory:
            copy=pathlib.Path(directory)/'players.db';copy.write_bytes((ROOT/'database/fantasyhq.db').read_bytes());before=copy.read_bytes()
            result=apply(copy,ROOT/'data/reviewed_player_additions_2026-08-08.json',commit=False)
            self.assertEqual(result['status'],'dry-run');self.assertEqual(copy.read_bytes(),before)

    def test_four_reviewed_additions_exist_once(self):
        names=['Stefon Diggs','Deebo Samuel','Tyler Loop','Isiah Pacheco']
        self.assertEqual({name:sum(p['name']==name for p in self.players) for name in names},{name:1 for name in names})

if __name__=='__main__':unittest.main()
