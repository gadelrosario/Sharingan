"""Produce a deterministic canonical/live/source integrity summary."""
from __future__ import annotations
import argparse,json,sqlite3,sys
from collections import Counter
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from scripts.player_data_audit import normalize_name

def build(db_path:Path,players_path:Path,import_report_path:Path)->dict:
    players=json.loads(players_path.read_text(encoding='utf-8'));source=json.loads(import_report_path.read_text(encoding='utf-8'))
    connection=sqlite3.connect(db_path)
    try: canonical=connection.execute('SELECT id,canonical_key,full_name,position,nfl_team FROM players ORDER BY id').fetchall()
    finally: connection.close()
    ids=Counter(str(row.get('id')) for row in players);identities=Counter((normalize_name(row.get('name')),str(row.get('pos') or '').upper()) for row in players)
    source_ids={str(row['stableId']) for row in source.get('repairedMappings',[])}
    return {'canonicalDatabasePlayers':len(canonical),'liveDraftPlayers':len(players),'duplicateLiveIds':[key for key,count in ids.items() if count>1],'duplicateLiveIdentities':[list(key) for key,count in identities.items() if count>1],'canonicalMissingTeams':[{'id':row[0],'canonicalKey':row[1],'name':row[2],'position':row[3]} for row in canonical if not row[4]],'fantasyland':{'source':source['source'],'hostPlatform':source['hostPlatform'],'snapshotDate':source['snapshotDate'],'sourceRows':source['sourceRows'],'matchedRows':source['matchedRows'],'unmatchedRows':len(source['unmatchedRows']),'duplicateSourceIdentities':source['duplicateSourceIdentities'],'teamMismatches':source['teamMismatches'],'positionMismatches':source['positionMismatches'],'repairedMappings':source['repairedMappings']},'reviewStatus':{'independentlyReviewedAdditions':['Stefon Diggs','Deebo Samuel','Tyler Loop','Isiah Pacheco'],'unresolvedSourceRowsRequireReview':len(source['unmatchedRows']),'sourceTeamLabelsAppliedToCanonical':False}}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--db',type=Path,default=Path('database/fantasyhq.db'));parser.add_argument('--players',type=Path,default=Path('data/players.json'));parser.add_argument('--import-report',type=Path,default=Path('outputs/player_audit/fantasyland_import_2026-08-08.json'));parser.add_argument('--out',type=Path,default=Path('outputs/player_audit/player_integrity_2026-08-08.json'));args=parser.parse_args();report=build(args.db,args.players,args.import_report);args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report,indent=2));return 0
if __name__=='__main__':raise SystemExit(main())
